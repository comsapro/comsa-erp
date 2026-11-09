"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/forms/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api/client";
import {
  ANNOTATION_TYPES,
  ANNOTATION_TYPE_LABELS,
  ANNOTATION_STATUSES,
  ANNOTATION_STATUS_LABELS,
  MEASUREMENT_UNITS,
  MEASUREMENT_UNIT_LABELS,
  MAX_INTERVAL_READINGS,
} from "@/domains/quality/drawing-constants";
import {
  evaluateIntervalReadings,
  resolveMeasurementTolerances,
} from "@/domains/quality/calculations";
import { formatDate } from "@/lib/utils/format";

function readingDefaults(count = 1, existing = []) {
  const size = Math.min(MAX_INTERVAL_READINGS, Math.max(1, Number(count) || 1));
  return Array.from({ length: size }, (_, index) => ({
    index: index + 1,
    value:
      existing[index]?.value != null && existing[index]?.value !== ""
        ? String(existing[index].value)
        : "",
  }));
}

function previewResult(values) {
  if (values.annotationType !== "MEASUREMENT") return null;
  try {
    const readings = (values.readings || [])
      .filter((row) => row.value !== "" && row.value != null)
      .map((row, index) => ({
        index: index + 1,
        value: Number(row.value),
      }));
    if (!readings.length) return null;
    const tolerances = resolveMeasurementTolerances({
      mode: values.rangeMode,
      nominalValue: values.nominalValue,
      upperTolerance: values.upperTolerance,
      lowerTolerance: values.lowerTolerance,
      upperLimit: values.upperLimit,
      lowerLimit: values.lowerLimit,
    });
    return evaluateIntervalReadings({
      nominalValue: values.nominalValue,
      ...tolerances,
      readings,
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
  rangeMode: "NOMINAL",
  upperTolerance: "",
  lowerTolerance: "",
  upperLimit: "",
  lowerLimit: "",
  unit: "mm",
  unitOther: "",
  instrumentId: "",
  readingCount: 1,
  readings: readingDefaults(1),
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
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({ defaultValues: DEFAULTS, shouldUnregister: true });
  const [instruments, setInstruments] = useState([]);
  const values = useWatch({ control });
  const type = values.annotationType;
  const nominalValue = values.nominalValue;
  const readingCount = Number(values.readingCount || 1);
  const instrumentId = values.instrumentId;
  const readings = values.readings || [];
  const preview = previewResult(values);
  const selectedInstrument = instruments.find((row) => row.id === instrumentId);

  useEffect(() => {
    if (!open) return;
    api
      .get("/api/calidad/instrumentos")
      .then((res) => setInstruments(res?.data || []))
      .catch(() => setInstruments([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const existingReadings = initial?.measurement?.readings || [];
    const measuredFallback =
      existingReadings.length > 0
        ? existingReadings
        : initial?.measurement?.measuredValue != null
          ? [{ index: 1, value: initial.measurement.measuredValue }]
          : [];
    const count = Math.max(1, measuredFallback.length || 1);
    reset({
      ...DEFAULTS,
      ...(initial || {}),
      nominalValue: initial?.measurement?.nominalValue ?? initial?.nominalValue ?? "",
      rangeMode: "NOMINAL",
      upperTolerance:
        initial?.measurement?.upperTolerance != null
          ? Number(initial.measurement.upperTolerance)
          : "",
      lowerTolerance:
        initial?.measurement?.lowerTolerance != null
          ? Number(initial.measurement.lowerTolerance)
          : "",
      upperLimit: "",
      lowerLimit: "",
      unit:
        initial?.measurement?.unit && MEASUREMENT_UNITS.includes(initial.measurement.unit)
          ? initial.measurement.unit
          : initial?.measurement?.unit
            ? "other"
            : "mm",
      unitOther:
        initial?.measurement?.unit && !MEASUREMENT_UNITS.includes(initial.measurement.unit)
          ? initial.measurement.unit
          : "",
      instrumentId: initial?.measurement?.instrumentId || "",
      readingCount: count,
      readings: readingDefaults(count, measuredFallback),
      measurementComments: initial?.measurement?.comments || "",
      annotationType: initial?.annotationType || "MEASUREMENT",
      title: initial?.title || "",
      comment: initial?.comment || "",
      status: initial?.status || "OPEN",
    });
  }, [open, initial, reset]);

  useEffect(() => {
    if (type !== "MEASUREMENT") return;
    setValue("readings", readingDefaults(readingCount, getValues("readings") || []));
  }, [readingCount, type, setValue, getValues]);

  const submit = handleSubmit((values) => {
    const payload = {
      annotationType: values.annotationType,
      title: values.title || null,
      comment: values.comment || null,
      status: values.status,
    };
    if (values.annotationType === "MEASUREMENT") {
      const tolerances = resolveMeasurementTolerances({
        mode: values.rangeMode,
        nominalValue: values.nominalValue,
        upperTolerance: values.upperTolerance,
        lowerTolerance: values.lowerTolerance,
        upperLimit: values.upperLimit,
        lowerLimit: values.lowerLimit,
      });
      const readingsPayload = (values.readings || [])
        .map((row, index) => ({
          index: index + 1,
          value: row.value === "" || row.value == null ? null : Number(row.value),
        }))
        .filter((row) => row.value != null && Number.isFinite(row.value));
      payload.measurement = {
        nominalValue: Number(values.nominalValue),
        measuredValue: readingsPayload[0]?.value,
        ...tolerances,
        unit: values.unit,
        unitOther: values.unitOther,
        instrumentId: values.instrumentId || null,
        readings: readingsPayload,
        comments: values.measurementComments || null,
      };
    }
    return onSubmit(payload);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        mode === "create"
          ? "Nuevo intervalo"
          : `Editar intervalo ${initial?.label || ""}`
      }
      size="lg"
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
        <Field label="Titulo / descripcion del intervalo" htmlFor="title">
          <Input id="title" {...register("title")} placeholder="Ej. Diametro exterior" />
        </Field>
        <Field label="Comentario" htmlFor="comment">
          <Textarea id="comment" rows={2} {...register("comment")} />
        </Field>

        {type === "MEASUREMENT" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Valor nominal"
                htmlFor="nominalValue"
                required
                error={errors.nominalValue?.message}
              >
                <Input
                  id="nominalValue"
                  type="number"
                  step="any"
                  {...register("nominalValue", {
                    required: "El valor nominal es obligatorio",
                  })}
                />
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
              <Field
                label="Tipo de rango"
                htmlFor="rangeMode"
                className="col-span-2"
                required
              >
                <Select id="rangeMode" {...register("rangeMode")}>
                  <option value="NOMINAL">Tolerancias respecto al nominal</option>
                  <option value="ABSOLUTE">Límites aceptables absolutos</option>
                </Select>
              </Field>
              <p className="col-span-2 -mt-2 text-xs text-content-muted">
                {values.rangeMode === "ABSOLUTE"
                  ? "Captura los valores mínimo y máximo aceptables. Ejemplo: 249 a 251."
                  : "Captura cuánto puede variar el valor nominal. Ejemplo: nominal 2 y tolerancias 0.05 y -0.05."}
              </p>
              {values.rangeMode === "ABSOLUTE" ? (
                <>
                  <Field
                    label="Límite superior aceptable"
                    htmlFor="upperLimit"
                    required
                    error={errors.upperLimit?.message}
                  >
                    <Input
                      id="upperLimit"
                      type="number"
                      step="any"
                      {...register("upperLimit", {
                        required: "El límite superior es obligatorio",
                        validate: (value) =>
                          Number.isFinite(Number(value)) &&
                          Number(value) >= Number(nominalValue) ||
                          "El límite superior debe ser mayor o igual al valor nominal",
                      })}
                    />
                  </Field>
                  <Field
                    label="Límite inferior aceptable"
                    htmlFor="lowerLimit"
                    required
                    error={errors.lowerLimit?.message}
                  >
                    <Input
                      id="lowerLimit"
                      type="number"
                      step="any"
                      {...register("lowerLimit", {
                        required: "El límite inferior es obligatorio",
                        validate: (value) =>
                          Number.isFinite(Number(value)) &&
                          Number(value) <= Number(nominalValue) ||
                          "El límite inferior debe ser menor o igual al valor nominal",
                      })}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field
                    label="Tol. superior"
                    htmlFor="upperTolerance"
                    required
                    error={errors.upperTolerance?.message}
                  >
                    <Input
                      id="upperTolerance"
                      type="number"
                      step="any"
                      placeholder="Ej. 0.05"
                      {...register("upperTolerance", {
                        required: "La tolerancia superior es obligatoria",
                        validate: (value) =>
                          Number.isFinite(Number(value)) ||
                          "Ingresa una tolerancia válida",
                      })}
                    />
                  </Field>
                  <Field
                    label="Tol. inferior"
                    htmlFor="lowerTolerance"
                    required
                    error={errors.lowerTolerance?.message}
                  >
                    <Input
                      id="lowerTolerance"
                      type="number"
                      step="any"
                      placeholder="Ej. -0.05"
                      {...register("lowerTolerance", {
                        required: "La tolerancia inferior es obligatoria",
                        validate: (value) =>
                          Number.isFinite(Number(value)) ||
                          "Ingresa una tolerancia válida",
                      })}
                    />
                  </Field>
                </>
              )}
              {values.unit === "other" ? (
                <Field label="Unidad (otro)" htmlFor="unitOther" className="col-span-2">
                  <Input id="unitOther" {...register("unitOther")} />
                </Field>
              ) : null}
            </div>

            <Field label="Instrumento de medicion" htmlFor="instrumentId">
              <Select id="instrumentId" {...register("instrumentId")}>
                <option value="">Sin instrumento</option>
                {instruments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.code} · {row.type}
                    {row.serialNumber ? ` · ${row.serialNumber}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {selectedInstrument ? (
              <p className="text-xs text-content-muted">
                Ultima calibracion: {formatDate(selectedInstrument.lastCalibrationAt)} ·
                Proxima: {formatDate(selectedInstrument.nextCalibrationAt)}
              </p>
            ) : null}

            <Field label="Cantidad de mediciones del intervalo" htmlFor="readingCount">
              <Select id="readingCount" {...register("readingCount")}>
                {Array.from({ length: MAX_INTERVAL_READINGS }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-2 sm:grid-cols-2">
              {readings.map((row, index) => (
                <Field
                  key={`reading-${index}`}
                  label={`Medicion ${index + 1}`}
                  htmlFor={`reading-${index}`}
                  required={index === 0}
                >
                  <Input
                    id={`reading-${index}`}
                    type="number"
                    step="any"
                    {...register(`readings.${index}.value`)}
                  />
                </Field>
              ))}
            </div>

            <Field label="Notas de medicion" htmlFor="measurementComments">
              <Input id="measurementComments" {...register("measurementComments")} />
            </Field>

            {preview ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={preview.result === "PASS" ? "success" : "danger"}>
                  Resultado: {preview.result === "PASS" ? "OK" : "NO OK"}
                </Badge>
                <span className="text-xs text-content-muted">
                  Rango {preview.readings[0]?.minimum} a {preview.readings[0]?.maximum}
                </span>
                {preview.readings.map((row) => (
                  <Badge
                    key={row.index}
                    tone={row.result === "PASS" ? "success" : "danger"}
                  >
                    M{row.index}: {row.result === "PASS" ? "OK" : "NO OK"}
                  </Badge>
                ))}
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
