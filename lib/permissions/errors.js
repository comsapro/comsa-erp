// Errores de autorizacion usados por la capa de servicios y route handlers.

export class UnauthorizedError extends Error {
  constructor(message = "No autenticado") {
    super(message);
    this.name = "UnauthorizedError";
    this.status = 401;
  }
}

export class ForbiddenError extends Error {
  constructor(message = "No cuentas con permiso para esta accion", permission) {
    super(message);
    this.name = "ForbiddenError";
    this.status = 403;
    this.permission = permission;
  }
}

export class ValidationError extends Error {
  constructor(message = "Datos invalidos", fieldErrors = {}) {
    super(message);
    this.name = "ValidationError";
    this.status = 422;
    this.fieldErrors = fieldErrors;
  }
}

export class NotFoundError extends Error {
  constructor(message = "Recurso no encontrado") {
    super(message);
    this.name = "NotFoundError";
    this.status = 404;
  }
}

export class ConflictError extends Error {
  constructor(message = "Conflicto con un registro existente") {
    super(message);
    this.name = "ConflictError";
    this.status = 409;
  }
}
