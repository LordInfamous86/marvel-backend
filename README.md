# Marvel Character Archive API

A Node.js and Express API that stores a small Marvel character collection in Supabase Postgres.

## Database setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run the contents of database.sql. This creates the characters table and inserts four starter rows.
3. Copy .env.example to .env.
4. In the Supabase dashboard, open Connect, choose Session pooler, and copy its connection string into DATABASE_URL in .env. Replace the password placeholder with your database password. Keep .env private and do not upload it.
5. In Database settings, download the SSL root certificate and save the file beside server.js as supabase-root.crt.

The certificate lets the API confirm it is connecting to the real Supabase database. The database password stays on the Express server; the browser never receives it.

## Run locally

From this folder, install the dependencies and start the API:

    npm install
    npm run dev

The API listens at http://localhost:5000. Check the database connection at http://localhost:5000/api/health.

## API routes

- GET /api/marvel/characters — list characters
- GET /api/marvel/characters?nameStartsWith=sp — search by the start of a name
- GET /api/marvel/characters/:id — get one character
- POST /api/marvel/characters — add a character
- PUT /api/marvel/characters/:id — update a character
- DELETE /api/marvel/characters/:id — delete a character

API routes validate incoming data and use parameterized SQL queries.
