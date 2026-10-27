-- Intervalos dimensionales: instrumento del catalogo y mediciones multiples.
ALTER TABLE "quality_drawing_measurements"
  ADD COLUMN IF NOT EXISTS "instrument_id" TEXT,
  ADD COLUMN IF NOT EXISTS "readings" JSONB;

CREATE INDEX IF NOT EXISTS "quality_drawing_measurements_instrument_id_idx"
  ON "quality_drawing_measurements"("instrument_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quality_drawing_measurements_instrument_id_fkey'
  ) THEN
    ALTER TABLE "quality_drawing_measurements"
      ADD CONSTRAINT "quality_drawing_measurements_instrument_id_fkey"
      FOREIGN KEY ("instrument_id") REFERENCES "measuring_instruments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
