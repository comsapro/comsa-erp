"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/feedback/ToastProvider";

// Encapsula create/update/delete contra un endpoint, con toasts y refresh.
export function useCrudActions(endpoint, { onDone, labels = {} } = {}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(values, id) {
    setSaving(true);
    try {
      if (id) {
        await api.put(`${endpoint}/${id}`, values);
        toast({ variant: "success", title: labels.updated || "Registro actualizado" });
      } else {
        await api.post(endpoint, values);
        toast({ variant: "success", title: labels.created || "Registro creado" });
      }
      onDone?.();
      return { ok: true };
    } catch (error) {
      if (error.status === 422 && error.fieldErrors) {
        return { ok: false, fieldErrors: error.fieldErrors };
      }
      toast({ variant: "error", title: "No se pudo guardar", description: error.message });
      return { ok: false, error: error.message };
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    setDeleting(true);
    try {
      await api.del(`${endpoint}/${id}`);
      toast({ variant: "success", title: labels.deleted || "Registro eliminado" });
      onDone?.();
      return { ok: true };
    } catch (error) {
      toast({ variant: "error", title: "No se pudo eliminar", description: error.message });
      return { ok: false };
    } finally {
      setDeleting(false);
    }
  }

  return { save, remove, saving, deleting };
}
