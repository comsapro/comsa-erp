import ExternalQualityClient from "./ExternalQualityClient";

export const metadata = { title: "Consulta Calidad" };

export default async function ExternalQualityPage({ params }) {
  const { token } = await params;
  return <ExternalQualityClient token={token} />;
}
