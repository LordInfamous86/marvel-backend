-- Add a separate catalog for the complete Akabab Superhero API dataset.
-- The existing public.characters tables and their manually curated records remain unchanged.

CREATE TABLE IF NOT EXISTS public.universe_characters (
  source_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  publisher TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS universe_characters_name_idx
  ON public.universe_characters (lower(name));

CREATE INDEX IF NOT EXISTS universe_characters_publisher_idx
  ON public.universe_characters (publisher);

ALTER TABLE public.universe_characters ENABLE ROW LEVEL SECURITY;
