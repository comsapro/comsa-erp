import { z } from "zod";
import {
  requiredString,
  optionalString,
  optionalEmail,
  statusEnum,
  statusWithDefault,
} from "@/lib/validations/common";

export const ITEM_TYPES = [
  "PRODUCT",
  "RAW_MATERIAL",
  "CONSUMABLE",
  "TOOL",
  "EQUIPMENT",
  "SERVICE",
];

export const ITEM_TYPE_LABELS = {
  PRODUCT: "Producto",
  RAW_MATERIAL: "Materia prima",
  CONSUMABLE: "Consumible",
  TOOL: "Herramienta",
  EQUIPMENT: "Equipo",
  SERVICE: "Servicio",
};

export const SUPPLIER_TYPES = ["PRODUCTS", "SERVICES", "BOTH"];
export const SUPPLIER_TYPE_LABELS = {
  PRODUCTS: "Productos",
  SERVICES: "Servicios",
  BOTH: "Productos y servicios",
};

// -------------------- Almacenes --------------------
export const warehouseCreateSchema = z.object({
  code: requiredString("El codigo es requerido", 50),
  name: requiredString("El nombre es requerido"),
  description: optionalString,
  location: optionalString,
  status: statusWithDefault,
});
export const warehouseUpdateSchema = warehouseCreateSchema.partial();

// -------------------- Categorias --------------------
export const categoryCreateSchema = z.object({
  name: requiredString("El nombre es requerido"),
  description: optionalString,
  parentId: optionalString,
  status: statusWithDefault,
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

// -------------------- Items --------------------
export const itemCreateSchema = z.object({
  sku: requiredString("El SKU es requerido", 60),
  name: requiredString("El nombre es requerido"),
  description: optionalString,
  itemType: z.enum(ITEM_TYPES, { message: "Tipo invalido" }),
  categoryId: optionalString,
  unitOfMeasure: optionalString,
  minimumStock: z.coerce
    .number({ message: "Debe ser numerico" })
    .min(0, "No puede ser negativo")
    .default(0),
  isInventoryControlled: z.coerce.boolean().default(true),
  status: statusWithDefault,
});
export const itemUpdateSchema = itemCreateSchema.partial();

// -------------------- Proveedores --------------------
export const supplierCreateSchema = z.object({
  name: requiredString("El nombre es requerido"),
  legalName: optionalString,
  rfc: optionalString,
  contactName: optionalString,
  phone: optionalString,
  email: optionalEmail,
  address: optionalString,
  supplierType: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(SUPPLIER_TYPES).nullable().optional()
  ),
  productsServices: optionalString,
  status: statusWithDefault,
});
export const supplierUpdateSchema = supplierCreateSchema.partial();

export { statusEnum };
