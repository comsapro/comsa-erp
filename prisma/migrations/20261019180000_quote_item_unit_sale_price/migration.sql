-- Precio de venta por pieza de la partida. NULL en partidas calculadas antes de
-- multiplicar por cantidad (se imprimen con saleSubtotal / quantity).

ALTER TABLE "quote_items"
  ADD COLUMN IF NOT EXISTS "unit_sale_price" DECIMAL(14,2);
