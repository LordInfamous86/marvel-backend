# Hero Archive API

A Node.js and Express API for a character archive backed by Supabase Postgres. The project demonstrates CRUD routes, validation, parameterized SQL, and relationships between characters, powers, and teams.

## Database setup

For a new database:

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run `database.sql`. It creates the tables and four starter character records.
3. Copy `.env.example` to `.env` and replace the sample `DATABASE_URL` with your Supabase Session Pooler connection string. Set `FRONTEND_URL` to the frontend's origin; for local development, keep `http://localhost:5173`. `PORT` is optional and defaults to `5000`.
4. In Database settings, download the SSL root certificate and save it beside `server.js` as `supabase-root.crt`. The API uses that path by default; set `SSL_ROOT_CERT` only if you save the certificate under a different path.

For the existing project database, run `database-migration-rich-character-data.sql` in the Supabase SQL Editor. It adds character details and the powers/teams relationships while preserving current character rows.

To enrich the four starter profiles and add the first Marvel roster batch, run `database-seed-marvel-batch-one.sql`. It preserves the current names, descriptions, and image URLs; it fills in the new profile fields, adds seven characters, and links powers and teams. It is safe to run more than once. New profiles use the app's initials placeholder until image URLs are added, and their comic counts are set to 0 because counts have not been collected yet.

## Full superhero universe catalog

The full catalog is stored separately from `characters`, so importing source records does not overwrite the project's curated Marvel cards.

1. Run `database-migration-superhero-universe.sql` in the Supabase SQL Editor.
2. In PowerShell, from this backend folder, run `npm.cmd run import:universe`. The importer downloads the Akabab Superhero API's `all.json` file and upserts every source record into `universe_characters`.
3. To import a JSON file already on your computer instead, run `npm.cmd run import:universe -- "C:\path\to\all.json"`.

The importer stores each original record in a JSONB column, including powerstats, appearance, biography, work, connections, and image sizes. It can be run again to refresh the source records. The dataset repository is MIT-licensed, but that license does not clearly establish separate rights to the underlying third-party character artwork; keep the source attribution and verify image rights before public use.

## User accounts and favorites

Run `database-migration-favorites.sql` in the Supabase SQL Editor. It creates a `favorites` table tied to Supabase Auth users and the imported character records. Row Level Security policies let each signed-in user read, add, and remove only their own favorites. The React app uses Supabase Auth and the project's public publishable key; do not put the database password or a secret/service-role key in frontend environment variables.

The certificate lets the API verify its connection to Supabase. The database password stays on the Express server; the browser never receives it. Keep `.env` private and do not upload it.

The schema enables Row Level Security (RLS) on the public tables. This app sends browser requests to Express, which connects to Postgres with the private server-side connection string. The `postgres` role bypasses RLS, so RLS does not secure Express routes by itself. The admin migration and backend Auth settings are required: Express verifies each access token with Supabase Auth and checks the verified user ID against `app_admins` before any character write.

## Admin access

Run `database-migration-admins.sql` in the Supabase SQL Editor. Copy `SUPABASE_URL` and the project's publishable key from the Supabase API settings into the backend `.env` file. The API uses those values to ask Supabase Auth to verify each access token; it never trusts a role supplied by the browser. Add your signed-in account as an admin by running this query in the SQL Editor, replacing the email with the email used for your app account:

    INSERT INTO public.app_admins (user_id)
    SELECT id FROM auth.users WHERE lower(email) = lower('YOUR_SIGN_IN_EMAIL')
    ON CONFLICT (user_id) DO NOTHING;

The backend checks the verified user's ID against `app_admins` before it allows character creation, editing, or deletion. Row Level Security is enabled on the admin table with no browser policies, so ordinary frontend requests cannot read or modify the allowlist directly.

## Data model

- `characters` stores identity, description, origin, alignment, image, and appearance details.
- `powers` and `teams` store reusable names.
- `character_powers` and `character_teams` connect characters to many powers and teams.

The join tables let a character have multiple powers or teams, while the same power or team can belong to multiple characters.

## Run locally

Install dependencies and start the API from this folder:

    npm install
    npm run dev

The API listens at http://localhost:5000. Check the database connection at http://localhost:5000/api/health.

## API routes

- GET `/api/marvel/characters` — list characters
- GET `/api/marvel/characters?nameStartsWith=sp` — search by the start of a name, alias, or real name
- GET `/api/marvel/characters/:id` — get one character with powers and teams
- GET `/api/universe/characters` — list the imported full source catalog
- GET `/api/universe/characters/:id` — get one original source record, including all nested JSON fields
- POST `/api/marvel/characters` — add a character
- PUT `/api/marvel/characters/:id` — update a character
- DELETE `/api/marvel/characters/:id` — delete a character

The API validates incoming data and uses parameterized SQL queries.
