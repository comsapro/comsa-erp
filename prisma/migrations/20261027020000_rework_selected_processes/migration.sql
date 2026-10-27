-- Procesos seleccionados en la orden de retrabajo de calidad (para imprimir).
ALTER TABLE "quality_rework_orders"
  ADD COLUMN IF NOT EXISTS "selected_processes" JSONB;
