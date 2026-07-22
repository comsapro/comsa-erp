import { manufacturingProcessesResource } from "@/domains/catalogs/resources";
import { itemRoutes } from "@/lib/crud/routes";

export const { GET, PUT, DELETE } = itemRoutes(manufacturingProcessesResource);
