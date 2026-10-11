require('dotenv').config()

const fs = require('node:fs')
const path = require('node:path')
const cors = require('cors')
const express = require('express')
const { Pool } = require('pg')

const app = express()
const PORT = process.env.PORT || 5000
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '')
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
const sslRootCertPath = process.env.SSL_ROOT_CERT
  ? path.resolve(__dirname, process.env.SSL_ROOT_CERT)
  : path.join(__dirname, 'supabase-root.crt')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env and add your Supabase connection string.')
  process.exit(1)
}

if (!fs.existsSync(sslRootCertPath)) {
  console.error('Supabase root certificate was not found at ' + sslRootCertPath + '. Download it from Database settings and save it as supabase-root.crt.')
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: fs.readFileSync(sslRootCertPath, 'utf8'),
    rejectUnauthorized: true
  }
})

app.use(cors({ origin: FRONTEND_URL }))
app.use(express.json({ limit: '100kb' }))

async function requireSignedInUser(req, res, next) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return res.status(503).json({ error: 'Server-side Supabase Auth is not configured.' })
  }

  const authorization = req.get('authorization') || ''
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return res.status(401).json({ error: 'Sign in is required.' })

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${token}`
      }
    })
    if (response.status === 401 || response.status === 403) {
      return res.status(401).json({ error: 'Your sign-in has expired. Please sign in again.' })
    }
    if (!response.ok) {
      return res.status(502).json({ error: 'Could not verify your sign-in with Supabase.' })
    }

    req.authUser = await response.json()
    next()
  } catch (error) {
    next(error)
  }
}

async function requireAdmin(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT 1 FROM public.app_admins WHERE user_id = $1',
      [req.authUser.id]
    )
    if (result.rowCount === 0) return res.status(403).json({ error: 'Administrator access is required.' })
    next()
  } catch (error) {
    next(error)
  }
}

async function requireAdminAccess(req, res, next) {
  await requireSignedInUser(req, res, (error) => {
    if (error) return next(error)
    return requireAdmin(req, res, next)
  })
}

const CHARACTER_SELECT = `
  SELECT
    c.id,
    c.name,
    c.real_name,
    c.alias,
    c.description,
    c.origin,
    c.alignment,
    c.first_appearance,
    c.image_url,
    c.comics_available,
    COALESCE((
      SELECT json_agg(p.name ORDER BY p.name)
      FROM character_powers cp
      JOIN powers p ON p.id = cp.power_id
      WHERE cp.character_id = c.id
    ), '[]'::json) AS powers,
    COALESCE((
      SELECT json_agg(t.name ORDER BY t.name)
      FROM character_teams ct
      JOIN teams t ON t.id = ct.team_id
      WHERE ct.character_id = c.id
    ), '[]'::json) AS teams
  FROM characters c
`

function toCharacter(row) {
  return {
    id: Number(row.id),
    name: row.name,
    realName: row.real_name,
    alias: row.alias,
    description: row.description,
    origin: row.origin,
    alignment: row.alignment,
    firstAppearance: row.first_appearance,
    imageUrl: row.image_url,
    comicsAvailable: row.comics_available,
    powers: row.powers || [],
    teams: row.teams || []
  }
}

function parseId(value) {
  if (!/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function parseNameList(value, fieldName, errors) {
  if (value === undefined || value === null || value === '') return []
  if (!Array.isArray(value)) {
    errors.push(`${fieldName} must be a list of names`)
    return []
  }

  const names = []
  for (const item of value) {
    if (typeof item !== 'string') {
      errors.push(`${fieldName} entries must be text`)
      continue
    }
    const name = item.trim()
    if (name) names.push(name)
  }

  if (names.length > 30) errors.push(`${fieldName} can contain at most 30 entries`)
  if (names.some((name) => name.length > 80)) errors.push(`${fieldName} entries must be 80 characters or fewer`)

  return [...new Map(names.map((name) => [name.toLocaleLowerCase(), name])).values()]
}

function validateCharacter(body, includeId = false) {
  const errors = []
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  const text = (value) => typeof value === 'string' ? value.trim() : ''
  const id = includeId ? parseId(String(input.id ?? '')) : null
  const name = text(input.name)
  const realName = text(input.realName)
  const alias = text(input.alias)
  const description = text(input.description)
  const origin = text(input.origin)
  const alignment = text(input.alignment) || 'other'
  const firstAppearance = text(input.firstAppearance)
  const imageUrl = text(input.imageUrl)
  const comicsAvailable = input.comicsAvailable === undefined ? 0 : Number(input.comicsAvailable)
  const powers = parseNameList(input.powers, 'powers', errors)
  const teams = parseNameList(input.teams, 'teams', errors)

  if (includeId && id === null) errors.push('id must be a positive whole number')
  if (!name || name.length > 120) errors.push('name must be between 1 and 120 characters')
  if (realName.length > 120) errors.push('realName must be 120 characters or fewer')
  if (alias.length > 160) errors.push('alias must be 160 characters or fewer')
  if (description.length > 2000) errors.push('description must be 2000 characters or fewer')
  if (origin.length > 1000) errors.push('origin must be 1000 characters or fewer')
  if (firstAppearance.length > 160) errors.push('firstAppearance must be 160 characters or fewer')
  if (!['hero', 'antihero', 'villain', 'other'].includes(alignment)) {
    errors.push('alignment must be hero, antihero, villain, or other')
  }
  if (!Number.isInteger(comicsAvailable) || comicsAvailable < 0) {
    errors.push('comicsAvailable must be a non-negative whole number')
  }

  let normalizedImageUrl = null
  if (imageUrl) {
    try {
      const parsedUrl = new URL(imageUrl)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid protocol')
      normalizedImageUrl = parsedUrl.toString()
    } catch {
      errors.push('imageUrl must be a valid HTTP or HTTPS URL')
    }
  }

  return {
    errors,
    values: {
      id,
      name,
      realName,
      alias,
      description,
      origin,
      alignment,
      firstAppearance,
      imageUrl: normalizedImageUrl,
      comicsAvailable,
      powers,
      teams
    }
  }
}

async function withTransaction(work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function replaceNamedRelations(client, characterId, names, table, joinTable, foreignKey) {
  await client.query(`DELETE FROM ${joinTable} WHERE character_id = $1`, [characterId])

  for (const name of names) {
    const inserted = await client.query(
      `INSERT INTO ${table} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`,
      [name]
    )
    let relatedId = inserted.rows[0]?.id
    if (relatedId === undefined) {
      const existing = await client.query(`SELECT id FROM ${table} WHERE name = $1`, [name])
      relatedId = existing.rows[0].id
    }
    await client.query(
      `INSERT INTO ${joinTable} (character_id, ${foreignKey}) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [characterId, relatedId]
    )
  }
}

async function replaceCharacterRelations(client, characterId, values) {
  await replaceNamedRelations(client, characterId, values.powers, 'powers', 'character_powers', 'power_id')
  await replaceNamedRelations(client, characterId, values.teams, 'teams', 'character_teams', 'team_id')
}

async function findCharacter(client, id) {
  const result = await client.query(`${CHARACTER_SELECT} WHERE c.id = $1`, [id])
  return result.rows[0] ? toCharacter(result.rows[0]) : null
}

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/me', requireSignedInUser, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT 1 FROM public.app_admins WHERE user_id = $1',
      [req.authUser.id]
    )
    res.json({ isAdmin: result.rowCount > 0 })
  } catch (error) {
    next(error)
  }
})

// The full source dataset uses its own IDs and table so it cannot overwrite
// the manually curated records in public.characters.
app.get('/api/universe/characters', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT data FROM public.universe_characters ORDER BY name'
    )
    res.json({ count: result.rowCount, results: result.rows.map((row) => row.data) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/universe/characters/:id', async (req, res, next) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: 'Character id must be a positive whole number.' })

  try {
    const result = await pool.query(
      'SELECT data FROM public.universe_characters WHERE source_id = $1',
      [id]
    )
    if (result.rowCount === 0) return res.status(404).json({ error: 'Character not found in the universe catalog.' })
    res.json(result.rows[0].data)
  } catch (error) {
    next(error)
  }
})

app.get('/api/marvel/characters', async (req, res, next) => {
  try {
    const search = typeof req.query.nameStartsWith === 'string'
      ? req.query.nameStartsWith.trim()
      : ''
    const result = search
      ? await pool.query(
        `${CHARACTER_SELECT} WHERE c.name ILIKE $1 OR c.alias ILIKE $1 OR c.real_name ILIKE $1 ORDER BY c.name`,
        [search + '%']
      )
      : await pool.query(`${CHARACTER_SELECT} ORDER BY c.name`)

    res.json({ results: result.rows.map(toCharacter) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/marvel/characters/:id', async (req, res, next) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: 'Character id must be a positive whole number.' })

  try {
    const character = await findCharacter(pool, id)
    if (!character) return res.status(404).json({ error: 'Character not found.' })
    res.json(character)
  } catch (error) {
    next(error)
  }
})

app.post('/api/marvel/characters', requireAdminAccess, async (req, res, next) => {
  const { errors, values } = validateCharacter(req.body, true)
  if (errors.length) return res.status(400).json({ error: 'Please check the character details.', details: errors })

  try {
    const character = await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO characters
          (id, name, real_name, alias, description, origin, alignment, first_appearance, image_url, comics_available)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [values.id, values.name, values.realName, values.alias, values.description, values.origin,
          values.alignment, values.firstAppearance, values.imageUrl, values.comicsAvailable]
      )
      await replaceCharacterRelations(client, values.id, values)
      return findCharacter(client, values.id)
    })
    res.status(201).json(character)
  } catch (error) {
    next(error)
  }
})

app.put('/api/marvel/characters/:id', requireAdminAccess, async (req, res, next) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: 'Character id must be a positive whole number.' })

  const { errors, values } = validateCharacter(req.body)
  if (errors.length) return res.status(400).json({ error: 'Please check the character details.', details: errors })

  try {
    const character = await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE characters
         SET name = $2, real_name = $3, alias = $4, description = $5, origin = $6,
             alignment = $7, first_appearance = $8, image_url = $9, comics_available = $10,
             updated_at = NOW()
         WHERE id = $1 RETURNING id`,
        [id, values.name, values.realName, values.alias, values.description, values.origin,
          values.alignment, values.firstAppearance, values.imageUrl, values.comicsAvailable]
      )
      if (result.rowCount === 0) return null
      await replaceCharacterRelations(client, id, values)
      return findCharacter(client, id)
    })
    if (!character) return res.status(404).json({ error: 'Character not found.' })
    res.json(character)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/marvel/characters/:id', requireAdminAccess, async (req, res, next) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: 'Character id must be a positive whole number.' })

  try {
    const result = await pool.query('DELETE FROM characters WHERE id = $1 RETURNING id', [id])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Character not found.' })
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.use((error, req, res, next) => {
  console.error(error)
  if (error.code === '23505') {
    return res.status(409).json({ error: 'A character with that id already exists.' })
  }
  res.status(500).json({ error: 'Something went wrong while talking to the database.' })
})

app.listen(PORT, () => {
  console.log('Marvel API running at http://localhost:' + PORT)
})
