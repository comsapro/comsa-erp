import { Suspense } from "react";
import RecoverAccessForm from "./RecoverAccessForm";

export const metadata = { title: "Recuperar acceso" };

export default async function RecoverAccessPage({ searchParams }) {
  const params = (await searchParams) || {};
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <Suspense>
      <RecoverAccessForm token={token} />
    </Suspense>
  );
}
