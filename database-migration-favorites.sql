-- Each signed-in user can save their own favorites from the full universe catalog.
-- Supabase Auth and row-level security enforce ownership in the database itself.

CREATE TABLE IF NOT EXISTS public.favorites (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  character_id INTEGER NOT NULL REFERENCES public.universe_characters (source_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, character_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_id_idx
  ON public.favorites (user_id);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.favorites FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.favorites TO authenticated;

DROP POLICY IF EXISTS "Users can read their own favorites" ON public.favorites;
CREATE POLICY "Users can read their own favorites"
  ON public.favorites FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can add their own favorites" ON public.favorites;
CREATE POLICY "Users can add their own favorites"
  ON public.favorites FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can remove their own favorites" ON public.favorites;
CREATE POLICY "Users can remove their own favorites"
  ON public.favorites FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
