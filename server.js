require('dotenv').config()

const fs = require('node:fs')
const path = require('node:path')
const cors = require('cors')
const express = require('express')
const { Pool } = require('pg')

const app = express()
const PORT = process.env.PORT || 5000
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
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

function toCharacter(row) {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    comicsAvailable: row.comics_available
  }
}

function parseId(value) {
  if (!/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function validateCharacter(body, includeId = false) {
  const errors = []
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
  const comicsAvailable = body.comicsAvailable === undefined ? 0 : Number(body.comicsAvailable)
  const id = includeId ? parseId(String(body.id ?? '')) : null

  if (includeId && id === null) errors.push('id must be a positive whole number')
  if (!name || name.length > 120) errors.push('name must be between 1 and 120 characters')
  if (description.length > 2000) errors.push('description must be 2000 characters or fewer')
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
    values: { id, name, description, imageUrl: normalizedImageUrl, comicsAvailable }
  }
}

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'connected' })
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
        'SELECT id, name, description, image_url, comics_available FROM characters WHERE name ILIKE $1 ORDER BY name',
        [search + '%']
      )
      : await pool.query(
        'SELECT id, name, description, image_url, comics_available FROM characters ORDER BY name'
      )

    res.json({ results: result.rows.map(toCharacter) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/marvel/characters/:id', async (req, res, next) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: 'Character id must be a positive whole number.' })

  try {
    const result = await pool.query(
      'SELECT id, name, description, image_url, comics_available FROM characters WHERE id = $1',
      [id]
    )
    if (result.rowCount === 0) return res.status(404).json({ error: 'Character not found.' })
    res.json(toCharacter(result.rows[0]))
  } catch (error) {
    next(error)
  }
})

app.post('/api/marvel/characters', async (req, res, next) => {
  const { errors, values } = validateCharacter(req.body, true)
  if (errors.length) return res.status(400).json({ error: 'Please check the character details.', details: errors })

  try {
    const result = await pool.query(
      'INSERT INTO characters (id, name, description, image_url, comics_available) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, description, image_url, comics_available',
      [values.id, values.name, values.description, values.imageUrl, values.comicsAvailable]
    )
    res.status(201).json(toCharacter(result.rows[0]))
  } catch (error) {
    next(error)
  }
})

app.put('/api/marvel/characters/:id', async (req, res, next) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: 'Character id must be a positive whole number.' })

  const { errors, values } = validateCharacter(req.body)
  if (errors.length) return res.status(400).json({ error: 'Please check the character details.', details: errors })

  try {
    const result = await pool.query(
      'UPDATE characters SET name = $2, description = $3, image_url = $4, comics_available = $5, updated_at = NOW() WHERE id = $1 RETURNING id, name, description, image_url, comics_available',
      [id, values.name, values.description, values.imageUrl, values.comicsAvailable]
    )
    if (result.rowCount === 0) return res.status(404).json({ error: 'Character not found.' })
    res.json(toCharacter(result.rows[0]))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/marvel/characters/:id', async (req, res, next) => {
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
