"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api/client";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/feedback/Alert";
import { useAssignableUsers } from "@/components/kpis/IncidentFormModal";
import { todayMx } from "@/domains/commitments/constants";

function emptyForm() {
  const today = todayMx();
  return { title: "", description: "", startDate: today, dueDate: today, participantIds: [] };
}

/** Alta / edicion de compromiso: que, quienes, inicio y entrega. */
export function CommitmentFormModal({ open, commitment = null, onClose, onSaved }) {
  const users = useAssignableUsers(open);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setError("");
    setQuery("");
    setForm(
      commitment
        ? {
            title: commitment.title,
            description: commitment.description || "",
            startDate: String(commitment.startDate).slice(0, 10),
            dueDate: String(commitment.dueDate).slice(0, 10),
            participantIds: commitment.participants.map((p) => p.userId),
          }
        : emptyForm()
    );
  }, [open, commitment]);

  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => !form.participantIds.includes(u.id))
      .filter((u) => !q || u.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [users, query, form.participantIds]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, description: form.description || null };
      const saved = commitment
        ? await api.put(`/api/compromisos/${commitment.id}`, payload)
        : await api.post("/api/compromisos", payload);
      onSaved(saved);
    } catch (err) {
      const fields = err.fieldErrors ? Object.values(err.fieldErrors).flat().join(" · ") : "";
      setError(`${err.message || "No se pudo guardar"}${fields ? `: ${fields}` : ""}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={commitment ? "Editar compromiso" : "Nuevo compromiso"}
      description="Los involucrados lo verán en sus compromisos y en el calendario. Para cerrarlo, quien lo creó debe aprobarlo."
      size="lg"
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Field label="Compromiso" htmlFor="cm-title" required>
          <Input id="cm-title" value={form.title} onChange={(e) => set({ title: e.target.value })} required maxLength={200} />
        </Field>
        <Field label="Detalle" htmlFor="cm-desc">
          <Textarea id="cm-desc" rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de inicio" htmlFor="cm-start" required>
            <Input id="cm-start" type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} required />
          </Field>
          <Field label="Fecha de entrega" htmlFor="cm-due" required>
            <Input id="cm-due" type="date" min={form.startDate} value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} required />
          </Field>
        </div>
        <Field label="Involucrados" htmlFor="cm-people" required>
          <div className="space-y-2">
            {form.participantIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.participantIds.map((uid) => (
                  <span key={uid} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700">
                    {byId.get(uid)?.name || "Usuario"}
                    <button
                      type="button"
                      aria-label="Quitar"
                      onClick={() => set({ participantIds: form.participantIds.filter((x) => x !== uid) })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input id="cm-people" placeholder="Buscar persona…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {matches.length > 0 && (
              <ul className="max-h-44 divide-y divide-border overflow-y-auto rounded-[var(--radius-sm)] border border-border text-sm">
                {matches.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-left hover:bg-surface-muted"
                      onClick={() => {
                        set({ participantIds: [...form.participantIds, u.id] });
                        setQuery("");
                      }}
                    >
                      {u.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {commitment ? "Guardar" : "Crear compromiso"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
