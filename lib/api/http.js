import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "@/lib/permissions/errors";

export function jsonOk(data, init = {}) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonCreated(data) {
  return NextResponse.json(data, { status: 201 });
}

// Convierte un error conocido en una respuesta HTTP con el status correcto.
export function toErrorResponse(error) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Datos invalidos", fieldErrors: error.flatten().fieldErrors },
      { status: 422 }
    );
  }
  if (
    error instanceof UnauthorizedError ||
    error instanceof ForbiddenError ||
    error instanceof NotFoundError ||
    error instanceof ConflictError
  ) {
    return NextResponse.json(
      { error: error.message, permission: error.permission },
      { status: error.status }
    );
  }
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message, fieldErrors: error.fieldErrors },
      { status: 422 }
    );
  }
  // Errores de Prisma: unique constraint (P2002).
  if (error?.code === "P2002") {
    const target = Array.isArray(error?.meta?.target)
      ? error.meta.target.join(", ")
      : error?.meta?.target;
    const targetStr = String(target || "unico");
    const isFolio = /folio/i.test(targetStr);
    return NextResponse.json(
      {
        error: isFolio
          ? "Conflicto al generar folio. Reintente; si persiste, sincronice la secuencia de folios."
          : `Ya existe un registro con ese valor (${targetStr}).`,
      },
      { status: 409 }
    );
  }

  console.error("[API] Error no controlado:", error);
  return NextResponse.json(
    { error: "Ocurrio un error interno." },
    { status: 500 }
  );
}

// Envuelve un handler para capturar errores y responder con el status adecuado.
export function withErrorHandling(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
