// Parsea los parametros de listado (busqueda, paginacion, orden, filtros)
// desde la URL de un Route Handler.

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export function parseListParams(request, options = {}) {
  const { searchParams } = new URL(request.url);
  const {
    allowedSort = [],
    defaultSort = "createdAt",
    defaultOrder = "desc",
  } = options;

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const rawSize = Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));

  const q = (searchParams.get("q") || "").trim();

  let sort = searchParams.get("sort") || defaultSort;
  if (allowedSort.length && !allowedSort.includes(sort)) {
    sort = defaultSort;
  }
  const order = searchParams.get("order") === "asc" ? "asc" : defaultOrder;

  const status = searchParams.get("status") || "";

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    q,
    sort,
    order,
    status,
    searchParams,
  };
}

// Construye el objeto de respuesta paginada estandar.
export function paginated(rows, total, { page, pageSize }) {
  return {
    data: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
