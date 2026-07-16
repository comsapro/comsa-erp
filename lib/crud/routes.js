import { withErrorHandling } from "@/lib/api/http";

// Genera los handlers de la coleccion (GET lista, POST crea).
export function collectionRoutes(resource) {
  return {
    GET: withErrorHandling((req) => resource.list(req)),
    POST: withErrorHandling((req) => resource.create(req)),
  };
}

// Genera los handlers del recurso individual (GET detalle, PUT actualiza,
// DELETE elimina). Resuelve params (Promise en Next.js 16).
export function itemRoutes(resource) {
  return {
    GET: withErrorHandling(async (req, ctx) => {
      const { id } = await ctx.params;
      return resource.detail(req, id);
    }),
    PUT: withErrorHandling(async (req, ctx) => {
      const { id } = await ctx.params;
      return resource.update(req, id);
    }),
    DELETE: withErrorHandling(async (req, ctx) => {
      const { id } = await ctx.params;
      return resource.remove(req, id);
    }),
  };
}
