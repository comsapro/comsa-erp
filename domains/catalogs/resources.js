import { createResource } from "@/lib/crud/resource";
import {
  warehouseCreateSchema,
  warehouseUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  itemCreateSchema,
  itemUpdateSchema,
  supplierCreateSchema,
  supplierUpdateSchema,
  ITEM_TYPES,
  SUPPLIER_TYPES,
} from "./schemas";

export const warehousesResource = createResource({
  model: "warehouse",
  moduleKey: "warehouses",
  entity: "Warehouse",
  search: ["code", "name", "location", "description"],
  sortable: ["code", "name", "status", "createdAt"],
  createSchema: warehouseCreateSchema,
  updateSchema: warehouseUpdateSchema,
});

export const categoriesResource = createResource({
  model: "productCategory",
  moduleKey: "categories",
  entity: "ProductCategory",
  search: ["name", "description"],
  sortable: ["name", "status", "createdAt"],
  listInclude: { parent: { select: { id: true, name: true } } },
  detailInclude: { parent: { select: { id: true, name: true } } },
  createSchema: categoryCreateSchema,
  updateSchema: categoryUpdateSchema,
});

export const itemsResource = createResource({
  model: "item",
  moduleKey: "items",
  entity: "Item",
  search: ["sku", "name", "description"],
  sortable: ["sku", "name", "itemType", "status", "createdAt"],
  listInclude: { category: { select: { id: true, name: true } } },
  detailInclude: { category: { select: { id: true, name: true } } },
  createSchema: itemCreateSchema,
  updateSchema: itemUpdateSchema,
  buildWhereExtra: (params) => {
    const extra = {};
    const type = params.searchParams.get("itemType");
    if (type && ITEM_TYPES.includes(type)) extra.itemType = type;
    const categoryId = params.searchParams.get("categoryId");
    if (categoryId) extra.categoryId = categoryId;
    return extra;
  },
});

export const suppliersResource = createResource({
  model: "supplier",
  moduleKey: "suppliers",
  entity: "Supplier",
  search: ["name", "legalName", "rfc", "contactName", "email"],
  sortable: ["name", "status", "createdAt"],
  createSchema: supplierCreateSchema,
  updateSchema: supplierUpdateSchema,
  buildWhereExtra: (params) => {
    const extra = {};
    const type = params.searchParams.get("supplierType");
    if (type && SUPPLIER_TYPES.includes(type)) extra.supplierType = type;
    return extra;
  },
});
