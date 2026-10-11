-- Marvel batch one. Safe to run more than once.
-- Existing character names, descriptions, images, and comic counts are preserved.
-- New character descriptions below are written for this project; IDs follow Marvel's character records.

BEGIN;

-- Fill the richer profile fields on the four starter characters.
UPDATE characters AS c
SET real_name = details.real_name,
    alias = details.alias,
    origin = details.origin,
    alignment = 'hero',
    first_appearance = details.first_appearance,
    updated_at = NOW()
FROM (VALUES
  (1009610::bigint, 'Peter Parker', 'Spider-Man', 'A young photographer gained spider-like abilities after being bitten by a radioactive spider.', 'Amazing Fantasy #15 (1962)'),
  (1009368::bigint, 'Tony Stark', 'Iron Man', 'An inventive industrialist built a powered suit of armor to escape captivity and protect people.', 'Tales of Suspense #39 (1963)'),
  (1009220::bigint, 'Steve Rogers', 'Captain America', 'A determined volunteer became a super-soldier and carries his mission to protect others into the present day.', 'Captain America Comics #1 (1941)'),
  (1009664::bigint, 'Thor Odinson', 'Thor; God of Thunder', 'An Asgardian prince and protector of the realms who commands thunder and lightning.', 'Journey into Mystery #83 (1962)')
) AS details(id, real_name, alias, origin, first_appearance)
WHERE c.id = details.id;

-- Add the next seven characters. Existing rows with these IDs are left untouched.
INSERT INTO characters
  (id, name, real_name, alias, description, origin, alignment, first_appearance, image_url, comics_available)
VALUES
  (1009351, 'Hulk', 'Bruce Banner', 'The Hulk', 'Scientist Bruce Banner transforms into the Hulk after exposure to gamma radiation. His strength grows with his anger, making control and responsibility central to his story.', 'A gamma-ray experiment transformed Bruce Banner, linking his life to a powerful alter ego.', 'hero', 'The Incredible Hulk #1 (1962)', NULL, 0),
  (1009189, 'Black Widow', 'Natasha Romanoff', 'Black Widow; Natasha Romanova', 'A highly trained former spy who uses discipline, strategy, and skill to protect people and make amends for her past.', 'Trained as a spy from a young age, Natasha later chose to use her abilities in service of others.', 'hero', 'Tales of Suspense #52 (1964)', NULL, 0),
  (1009187, 'Black Panther', 'T’Challa', 'Black Panther; King of Wakanda', 'The king and protector of Wakanda, T’Challa combines sharp scientific insight, tactical skill, and the traditions of the Black Panther mantle.', 'T’Challa inherited the responsibility of protecting Wakanda and earned the mantle of the Black Panther.', 'hero', 'Fantastic Four #52 (1966)', NULL, 0),
  (1009282, 'Doctor Strange', 'Stephen Strange', 'Doctor Strange; Sorcerer Supreme', 'Once a gifted surgeon, Stephen Strange studied the mystic arts and became a guardian against supernatural threats.', 'After an accident ended his surgical career, Strange traveled in search of healing and discovered the mystic arts.', 'hero', 'Strange Tales #110 (1963)', NULL, 0),
  (1010338, 'Captain Marvel', 'Carol Danvers', 'Captain Marvel; Ms. Marvel; Binary', 'A former Air Force pilot whose courage and cosmic abilities make her a powerful defender on Earth and beyond.', 'An encounter involving Kree technology changed Danvers and gave her extraordinary abilities.', 'hero', 'Marvel Super-Heroes #13 (1968; as Carol Danvers)', NULL, 0),
  (1009562, 'Scarlet Witch', 'Wanda Maximoff', 'Scarlet Witch', 'Wanda Maximoff wields powerful magic that can alter energy and reshape reality, while working to understand the effects of her abilities.', 'Wanda’s magical abilities developed into formidable chaos magic.', 'hero', 'X-Men #4 (1964)', NULL, 0),
  (1009718, 'Wolverine', 'James Howlett (Logan)', 'Wolverine; Logan', 'A determined mutant with a powerful healing factor, heightened senses, and adamantium claws. His long life has been shaped by difficult choices and fierce loyalty.', 'Born James Howlett, he later lived for years under the name Logan and became known as Wolverine.', 'hero', 'The Incredible Hulk #180–181 (1974)', NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- Add reusable team names, including X-Men as a team rather than a character card.
INSERT INTO teams (name)
VALUES ('Avengers'), ('X-Men')
ON CONFLICT (name) DO NOTHING;

-- Add powers without duplicating shared powers.
INSERT INTO powers (name)
SELECT DISTINCT power_name
FROM (VALUES
  ('Spider-Man', 'Enhanced strength'), ('Spider-Man', 'Wall-crawling'), ('Spider-Man', 'Spider-sense'), ('Spider-Man', 'Web-shooters'),
  ('Iron Man', 'Powered armor'), ('Iron Man', 'Flight'), ('Iron Man', 'Energy weapons'),
  ('Captain America', 'Enhanced strength'), ('Captain America', 'Enhanced endurance'), ('Captain America', 'Master combatant'),
  ('Thor', 'Superhuman strength'), ('Thor', 'Lightning control'), ('Thor', 'Weather manipulation'),
  ('Hulk', 'Gamma-powered strength'), ('Hulk', 'Durability'), ('Hulk', 'Regeneration'),
  ('Black Widow', 'Espionage'), ('Black Widow', 'Martial arts'), ('Black Widow', 'Marksmanship'),
  ('Black Panther', 'Enhanced senses'), ('Black Panther', 'Vibranium suit'), ('Black Panther', 'Tactical expertise'),
  ('Doctor Strange', 'Sorcery'), ('Doctor Strange', 'Astral projection'), ('Doctor Strange', 'Mystic shields'),
  ('Captain Marvel', 'Flight'), ('Captain Marvel', 'Energy absorption'), ('Captain Marvel', 'Photon blasts'),
  ('Scarlet Witch', 'Chaos magic'), ('Scarlet Witch', 'Energy manipulation'), ('Scarlet Witch', 'Reality alteration'),
  ('Wolverine', 'Healing factor'), ('Wolverine', 'Enhanced senses'), ('Wolverine', 'Adamantium claws')
) AS p(character_name, power_name)
ON CONFLICT (name) DO NOTHING;

-- Link characters to their powers. Re-running this file will not duplicate links.
INSERT INTO character_powers (character_id, power_id)
SELECT c.id, p.id
FROM (VALUES
  (1009610::bigint, 'Enhanced strength'), (1009610, 'Wall-crawling'), (1009610, 'Spider-sense'), (1009610, 'Web-shooters'),
  (1009368::bigint, 'Powered armor'), (1009368, 'Flight'), (1009368, 'Energy weapons'),
  (1009220::bigint, 'Enhanced strength'), (1009220, 'Enhanced endurance'), (1009220, 'Master combatant'),
  (1009664::bigint, 'Superhuman strength'), (1009664, 'Lightning control'), (1009664, 'Weather manipulation'),
  (1009351::bigint, 'Gamma-powered strength'), (1009351, 'Durability'), (1009351, 'Regeneration'),
  (1009189::bigint, 'Espionage'), (1009189, 'Martial arts'), (1009189, 'Marksmanship'),
  (1009187::bigint, 'Enhanced senses'), (1009187, 'Vibranium suit'), (1009187, 'Tactical expertise'),
  (1009282::bigint, 'Sorcery'), (1009282, 'Astral projection'), (1009282, 'Mystic shields'),
  (1010338::bigint, 'Flight'), (1010338, 'Energy absorption'), (1010338, 'Photon blasts'),
  (1009562::bigint, 'Chaos magic'), (1009562, 'Energy manipulation'), (1009562, 'Reality alteration'),
  (1009718::bigint, 'Healing factor'), (1009718, 'Enhanced senses'), (1009718, 'Adamantium claws')
) AS mapping(character_id, power_name)
JOIN characters c ON c.id = mapping.character_id
JOIN powers p ON p.name = mapping.power_name
ON CONFLICT DO NOTHING;

-- Connect the current Avengers and Wolverine to the X-Men.
INSERT INTO character_teams (character_id, team_id)
SELECT c.id, t.id
FROM (VALUES
  (1009610::bigint, 'Avengers'),
  (1009368::bigint, 'Avengers'),
  (1009220::bigint, 'Avengers'),
  (1009664::bigint, 'Avengers'),
  (1009351::bigint, 'Avengers'),
  (1009189::bigint, 'Avengers'),
  (1009187::bigint, 'Avengers'),
  (1009282::bigint, 'Avengers'),
  (1010338::bigint, 'Avengers'),
  (1009562::bigint, 'Avengers'),
  (1009718::bigint, 'X-Men')
) AS mapping(character_id, team_name)
JOIN characters c ON c.id = mapping.character_id
JOIN teams t ON t.name = mapping.team_name
ON CONFLICT DO NOTHING;

COMMIT;
