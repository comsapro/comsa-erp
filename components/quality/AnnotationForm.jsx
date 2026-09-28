"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/forms/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import {
  ANNOTATION_TYPES,
  ANNOTATION_TYPE_LABELS,
  ANNOTATION_STATUSES,
  ANNOTATION_STATUS_LABELS,
  MEASUREMENT_UNITS,
  MEASUREMENT_UNIT_LABELS,
} from "@/domains/quality/drawing-constants";
import { calculateMeasurementResult } from "@/domains/quality/calculations";

function previewResult(values) {
  if (values.annotationType !== "MEASUREMENT") return null;
  try {
    return calculateMeasurementResult({
      nominalValue: values.nominalValue,
      measuredValue: values.measuredValue,
      upperTolerance: values.upperTolerance,
      lowerTolerance: values.lowerTolerance,
    });
  } catch {
    return null;
  }
}

const DEFAULTS = {
  annotationType: "MEASUREMENT",
  title: "",
  comment: "",
  status: "OPEN",
  nominalValue: "",
  measuredValue: "",
  upperTolerance: "",
  lowerTolerance: "",
  unit: "mm",
  unitOther: "",
  measurementComments: "",
};

export function AnnotationForm({
  open,
  onClose,
  onSubmit,
  initial,
  loading = false,
  mode = "create",
}) {
  const { register, handleSubmit, watch, reset } = useForm({
    defaultValues: DEFAULTS,
  });
  const type = watch("annotationType");
  const preview = previewResult(watch());

  useEffect(() => {
    if (!open) return;
    reset({
      ...DEFAULTS,
      ...(initial || {}),
      nominalValue: initial?.measurement?.nominalValue ?? initial?.nominalValue ?? "",
      measuredValue: initial?.measurement?.measuredValue ?? initial?.measuredValue ?? "",
      upperTolerance: initial?.measurement?.upperTolerance ?? initial?.upperTolerance ?? "",
      lowerTolerance: initial?.measurement?.lowerTolerance ?? initial?.lowerTolerance ?? "",
      unit: initial?.measurement?.unit && MEASUREMENT_UNITS.includes(initial.measurement.unit)
        ? initial.measurement.unit
        : initial?.measurement?.unit
          ? "other"
          : "mm",
      unitOther: initial?.measurement?.unit && !MEASUREMENT_UNITS.includes(initial.measurement.unit)
        ? initial.measurement.unit
        : "",
      measurementComments: initial?.measurement?.comments || "",
      annotationType: initial?.annotationType || "MEASUREMENT",
      title: initial?.title || "",
      comment: initial?.comment || "",
      status: initial?.status || "OPEN",
    });
  }, [open, initial, reset]);

  const submit = handleSubmit((values) => {
    const payload = {
      annotationType: values.annotationType,
      title: values.title || null,
      comment: values.comment || null,
      status: values.status,
    };
    if (values.annotationType === "MEASUREMENT") {
      payload.measurement = {
        nominalValue: Number(values.nominalValue),
        measuredValue: Number(values.measuredValue),
        upperTolerance: Number(values.upperTolerance),
        lowerTolerance: Number(values.lowerTolerance),
        unit: values.unit,
        unitOther: values.unitOther,
        comments: values.measurementComments || null,
      };
    }
    return onSubmit(payload);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Nuevo inciso" : `Editar inciso ${initial?.label || ""}`}
      size="md"
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Tipo" htmlFor="annotationType" required>
          <Select id="annotationType" {...register("annotationType")}>
            {ANNOTATION_TYPES.map((value) => (
              <option key={value} value={value}>
                {ANNOTATION_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Titulo" htmlFor="title">
          <Input id="title" {...register("title")} />
        </Field>
        <Field label="Comentario" htmlFor="comment">
          <Textarea id="comment" rows={3} {...register("comment")} />
        </Field>

        {type === "MEASUREMENT" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nominal" htmlFor="nominalValue" required>
              <Input id="nominalValue" type="number" step="any" {...register("nominalValue")} />
            </Field>
            <Field label="Medido" htmlFor="measuredValue" required>
              <Input id="measuredValue" type="number" step="any" {...register("measuredValue")} />
            </Field>
            <Field label="Tol. superior" htmlFor="upperTolerance" required>
              <Input id="upperTolerance" type="number" step="any" {...register("upperTolerance")} />
            </Field>
            <Field label="Tol. inferior" htmlFor="lowerTolerance" required>
              <Input id="lowerTolerance" type="number" step="any" {...register("lowerTolerance")} />
            </Field>
            <Field label="Unidad" htmlFor="unit">
              <Select id="unit" {...register("unit")}>
                {MEASUREMENT_UNITS.map((value) => (
                  <option key={value} value={value}>
                    {MEASUREMENT_UNIT_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
            {watch("unit") === "other" ? (
              <Field label="Unidad (otro)" htmlFor="unitOther">
                <Input id="unitOther" {...register("unitOther")} />
              </Field>
            ) : null}
            <Field label="Notas de medicion" htmlFor="measurementComments" className="col-span-2">
              <Input id="measurementComments" {...register("measurementComments")} />
            </Field>
            {preview ? (
              <div className="col-span-2">
                <Badge tone={preview.result === "PASS" ? "success" : "danger"}>
                  Vista previa: {preview.result === "PASS" ? "PASA" : "NO PASA"} ({preview.minimum} a {preview.maximum})
                </Badge>
              </div>
            ) : null}
          </div>
        ) : null}

        {type === "OBSERVATION" ? (
          <Field label="Resultado" htmlFor="status">
            <Select id="status" {...register("status")}>
              {ANNOTATION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {ANNOTATION_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AnnotationForm;
