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

export const PROCESS_UNITS = [
  "HOUR",
  "PIECE",
  "LOT",
  "METER",
  "KILOGRAM",
  "SERVICE",
];

export const PROCESS_UNIT_LABELS = {
  HOUR: "Hora",
  PIECE: "Pieza",
  LOT: "Lote",
  METER: "Metro",
  KILOGRAM: "Kilogramo",
  SERVICE: "Servicio",
};

// -------------------- Empresas emisoras --------------------
export const issuingCompanyCreateSchema = z.object({
  commercialName: requiredString("El nombre comercial es requerido"),
  legalName: optionalString,
  rfc: optionalString,
  fiscalAddress: optionalString,
  phone: optionalString,
  email: optionalEmail,
  website: optionalString,
  logoUrl: optionalString,
  bankDetails: optionalString,
  legalText: optionalString,
  quotationFooter: optionalString,
  status: statusWithDefault,
});
export const issuingCompanyUpdateSchema = issuingCompanyCreateSchema.partial();

// -------------------- Procesos de manufactura --------------------
export const manufacturingProcessCreateSchema = z.object({
  code: requiredString("El codigo es requerido", 50),
  name: requiredString("El nombre es requerido"),
  description: optionalString,
  unit: z.enum(PROCESS_UNITS, { message: "Unidad invalida" }),
  defaultRate: z.coerce.number().min(0, "No puede ser negativo").default(0),
  status: statusWithDefault,
});
export const manufacturingProcessUpdateSchema =
  manufacturingProcessCreateSchema.partial();

// -------------------- Conceptos de instalacion --------------------
export const installationConceptCreateSchema = z.object({
  code: requiredString("El codigo es requerido", 50),
  name: requiredString("El nombre es requerido"),
  description: optionalString,
  unit: z.enum(PROCESS_UNITS, { message: "Unidad invalida" }),
  defaultPrice: z.coerce.number().min(0, "No puede ser negativo").default(0),
  status: statusWithDefault,
});
export const installationConceptUpdateSchema =
  installationConceptCreateSchema.partial();

export { statusEnum };
