"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { ArrowLeft, CheckCircle2, Circle, Paperclip, Pencil, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { CommitmentFormModal } from "@/components/commitments/CommitmentFormModal";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import {
  COMMITMENT_COMMENT_KIND_LABELS,
  MAX_EVIDENCE_BYTES,
} from "@/domains/commitments/constants";
import { CommitmentStatusBadge } from "../CommitmentsClient";

function safeName(name) {
  return String(name || "evidencia")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(0, 120);
}

export default function CommitmentDetailClient({ id }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try {
      setRow(await api.get(`/api/compromisos/${id}`));
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo cargar el compromiso");
    }
  }, [id]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  async function uploadEvidence() {
    if (!file) return null;
    if (file.size > MAX_EVIDENCE_BYTES) throw new Error("La evidencia supera 25 MB");
    const blob = await upload(`commitments/${id}/${Date.now()}-${safeName(file.name)}`, file, {
      access: "private",
      handleUploadUrl: `/api/compromisos/${id}/evidencia`,
      multipart: file.size > 5 * 1024 * 1024,
    });
    return {
      pathname: blob.pathname,
      fileName: file.name,
      contentType: file.type || blob.contentType || null,
      sizeBytes: file.size,
    };
  }

  async function act(action, { requireBody = false } = {}) {
    if (requireBody && !body.trim()) {
      setError("Escribe el motivo en el comentario.");
      return;
    }
    setBusy(action);
    setError("");
    try {
      const evidence = await uploadEvidence();
      const updated = await api.post(`/api/compromisos/${id}/acciones`, {
        action,
        body: body.trim() || null,
        file: evidence,
      });
      setRow(updated);
      setBody("");
      setFile(null);
      toast({
        variant: "success",
        title:
          {
            comment: "Comentario agregado",
            done: "Marcaste tu parte como terminada",
            reopen: "Reabriste tu parte",
            approve: "Compromiso aprobado y cerrado",
            reject: "Se regresó a En proceso",
            cancel: "Compromiso cancelado",
          }[action] || "Listo",
      });
    } catch (err) {
      const fields = err.fieldErrors ? Object.values(err.fieldErrors).flat().join(" · ") : "";
      setError(`${err.message || "No se pudo completar la acción"}${fields ? `: ${fields}` : ""}`);
    } finally {
      setBusy("");
    }
  }

  if (error && !row) return <Alert variant="danger">{error}</Alert>;
  if (!row) return <Skeleton className="h-64 w-full" />;
  const a = row.abilities || {};

  return (
    <div className="space-y-5">
      <PageHeader
        title={row.title}
        description={`Creado por ${row.createdByUser?.name || "—"} · ${formatDateTime(row.createdAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button as={Link} href="/compromisos" size="sm" variant="ghost">
              <ArrowLeft className="h-4 w-4" />
              Compromisos
            </Button>
            {a.canEdit && (
              <Button size="sm" variant="subtle" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            )}
            {a.canCancel && (
              <Button size="sm" variant="ghost" onClick={() => setConfirm("cancel")}>
                Cancelar compromiso
              </Button>
            )}
          </div>
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}

      {row.status === "IN_REVIEW" && (
        <Alert variant={a.canApprove ? "warning" : "info"}>
          {a.canApprove
            ? "Todos los involucrados lo marcaron como terminado. Revisa la evidencia y apruébalo para cerrarlo, o recházalo con un comentario."
            : "Todos terminaron. Falta que quien lo creó (o un administrador) lo apruebe para cerrarlo."}
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardBody className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <CommitmentStatusBadge row={row} />
                <span>
                  <span className="text-content-muted">Inicio:</span> {formatDate(row.startDate)}
                </span>
                <span>
                  <span className="text-content-muted">Entrega:</span>{" "}
                  <span className={row.overdue ? "font-medium text-danger-700" : ""}>{formatDate(row.dueDate)}</span>
                </span>
                {row.closedAt && (
                  <span>
                    <span className="text-content-muted">Cerrado:</span> {formatDateTime(row.closedAt)}
                    {row.closedByUser ? ` · ${row.closedByUser.name}` : ""}
                  </span>
                )}
              </div>
              {row.description && <p className="whitespace-pre-wrap">{row.description}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Seguimiento</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <ol className="space-y-3">
                {row.comments.map((c) => (
                  <li key={c.id} className="rounded-[var(--radius-sm)] border border-border px-3 py-2 text-sm">
                    <p className="text-xs text-content-muted">
                      <span className="font-medium text-content">{c.user?.name}</span>
                      {c.kind !== "COMMENT" && ` · ${COMMITMENT_COMMENT_KIND_LABELS[c.kind] || c.kind}`} ·{" "}
                      {formatDateTime(c.createdAt)}
                    </p>
                    {c.body && <p className="mt-1 whitespace-pre-wrap">{c.body}</p>}
                    {c.filePathname && (
                      <a
                        href={`/api/blob?pathname=${encodeURIComponent(c.filePathname)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-brand-700 hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {c.fileName || "Evidencia"}
                      </a>
                    )}
                  </li>
                ))}
              </ol>

              {a.canComment && (
                <div className="space-y-2 border-t border-border pt-4">
                  <Textarea
                    rows={3}
                    placeholder="Comentario, avance o motivo…"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {file ? (
                      <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-2 py-1 text-xs">
                        <Paperclip className="h-3.5 w-3.5" />
                        {file.name}
                        <button type="button" aria-label="Quitar evidencia" onClick={() => setFile(null)}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : (
                      <Button type="button" size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
                        <Paperclip className="h-4 w-4" />
                        Adjuntar evidencia
                      </Button>
                    )}
                    <div className="ml-auto flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" loading={busy === "comment"} disabled={Boolean(busy)} onClick={() => act("comment")}>
                        Comentar
                      </Button>
                      {a.canMarkDone && (
                        <Button size="sm" loading={busy === "done"} disabled={Boolean(busy)} onClick={() => act("done")}>
                          <CheckCircle2 className="h-4 w-4" />
                          Terminé mi parte
                        </Button>
                      )}
                      {a.canReopenMine && (
                        <Button size="sm" variant="ghost" loading={busy === "reopen"} disabled={Boolean(busy)} onClick={() => act("reopen")}>
                          Reabrir mi parte
                        </Button>
                      )}
                      {a.canReject && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busy === "reject"}
                          disabled={Boolean(busy)}
                          onClick={() => act("reject", { requireBody: true })}
                        >
                          No aprobar
                        </Button>
                      )}
                      {a.canApprove && (
                        <Button size="sm" loading={busy === "approve"} disabled={Boolean(busy)} onClick={() => setConfirm("approve")}>
                          Aprobar y cerrar
                        </Button>
                      )}
                    </div>
                  </div>
                  {a.canMarkDone && (
                    <p className="text-xs text-content-muted">
                      Al marcar tu parte como terminada se incluye el comentario y la evidencia que escribas aquí.
                    </p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <h2 className="text-base font-semibold">Involucrados</h2>
            <p className="text-xs text-content-muted">
              {row.doneCount}/{row.participants.length} terminaron
            </p>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm">
              {row.participants.map((p) => (
                <li key={p.id} className="flex items-start gap-2">
                  {p.completedAt ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-700" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-content-muted" />
                  )}
                  <span>
                    {p.user?.name}
                    <span className="block text-xs text-content-muted">
                      {p.completedAt ? `Terminó ${formatDateTime(p.completedAt)}` : "Pendiente"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <CommitmentFormModal
        open={editing}
        commitment={row}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false);
          setRow(saved);
          toast({ variant: "success", title: "Compromiso actualizado" });
        }}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm === "approve" ? "Aprobar y cerrar" : "Cancelar compromiso"}
        description={
          confirm === "approve"
            ? "El compromiso quedará cerrado. Se incluye el comentario que hayas escrito."
            : "El compromiso se cancelará y dejará de aparecer en los pendientes y en el calendario."
        }
        confirmLabel={confirm === "approve" ? "Aprobar" : "Cancelar compromiso"}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const action = confirm;
          setConfirm(null);
          await act(action);
        }}
      />
    </div>
  );
}
