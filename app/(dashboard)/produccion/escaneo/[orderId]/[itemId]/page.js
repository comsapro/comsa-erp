import ProductionScanClient from "./ProductionScanClient";

export default async function ProductionScanPage({ params }) {
  const { orderId, itemId } = await params;
  return <ProductionScanClient orderId={orderId} itemId={itemId} />;
}
