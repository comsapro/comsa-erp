import { Badge } from "@/components/ui/Badge";
import {
  QUALITY_INSPECTION_STATUS_LABELS,
  QUALITY_INSPECTION_STATUS_TONES,
} from "@/domains/quality/drawing-constants";

export function InspectionSummary({ inspection }) {
  const summary = inspection?.summary || {};
  const version = inspection?.qualityDocumentVersion;
  const item = inspection?.productionItem;
  const order = inspection?.productionOrder;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-xs text-content-muted">Plano</p>
        <p className="text-sm font-medium text-content">
          {version?.originalFilename || "-"}
        </p>
        <p className="text-xs text-content-muted">Rev. {version?.versionNumber ?? "-"}</p>
      </div>
      <div>
        <p className="text-xs text-content-muted">Produccion</p>
        <p className="text-sm font-medium text-content">{order?.folio || "-"}</p>
        <p className="text-xs text-content-muted">
          #{item?.position} {item?.description}
        </p>
      </div>
      <div>
        <p className="text-xs text-content-muted">Estatus</p>
        <Badge tone={QUALITY_INSPECTION_STATUS_TONES[inspection?.status] || "neutral"}>
          {QUALITY_INSPECTION_STATUS_LABELS[inspection?.status] || inspection?.status}
        </Badge>
        <p className="mt-1 text-xs text-content-muted">
          Inspector: {inspection?.inspectedByUser?.name || "-"}
        </p>
      </div>
      <div>
        <p className="text-xs text-content-muted">Incisos</p>
        <p className="text-sm font-medium text-content">
          {summary.annotationCount || 0} · Mediciones {summary.measurementsPassed || 0} PASA / {summary.measurementsFailed || 0} NO PASA
        </p>
        <p className="text-xs text-content-muted">
          Comentarios {summary.comments || 0} · Observaciones {summary.observations || 0}
        </p>
      </div>
    </div>
  );
}

export default InspectionSummary;
