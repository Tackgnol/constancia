-- Moves the legacy systemData.clan into systemData.archetypes under the system's primary archetype key
-- (VTM: clan, Mork Borg: class). Other systems never stored clan.
UPDATE "characters" AS c
SET "systemData" = (c."systemData" - 'clan') || jsonb_build_object(
  'archetypes',
  COALESCE(
    CASE WHEN jsonb_typeof(c."systemData" -> 'archetypes') = 'object' THEN c."systemData" -> 'archetypes' END,
    '{}'::jsonb
  ) || jsonb_build_object(
    CASE WHEN lower(camp."gameSystemId") IN ('mork-borg', 'morkborg') THEN 'class' ELSE 'clan' END,
    c."systemData" -> 'clan'
  )
)
FROM "campaigns" AS camp
WHERE c."campaignId" = camp."id"
  AND jsonb_typeof(c."systemData" -> 'clan') = 'string'
  AND c."systemData" ->> 'clan' <> '';

-- Empty or non-string leftovers carry no choice.
UPDATE "characters" SET "systemData" = "systemData" - 'clan' WHERE "systemData" ? 'clan';
