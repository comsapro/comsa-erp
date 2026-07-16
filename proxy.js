import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Rutas publicas (no requieren sesion).
const PUBLIC_PATHS = ["/login", "/recuperar-acceso"];

// Chequeo optimista basado en la cookie de sesion (sin acceso a BD).
// La autorizacion real se valida en cada Server Action / Route Handler.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth?.user);
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  // Usuario autenticado que visita login/recuperar -> al inicio.
  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // Usuario sin sesion en ruta privada -> login (conservando destino).
  if (!isLoggedIn && !isPublic) {
    const url = new URL("/login", req.nextUrl);
    if (pathname !== "/") {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Ejecuta el proxy en todo excepto API, assets de Next y archivos estaticos.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
