"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileDown,
  FileText,
  MapPin,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/feedback/Alert";
import { Can } from "@/components/permissions/Can";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { PdfViewer } from "@/components/quality/PdfViewer";
import { AnnotationOverlay } from "@/components/quality/AnnotationOverlay";
import { AnnotationSidebar } from "@/components/quality/AnnotationSidebar";
import { AnnotationForm } from "@/components/quality/AnnotationForm";
import { InspectionSummary } from "@/components/quality/InspectionSummary";
import { CompleteInspectionModal } from "@/components/quality/CompleteInspectionModal";
import { EDITABLE_INSPECTION_STATUSES } from "@/domains/quality/drawing-constants";

function blobUrl(pathname) {
  return `/api/blob?pathname=${encodeURIComponent(pathname)}`;
}

export default function InspectionWorkspace({ id }) {
  const { toast } = useToast();
  const { has } = usePermissions();
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [tempMarker, setTempMarker] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    const data = await api.get(`/api/calidad/inspecciones/${id}`);
    setInspection(data);
    return data;
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const editable = EDITABLE_INSPECTION_STATUSES.includes(inspection?.status);
  const canAnnotate = editable && has("quality.annotate");
  const canMove = editable && has("quality.move_annotation");
  const canEdit = editable && has("quality.edit_annotation");
  const canDelete = editable && has("quality.delete_annotation");
  const annotations = inspection?.annotations || [];
  const pageAnnotations = useMemo(
    () => annotations.filter((row) => row.pageNumber === page),
    [annotations, page]
  );
  const selected = annotations.find((row) => row.id === selectedId) || null;
  const pathname = inspection?.qualityDocumentVersion?.pathname;
  const pdfUrl = pathname ? blobUrl(pathname) : null;

  const handlePlace = (coords) => {
    if (!canAnnotate) return;
    setTempMarker(coords);
    setEditing(null);
    setFormOpen(true);
  };

  const saveAnnotation = async (payload) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await api.patch(
          `/api/calidad/inspecciones/${id}/anotaciones/${editing.id}`,
          payload
        );
        toast({ variant: "success", title: "Inciso actualizado" });
      } else {
        await api.post(`/api/calidad/inspecciones/${id}/anotaciones`, {
          ...payload,
          pageNumber: tempMarker?.pageNumber || page,
          xPosition: tempMarker?.xPosition,
          yPosition: tempMarker?.yPosition,
        });
        toast({ variant: "success", title: "Inciso creado" });
      }
      setFormOpen(false);
      setTempMarker(null);
      setPlacing(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast({ variant: "error", title: "No se pudo guardar", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const moveAnnotation = async (row, pos) => {
    try {
      await api.patch(
        `/api/calidad/inspecciones/${id}/anotaciones/${row.id}/mover`,
        { ...pos, pageNumber: row.pageNumber }
      );
      await load();
    } catch (err) {
      toast({ variant: "error", title: "No se pudo mover", description: err.message });
    }
  };

  const removeAnnotation = async () => {
    if (!deleteTarget) return;
    await api.del(
      `/api/calidad/inspecciones/${id}/anotaciones/${deleteTarget.id}`
    );
    setSelectedId(null);
    await load();
    toast({ variant: "success", title: "Inciso eliminado" });
  };

  const complete = async (body) => {
    setSaving(true);
    try {
      await api.post(`/api/calidad/inspecciones/${id}/acciones/complete`, body);
      setCompleteOpen(false);
      await load();
      toast({ variant: "success", title: "Inspeccion cerrada" });
    } catch (err) {
      toast({ variant: "error", title: "No se pudo cerrar", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-content-muted">Cargando inspeccion...</p>;
  }
  if (error) {
    return (
      <Alert variant="danger" title="No se pudo abrir la inspeccion">
        {error}
      </Alert>
    );
  }
  if (!inspection) return null;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={
              inspection.productionItemId
                ? `/calidad/partida/${inspection.productionItemId}`
                : "/calidad"
            }
            className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Partida
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-content">
            Inspeccion {inspection.inspectionNumber}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can permission="quality.annotate">
            <Button
              size="sm"
              variant={placing ? "primary" : "secondary"}
              disabled={!canAnnotate}
              onClick={() => {
                setPlacing((v) => !v);
                setTempMarker(null);
              }}
            >
              <Plus className="h-4 w-4" /> Agregar inciso
            </Button>
          </Can>
          <Can permission="quality.complete">
            <Button
              size="sm"
              disabled={!editable}
              onClick={() => setCompleteOpen(true)}
            >
              Completar
            </Button>
          </Can>
          <Can permission="quality.print">
            <Button
              size="sm"
              variant="subtle"
              as="a"
              href={`/api/calidad/inspecciones/${id}/pdf`}
              target="_blank"
            >
              <FileText className="h-4 w-4" /> Reporte
            </Button>
            <Button
              size="sm"
              variant="subtle"
              as="a"
              href={`/api/calidad/inspecciones/${id}/pdf/plano`}
              target="_blank"
            >
              <FileDown className="h-4 w-4" /> Plano anotado
            </Button>
          </Can>
        </div>
      </div>

      <Card className="px-5 py-4">
        <InspectionSummary inspection={inspection} />
      </Card>

      {placing ? (
        <Alert variant="info" title="Modo colocacion">
          Haz clic sobre el plano para colocar el inciso.
        </Alert>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="flex min-h-[520px] flex-col overflow-hidden">
          {pdfUrl ? (
            <PdfViewer
              url={pdfUrl}
              page={page}
              onPageChange={setPage}
              placementMode={placing}
              onPlace={handlePlace}
            >
              {({ width, height }) => (
                <AnnotationOverlay
                  width={width}
                  height={height}
                  annotations={pageAnnotations}
                  selectedId={selectedId}
                  onSelect={(row) => {
                    setSelectedId(row.id);
                    setPlacing(false);
                  }}
                  onMove={moveAnnotation}
                  canMove={canMove}
                  tempMarker={
                    tempMarker?.pageNumber === page ? tempMarker : null
                  }
                  placementMode={placing}
                />
              )}
            </PdfViewer>
          ) : (
            <p className="p-6 text-sm text-content-muted">Sin archivo PDF.</p>
          )}
        </Card>

        <Card className="flex min-h-[520px] flex-col overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Incisos</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <AnnotationSidebar
              annotations={annotations}
              selectedId={selectedId}
              onSelect={(row) => setSelectedId(row.id)}
              onGoto={(row) => setPage(row.pageNumber)}
            />
          </div>
          {selected ? (
            <div className="space-y-2 border-t border-border p-3">
              <p className="text-sm font-semibold">
                {selected.label} · {selected.title || selected.annotationType}
              </p>
              <p className="text-xs text-content-muted">
                Pagina {selected.pageNumber}
                {selected.measurement
                  ? ` · ${selected.measurement.measuredValue} / ${selected.measurement.nominalValue} ${selected.measurement.unit}`
                  : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(selected);
                      setFormOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    Eliminar
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPage(selected.pageNumber)}
                >
                  <MapPin className="h-4 w-4" /> Ir al marcador
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <AnnotationForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setTempMarker(null);
        }}
        onSubmit={saveAnnotation}
        initial={editing}
        loading={saving}
        mode={editing ? "edit" : "create"}
      />
      <CompleteInspectionModal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onComplete={complete}
        summary={inspection.summary}
        loading={saving}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeAnnotation}
        title="Eliminar inciso"
        description={`Se desactivara el inciso ${deleteTarget?.label || ""}.`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
