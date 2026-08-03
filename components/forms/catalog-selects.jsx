"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, toQuery } from "@/lib/api/client";
import {
  categoryCreateSchema,
  issuingCompanyCreateSchema,
  manufacturingProcessCreateSchema,
  installationConceptCreateSchema,
  PROCESS_UNITS,
  PROCESS_UNIT_LABELS,
} from "@/domains/catalogs/schemas";
import {
  requiredString,
  optionalString,
  optionalEmail,
} from "@/lib/validations/common";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField, TextareaField, SelectField } from "@/components/forms/fields";
import { useToast } from "@/components/feedback/ToastProvider";
import { CatalogCombobox } from "@/components/forms/CatalogCombobox";
import { usePermissions } from "@/components/permissions/PermissionsProvider";

function codeFromName(name) {
  const base = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  return base || `NEW-${Date.now().toString(36).toUpperCase()}`;
}

const quickClientSchema = z.object({
  commercialName: requiredString("El nombre comercial es requerido"),
  legalName: optionalString,
  rfc: optionalString,
  phone: optionalString,
  email: optionalEmail,
});

const quickContactSchema = z.object({
  name: requiredString("El nombre es requerido"),
  position: optionalString,
  phone: optionalString,
  email: optionalEmail,
  isPrimary: z.coerce.boolean().default(false),
});

function ModalFormFooter({ onCancel, saving, submitLabel = "Guardar" }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
        Cancelar
      </Button>
      <Button type="submit" loading={saving}>
        {submitLabel}
      </Button>
    </div>
  );
}

export function QuickCreateClientModal({ open, initialName = "", onClose, onCreated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(quickClientSchema),
    defaultValues: {
      commercialName: initialName,
      legalName: "",
      rfc: "",
      phone: "",
      email: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        commercialName: initialName || "",
        legalName: "",
        rfc: "",
        phone: "",
        email: "",
      });
    }
  }, [open, initialName, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      const created = await api.post("/api/clientes", {
        ...values,
        status: "ACTIVE",
        contacts: [],
      });
      toast({ variant: "success", title: "Cliente creado" });
      onCreated?.(created);
      onClose?.();
    } catch (error) {
      if (error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field, { message: messages[0] });
        }
      } else {
        toast({ variant: "error", title: "No se pudo crear", description: error.message });
      }
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title="Nuevo cliente" size="md">
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <TextField label="Nombre comercial" name="commercialName" register={register} error={errors.commercialName?.message} required />
        <TextField label="Razon social" name="legalName" register={register} error={errors.legalName?.message} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="RFC" name="rfc" register={register} error={errors.rfc?.message} />
          <TextField label="Telefono" name="phone" register={register} error={errors.phone?.message} />
        </div>
        <TextField label="Correo" name="email" type="email" register={register} error={errors.email?.message} />
        <ModalFormFooter onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

export function QuickCreateContactModal({
  open,
  clientId,
  initialName = "",
  onClose,
  onCreated,
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(quickContactSchema),
    defaultValues: {
      name: initialName,
      position: "",
      phone: "",
      email: "",
      isPrimary: false,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: initialName || "",
        position: "",
        phone: "",
        email: "",
        isPrimary: false,
      });
    }
  }, [open, initialName, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!clientId) {
      toast({ variant: "error", title: "Selecciona un cliente primero" });
      return;
    }
    setSaving(true);
    try {
      const detail = await api.get(`/api/clientes/${clientId}`);
      const existing = (detail?.contacts || []).map((c) => ({
        name: c.name,
        position: c.position || null,
        phone: c.phone || null,
        email: c.email || null,
        isPrimary: Boolean(c.isPrimary),
      }));
      const nextContacts = [
        ...existing.map((c) =>
          values.isPrimary ? { ...c, isPrimary: false } : c
        ),
        {
          name: values.name,
          position: values.position || null,
          phone: values.phone || null,
          email: values.email || null,
          isPrimary: Boolean(values.isPrimary) || existing.length === 0,
        },
      ];
      const updated = await api.put(`/api/clientes/${clientId}`, {
        contacts: nextContacts,
      });
      const created =
        (updated.contacts || []).find(
          (c) => c.name === values.name && !existing.some((e) => e.name === c.name && e.phone === c.phone)
        ) ||
        (updated.contacts || []).at(-1);
      toast({ variant: "success", title: "Contacto agregado" });
      onCreated?.(created, updated);
      onClose?.();
    } catch (error) {
      if (error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field, { message: messages[0] });
        }
      } else {
        toast({ variant: "error", title: "No se pudo crear", description: error.message });
      }
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title="Nuevo contacto" size="md">
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <TextField label="Nombre" name="name" register={register} error={errors.name?.message} required />
        <TextField label="Puesto" name="position" register={register} error={errors.position?.message} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Telefono" name="phone" register={register} error={errors.phone?.message} />
          <TextField label="Correo" name="email" type="email" register={register} error={errors.email?.message} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-border" {...register("isPrimary")} />
          Marcar como principal
        </label>
        <ModalFormFooter onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

export function QuickCreateIssuingCompanyModal({
  open,
  initialName = "",
  onClose,
  onCreated,
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(
      issuingCompanyCreateSchema.pick({
        commercialName: true,
        legalName: true,
        rfc: true,
        phone: true,
        email: true,
        fiscalAddress: true,
      })
    ),
    defaultValues: {
      commercialName: initialName,
      legalName: "",
      rfc: "",
      phone: "",
      email: "",
      fiscalAddress: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        commercialName: initialName || "",
        legalName: "",
        rfc: "",
        phone: "",
        email: "",
        fiscalAddress: "",
      });
    }
  }, [open, initialName, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      const created = await api.post("/api/empresas-emisoras", {
        ...values,
        status: "ACTIVE",
      });
      toast({ variant: "success", title: "Empresa emisora creada" });
      onCreated?.(created);
      onClose?.();
    } catch (error) {
      if (error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field, { message: messages[0] });
        }
      } else {
        toast({ variant: "error", title: "No se pudo crear", description: error.message });
      }
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title="Nueva empresa emisora" size="md">
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <TextField label="Nombre comercial" name="commercialName" register={register} error={errors.commercialName?.message} required />
        <TextField label="Razon social" name="legalName" register={register} error={errors.legalName?.message} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="RFC" name="rfc" register={register} error={errors.rfc?.message} />
          <TextField label="Telefono" name="phone" register={register} error={errors.phone?.message} />
        </div>
        <TextField label="Correo" name="email" type="email" register={register} error={errors.email?.message} />
        <TextareaField label="Domicilio fiscal" name="fiscalAddress" register={register} error={errors.fiscalAddress?.message} />
        <ModalFormFooter onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

export function QuickCreateProcessModal({ open, initialName = "", onClose, onCreated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(manufacturingProcessCreateSchema),
    defaultValues: {
      code: codeFromName(initialName),
      name: initialName,
      description: "",
      unit: "HOUR",
      defaultRate: 0,
      status: "ACTIVE",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        code: codeFromName(initialName),
        name: initialName || "",
        description: "",
        unit: "HOUR",
        defaultRate: 0,
        status: "ACTIVE",
      });
    }
  }, [open, initialName, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      const created = await api.post("/api/procesos", values);
      toast({ variant: "success", title: "Proceso creado" });
      onCreated?.(created);
      onClose?.();
    } catch (error) {
      if (error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field, { message: messages[0] });
        }
      } else {
        toast({ variant: "error", title: "No se pudo crear", description: error.message });
      }
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title="Nuevo proceso" size="md">
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Codigo" name="code" register={register} error={errors.code?.message} required />
          <TextField label="Nombre" name="name" register={register} error={errors.name?.message} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Unidad" name="unit" register={register} error={errors.unit?.message} required>
            {PROCESS_UNITS.map((u) => (
              <option key={u} value={u}>{PROCESS_UNIT_LABELS[u]}</option>
            ))}
          </SelectField>
          <TextField label="Tarifa default" name="defaultRate" type="number" step="0.01" min="0" register={register} error={errors.defaultRate?.message} />
        </div>
        <TextareaField label="Descripcion" name="description" register={register} error={errors.description?.message} />
        <ModalFormFooter onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

export function QuickCreateInstallationModal({
  open,
  initialName = "",
  onClose,
  onCreated,
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(installationConceptCreateSchema),
    defaultValues: {
      code: codeFromName(initialName),
      name: initialName,
      description: "",
      unit: "SERVICE",
      defaultPrice: 0,
      status: "ACTIVE",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        code: codeFromName(initialName),
        name: initialName || "",
        description: "",
        unit: "SERVICE",
        defaultPrice: 0,
        status: "ACTIVE",
      });
    }
  }, [open, initialName, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      const created = await api.post("/api/instalaciones", values);
      toast({ variant: "success", title: "Concepto creado" });
      onCreated?.(created);
      onClose?.();
    } catch (error) {
      if (error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field, { message: messages[0] });
        }
      } else {
        toast({ variant: "error", title: "No se pudo crear", description: error.message });
      }
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title="Nuevo concepto de instalacion" size="md">
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Codigo" name="code" register={register} error={errors.code?.message} required />
          <TextField label="Nombre" name="name" register={register} error={errors.name?.message} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Unidad" name="unit" register={register} error={errors.unit?.message} required>
            {PROCESS_UNITS.map((u) => (
              <option key={u} value={u}>{PROCESS_UNIT_LABELS[u]}</option>
            ))}
          </SelectField>
          <TextField label="Precio default" name="defaultPrice" type="number" step="0.01" min="0" register={register} error={errors.defaultPrice?.message} />
        </div>
        <TextareaField label="Descripcion" name="description" register={register} error={errors.description?.message} />
        <ModalFormFooter onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

/** Select de catalogo con busqueda + alta rapida. */
export function ClientCatalogSelect({
  value,
  onChange,
  options,
  onOptionsChange,
  error,
  required,
  label = "Cliente",
  remoteSearch = false,
  status = "ACTIVE",
}) {
  const { has } = usePermissions();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [initialName, setInitialName] = useState("");
  const [remoteOptions, setRemoteOptions] = useState(options || []);
  const remoteOptionsRef = useRef(remoteOptions);
  const hydratedValueRef = useRef(null);

  useEffect(() => {
    remoteOptionsRef.current = remoteOptions;
  }, [remoteOptions]);

  // Solo hidratar lista inicial una vez (no en cada busqueda del padre)
  useEffect(() => {
    if (!remoteSearch) return;
    if (remoteOptionsRef.current.length > 0) return;
    if ((options || []).length === 0) return;
    setRemoteOptions(options);
  }, [options, remoteSearch]);

  // Mantener la opcion seleccionada visible aunque no venga en la pagina actual
  useEffect(() => {
    if (!remoteSearch || !value) return;
    if (hydratedValueRef.current === value) return;
    if (remoteOptionsRef.current.some((c) => c.id === value)) {
      hydratedValueRef.current = value;
      return;
    }
    let cancelled = false;
    api
      .get(`/api/clientes/${value}`)
      .then((detail) => {
        if (cancelled || !detail?.id) return;
        hydratedValueRef.current = value;
        setRemoteOptions((prev) => {
          if (prev.some((c) => c.id === detail.id)) return prev;
          return [detail, ...prev];
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value, remoteSearch]);

  const handleSearch = useCallback(
    async (q) => {
      try {
        const res = await api.get(
          `/api/clientes${toQuery({
            status,
            q: q || undefined,
            pageSize: 50,
            sort: "commercialName",
            order: "asc",
          })}`
        );
        const data = res?.data || [];
        // Conservar cliente seleccionado si no viene en la pagina
        setRemoteOptions((prev) => {
          const selected = value
            ? prev.find((c) => c.id === value) ||
              (options || []).find((c) => c.id === value)
            : null;
          if (selected && !data.some((c) => c.id === selected.id)) {
            return [selected, ...data];
          }
          return data;
        });
      } catch (err) {
        toast({
          variant: "error",
          title: "No se pudo buscar clientes",
          description: err.message,
        });
      }
    },
    [status, toast, value, options]
  );

  const list = remoteSearch ? remoteOptions : options || [];

  return (
    <>
      <CatalogCombobox
        label={label}
        value={value}
        onChange={onChange}
        options={list.map((c) => ({
          value: c.id,
          label: c.commercialName,
          description: c.rfc || undefined,
        }))}
        placeholder="Buscar cliente..."
        required={required}
        error={error}
        canCreate={has("clients.create")}
        createLabel="Agregar nuevo cliente"
        onCreateRequest={(name) => {
          setInitialName(name);
          setCreateOpen(true);
        }}
        onSearch={remoteSearch ? handleSearch : undefined}
      />
      <QuickCreateClientModal
        open={createOpen}
        initialName={initialName}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          const next = [created, ...(list || []).filter((c) => c.id !== created.id)];
          if (remoteSearch) setRemoteOptions(next);
          onOptionsChange?.(next);
          onChange?.(created.id);
        }}
      />
    </>
  );
}

export function ContactCatalogSelect({
  value,
  onChange,
  options,
  onOptionsChange,
  clientId,
  error,
  label = "Contacto",
}) {
  const { has } = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [initialName, setInitialName] = useState("");
  const canCreate = Boolean(clientId) && has("clients.edit");

  return (
    <>
      <CatalogCombobox
        label={label}
        value={value}
        onChange={onChange}
        options={(options || []).map((c) => ({
          value: c.id,
          label: `${c.name}${c.isPrimary ? " (principal)" : ""}`,
          description: c.email || c.phone || undefined,
        }))}
        placeholder={clientId ? "Buscar contacto..." : "Selecciona un cliente primero"}
        error={error}
        disabled={!clientId}
        allowClear
        clearLabel="Sin contacto"
        canCreate={canCreate}
        createLabel="Agregar nuevo contacto"
        onCreateRequest={(name) => {
          setInitialName(name);
          setCreateOpen(true);
        }}
      />
      <QuickCreateContactModal
        open={createOpen}
        clientId={clientId}
        initialName={initialName}
        onClose={() => setCreateOpen(false)}
        onCreated={(created, updatedClient) => {
          const next = updatedClient?.contacts || [...(options || []), created];
          onOptionsChange?.(next);
          onChange?.(created?.id || "");
        }}
      />
    </>
  );
}

export function IssuingCompanyCatalogSelect({
  value,
  onChange,
  options,
  onOptionsChange,
  error,
  required,
  label = "Empresa emisora",
}) {
  const { has } = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [initialName, setInitialName] = useState("");

  return (
    <>
      <CatalogCombobox
        label={label}
        value={value}
        onChange={onChange}
        options={(options || []).map((c) => ({
          value: c.id,
          label: c.commercialName,
          description: c.rfc || undefined,
        }))}
        placeholder="Buscar empresa..."
        required={required}
        error={error}
        canCreate={has("issuing_companies.create")}
        createLabel="Agregar nueva empresa"
        onCreateRequest={(name) => {
          setInitialName(name);
          setCreateOpen(true);
        }}
      />
      <QuickCreateIssuingCompanyModal
        open={createOpen}
        initialName={initialName}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          onOptionsChange?.([...(options || []), created]);
          onChange?.(created.id);
        }}
      />
    </>
  );
}

export function SellerCatalogSelect({
  value,
  onChange,
  options,
  error,
  label = "Vendedor",
  required = false,
}) {
  return (
    <CatalogCombobox
      label={label}
      value={value}
      onChange={onChange}
      options={(options || []).map((u) => ({
        value: u.id,
        label: u.name,
        description: u.email || undefined,
      }))}
      placeholder="Buscar vendedor..."
      error={error}
      required={required}
      allowClear={false}
      canCreate={false}
    />
  );
}

export function ProcessCatalogSelect({
  value,
  onChange,
  options,
  onOptionsChange,
  onSelected,
  error,
  label = "Proceso",
  allowClear = false,
  required = true,
}) {
  return (
    <CatalogCombobox
      label={label}
      value={value}
      onChange={(id) => {
        onChange?.(id);
        const found = (options || []).find((p) => p.id === id);
        if (found) onSelected?.(found);
      }}
      options={(options || []).map((p) => ({
        value: p.id,
        label: `${p.code} — ${p.name}`,
        description: PROCESS_UNIT_LABELS[p.unit] || p.unit,
      }))}
      placeholder="Buscar proceso del catalogo..."
      error={error}
      required={required}
      allowClear={allowClear}
      clearLabel="Sin proceso"
      canCreate={false}
    />
  );
}

export function InstallationCatalogSelect({
  value,
  onChange,
  options,
  onOptionsChange,
  onSelected,
  error,
  label = "Concepto",
  allowClear = true,
}) {
  const { has } = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [initialName, setInitialName] = useState("");

  return (
    <>
      <CatalogCombobox
        label={label}
        value={value}
        onChange={(id) => {
          onChange?.(id);
          const found = (options || []).find((c) => c.id === id);
          if (found) onSelected?.(found);
        }}
        options={(options || []).map((c) => ({
          value: c.id,
          label: `${c.code} — ${c.name}`,
          description: PROCESS_UNIT_LABELS[c.unit] || c.unit,
        }))}
        placeholder="Buscar concepto..."
        error={error}
        allowClear={allowClear}
        clearLabel="Manual / sin catalogo"
        canCreate={has("installation_concepts.create")}
        createLabel="Agregar nuevo concepto"
        onCreateRequest={(name) => {
          setInitialName(name);
          setCreateOpen(true);
        }}
      />
      <QuickCreateInstallationModal
        open={createOpen}
        initialName={initialName}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          onOptionsChange?.([...(options || []), created]);
          onChange?.(created.id);
          onSelected?.(created);
        }}
      />
    </>
  );
}

export function QuickCreateCategoryModal({ open, initialName = "", onClose, onCreated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: {
      name: initialName,
      description: "",
      parentId: "",
      status: "ACTIVE",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: initialName || "",
        description: "",
        parentId: "",
        status: "ACTIVE",
      });
    }
  }, [open, initialName, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      const created = await api.post("/api/categorias", {
        ...values,
        parentId: values.parentId || null,
      });
      toast({ variant: "success", title: "Categoria creada" });
      onCreated?.(created);
      onClose?.();
    } catch (error) {
      if (error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field, { message: messages[0] });
        }
      } else {
        toast({ variant: "error", title: "No se pudo crear", description: error.message });
      }
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal open={open} onClose={onClose} title="Nueva categoria" size="md">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField label="Nombre" name="name" register={register} error={errors.name?.message} required />
        <TextareaField label="Descripcion" name="description" register={register} error={errors.description?.message} />
        <ModalFormFooter onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

export function CategoryCatalogSelect({
  value,
  onChange,
  options,
  onOptionsChange,
  error,
  label = "Categoria",
  allowClear = true,
  clearLabel = "Sin categoria",
  excludeId = null,
}) {
  const { has } = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [initialName, setInitialName] = useState("");
  const list = (options || []).filter((c) => c.id !== excludeId);

  return (
    <>
      <CatalogCombobox
        label={label}
        value={value}
        onChange={onChange}
        options={list.map((c) => ({
          value: c.id,
          label: c.name,
          description: c.description || undefined,
        }))}
        placeholder="Buscar categoria..."
        error={error}
        allowClear={allowClear}
        clearLabel={clearLabel}
        canCreate={has("categories.create")}
        createLabel="Agregar nueva categoria"
        onCreateRequest={(name) => {
          setInitialName(name);
          setCreateOpen(true);
        }}
      />
      <QuickCreateCategoryModal
        open={createOpen}
        initialName={initialName}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          onOptionsChange?.([...(options || []), created]);
          onChange?.(created.id);
        }}
      />
    </>
  );
}
