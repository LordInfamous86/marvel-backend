require('dotenv').config()

const fs = require('node:fs')
const path = require('node:path')
const { Pool } = require('pg')

const SOURCE_URL = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json'
const sslRootCertPath = process.env.SSL_ROOT_CERT
  ? path.resolve(__dirname, '..', process.env.SSL_ROOT_CERT)
  : path.join(__dirname, '..', 'supabase-root.crt')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Add the Supabase connection string to the backend .env file.')
  process.exit(1)
}

if (!fs.existsSync(sslRootCertPath)) {
  console.error('Supabase root certificate was not found at ' + sslRootCertPath + '.')
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: fs.readFileSync(sslRootCertPath, 'utf8'),
    rejectUnauthorized: true
  }
})

async function getRecords() {
  const filePath = process.argv[2]
  if (filePath) {
    const absolutePath = path.resolve(filePath)
    console.log('Reading source JSON from ' + absolutePath)
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  }

  console.log('Downloading the full superhero dataset...')
  const response = await fetch(SOURCE_URL)
  if (!response.ok) throw new Error('Dataset download failed with HTTP ' + response.status)
  return response.json()
}

function normalizeRecord(record) {
  if (!record || !Number.isInteger(record.id) || !record.name || !record.slug) {
    throw new Error('The dataset contains a record without a valid id, name, or slug.')
  }

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    publisher: record.biography?.publisher || '',
    data: JSON.stringify(record)
  }
}

async function importRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('The source file did not contain a non-empty JSON array.')
  }

  const normalized = records.map(normalizeRecord)
  const client = await pool.connect()
  let importedCount = 0

  try {
    await client.query('BEGIN')

    const batchSize = 100
    for (let start = 0; start < normalized.length; start += batchSize) {
      const batch = normalized.slice(start, start + batchSize)
      const values = []
      const rows = batch.map((record, index) => {
        const offset = index * 5
        values.push(record.id, record.name, record.slug, record.publisher, record.data)
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::jsonb)`
      })

      const result = await client.query(
        `INSERT INTO public.universe_characters
          (source_id, name, slug, publisher, data)
         VALUES ${rows.join(', ')}
         ON CONFLICT (source_id) DO UPDATE SET
           name = EXCLUDED.name,
           slug = EXCLUDED.slug,
           publisher = EXCLUDED.publisher,
           data = EXCLUDED.data,
           imported_at = NOW()`,
        values
      )
      importedCount += result.rowCount
      console.log(`Imported ${Math.min(start + batchSize, normalized.length)} of ${normalized.length} records...`)
    }

    await client.query('COMMIT')
    console.log(`Finished. ${importedCount} superhero records are in the universe catalog.`)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function main() {
  try {
    const records = await getRecords()
    await importRecords(records)
  } catch (error) {
    console.error('Import failed:', error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
