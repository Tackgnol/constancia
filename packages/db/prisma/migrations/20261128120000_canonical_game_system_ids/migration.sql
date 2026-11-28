-- Rewrites stored Game System ids to their canonical form. gameSystemId is now a closed set
-- (GameSystemId) and writes are enum-validated; older rows may hold an alias or another spelling.
-- The normalisation mirrors normalizeGameSystemLookupKey: trim, lowercase, [\s_:]+ -> '-'.
WITH normalised AS (
  SELECT "id", regexp_replace(lower(trim("gameSystemId")), '[[:space:]_:]+', '-', 'g') AS key
  FROM "campaigns"
)
UPDATE "campaigns" AS c
SET "gameSystemId" = CASE
  WHEN n.key IN (
    'vtm-v5', 'vtm-5', 'vtm5', 'vampire-the-masquerade-5e', 'vampire-the-masquerade-v5',
    'vampire-the-masquerade-5th-edition'
  ) THEN 'vtm-v5'
  WHEN n.key IN ('mork-borg', 'morkborg') THEN 'mork-borg'
  WHEN n.key IN ('5e-srd', '5e', 'srd-5e', 'srd-5.2.1', 'fifth-edition') THEN '5e-srd'
  ELSE c."gameSystemId"
END
FROM normalised AS n
WHERE c."id" = n."id";
