CREATE TABLE IF NOT EXISTS characters (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  comics_available INTEGER NOT NULL DEFAULT 0 CHECK (comics_available >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS characters_name_idx
  ON characters (lower(name));

INSERT INTO characters (id, name, description, image_url, comics_available)
VALUES
  (1009610, 'Spider-Man (Peter Parker)', 'Bitten by a radioactive spider, Peter Parker''s arachnid abilities give him amazing powers he uses to help others.', 'https://i.annihil.us/u/prod/marvel/i/mg/3/50/526548a343e4b.jpg', 4200),
  (1009368, 'Iron Man (Tony Stark)', 'Wounded, captured and forced to build a weapon by his enemies, billionaire industrialist Tony Stark created an advanced suit of armor.', 'https://i.annihil.us/u/prod/marvel/i/mg/9/c0/527bb7b37ff17.jpg', 2800),
  (1009220, 'Captain America (Steve Rogers)', 'Vowing to serve his country, Steve Rogers took the Super-Soldier serum to become America''s one-man army.', 'https://i.annihil.us/u/prod/marvel/i/mg/3/50/537ba56d3108d.jpg', 3100),
  (1009664, 'Thor', 'As the Norse God of Thunder and Lightning, Thor wields one of the greatest weapons ever made, the enchanted hammer Mjolnir.', 'https://i.annihil.us/u/prod/marvel/i/mg/d/d0/5269657a74350.jpg', 1950)
ON CONFLICT (id) DO NOTHING;

