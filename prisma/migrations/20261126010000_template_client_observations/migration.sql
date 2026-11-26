-- Observaciones al cliente en la biblioteca de partidas.
ALTER TABLE "quote_item_templates" ADD COLUMN "client_observations" TEXT;

-- Recupera la separacion en plantillas guardadas desde una partida: antes se
-- unian "internas\nal cliente" en una sola columna. Solo se toca la plantilla
-- cuyo texto coincide exacto con la union de su partida de origen.
UPDATE "quote_item_templates" t
SET "client_observations" = src.client_observations,
    "observations" = NULLIF(src.internal_observations, '')
FROM (
  SELECT DISTINCT ON (qi.template_id)
         qi.template_id, qi.client_observations, qi.internal_observations,
         btrim(concat_ws(E'\n', NULLIF(qi.internal_observations, ''), NULLIF(qi.client_observations, ''))) AS merged
  FROM "quote_items" qi
  WHERE qi.template_id IS NOT NULL
    AND NULLIF(qi.client_observations, '') IS NOT NULL
  ORDER BY qi.template_id, qi.created_at ASC
) src
WHERE src.template_id = t.id
  AND t.observations = src.merged;
