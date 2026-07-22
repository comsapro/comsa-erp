import { installationConceptsResource } from "@/domains/catalogs/resources";
import { collectionRoutes } from "@/lib/crud/routes";

export const { GET, POST } = collectionRoutes(installationConceptsResource);
