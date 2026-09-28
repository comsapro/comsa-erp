"use client";

import { ProductionQualityTab } from "@/components/quality/ProductionQualityTab";

export default function QualityItemClient({ itemId }) {
  return <ProductionQualityTab itemId={itemId} variant="page" />;
}
