# COMSA ERP - Etapa 1

Base del ERP COMSA: autenticacion, roles y permisos, layout administrativo y
catalogos base (usuarios, roles, clientes, proveedores, almacenes, categorias,
productos e insumos) con bitacora de auditoria.

## Stack

- Next.js 16 (App Router) + React 19
- JavaScript (sin TypeScript)
- Tailwind CSS v4
- PostgreSQL + Prisma 6
- NextAuth v5 (Auth.js) - Credenciales + sesiones JWT
- Zod (validacion), React Hook Form (formularios)
- Lucide React (iconos)

## Requisitos

- Node.js 18.18+ (recomendado 20+)
- Una base de datos PostgreSQL (local o en la nube: Neon, Supabase, RDS)

## Instalacion

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
#   Edita .env y define al menos DATABASE_URL y AUTH_SECRET
#   Genera un secreto: openssl rand -base64 32

# 3. Generar el cliente de Prisma
npm run db:generate

# 4. Aplicar migraciones a la base de datos
npm run db:deploy      # produccion/staging (aplica migraciones existentes)
# o en desarrollo:
npm run db:migrate     # crea/actualiza migraciones

# 5. Cargar datos iniciales (permisos, roles y primer administrador)
npm run db:seed

# 6. Levantar el entorno de desarrollo
npm run dev
```

La app queda disponible en `http://localhost:3000`. Inicia sesion con las
credenciales definidas en `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Variables de entorno

| Variable | Requerida | Descripcion |
| --- | --- | --- |
| `DATABASE_URL` | Si | Cadena de conexion PostgreSQL (usar `sslmode=require` en la nube). |
| `AUTH_SECRET` | Si | Secreto para firmar las sesiones JWT. |
| `AUTH_URL` | Staging/Prod | URL base publica de la app. |
| `AUTH_TRUST_HOST` | Staging/Prod | `true` cuando corre detras de un proxy. |
| `NEXT_PUBLIC_APP_ENV` | No | `local` / `staging` / `production` (indicador de ambiente). |
| `SEED_ADMIN_NAME` | Seed | Nombre del primer administrador. |
| `SEED_ADMIN_EMAIL` | Seed | Correo del primer administrador. |
| `SEED_ADMIN_PASSWORD` | Seed | Contrasena del primer administrador. |
| `SMTP_*` | No | Configuracion SMTP para recuperar acceso (en local se imprime en consola). |

## Ambientes

- **local**: `.env` con `DATABASE_URL` local o de la nube. `NEXT_PUBLIC_APP_ENV=local`.
- **staging**: variables configuradas en el proveedor. `NEXT_PUBLIC_APP_ENV=staging`,
  `AUTH_URL` y `AUTH_TRUST_HOST=true`. Desplegar con `npm run build` y
  `npm run db:deploy` + `npm run db:seed` la primera vez.
- **produccion**: igual que staging con `NEXT_PUBLIC_APP_ENV=production` (oculta el
  indicador de ambiente).

No existen datos hardcodeados: todo dato inicial proviene del seed.

## Scripts

| Script | Descripcion |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Compilacion de produccion. |
| `npm start` | Servidor de produccion. |
| `npm run lint` | ESLint. |
| `npm test` | Pruebas de permisos/menu (Node test runner). |
| `npm run db:generate` | Genera el cliente Prisma. |
| `npm run db:migrate` | Crea/aplica migraciones (desarrollo). |
| `npm run db:deploy` | Aplica migraciones (staging/produccion). |
| `npm run db:seed` | Carga permisos, roles y administrador. |
| `npm run db:studio` | Explorador de datos Prisma. |

## Arquitectura

```
app/                # Rutas (App Router)
  (auth)/           # login, recuperar-acceso
  (dashboard)/      # layout + modulos protegidos
  api/              # Route Handlers (nuestra API)
components/         # UI: layout, forms, tables, feedback, permissions, ui
domains/            # Logica por dominio (schemas Zod + services)
lib/                # auth, db, permissions, audit, api, validations, utils
prisma/             # schema, migraciones y seed
proxy.js            # Proteccion optimista de rutas (Next 16)
auth.js             # Configuracion NextAuth v5
```

## Seguridad y permisos

- La autenticacion usa sesiones JWT (8 h). Un usuario inactivo o eliminado no
  puede iniciar sesion y su sesion se invalida (revalidacion en servidor).
- El menu se genera segun los permisos efectivos (union de roles).
- Toda operacion sensible se valida en el servidor con `requirePermission(code)`;
  un usuario sin permiso recibe **403** aunque llame directamente al endpoint.
- Los cambios importantes se registran en la bitacora (`audit_logs`).
- Los cambios de permisos surten efecto al renovar/validar la sesion.

## Verificacion de permisos (403 directo)

Con el servidor corriendo, autenticado como un usuario sin permiso (ej. Ventas):

```bash
# Deberia responder 403
curl -i http://localhost:3000/api/usuarios --cookie "authjs.session-token=<token>"
```

Las pruebas unitarias del modelo de permisos y del menu se ejecutan con
`npm test`.
