-- ADR 0001: resolver pipeline blocks are named by role. Config is unchanged.
UPDATE "events"
SET "pipeline" = (
  SELECT jsonb_agg(
    CASE block ->> 'blockType'
      WHEN 'vtm-pool-resolver' THEN jsonb_set(block, '{blockType}', '"test-resolver"')
      WHEN 'vtm-insight-resolver' THEN jsonb_set(block, '{blockType}', '"insight-resolver"')
      ELSE block
    END
    ORDER BY position
  )
  FROM jsonb_array_elements("pipeline") WITH ORDINALITY AS item(block, position)
)
WHERE jsonb_typeof("pipeline") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("pipeline") AS item(block)
    WHERE block ->> 'blockType' IN ('vtm-pool-resolver', 'vtm-insight-resolver')
  );
