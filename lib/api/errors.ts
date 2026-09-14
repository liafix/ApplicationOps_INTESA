import { DomainError } from "@/lib/domain/errors";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class PersistenceConflictError extends Error {
  constructor(message = "The persisted workflow changed while this command was being processed.") {
    super(message);
    this.name = "PersistenceConflictError";
  }
}

const BAD_REQUEST_DOMAIN_CODES = new Set([
  "INVALID_EVIDENCE",
  "REMEDIATION_NOT_SUPPORTED"
]);

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof DomainError) {
    const status = BAD_REQUEST_DOMAIN_CODES.has(error.code) ? 400 : 409;
    return new ApiError(status, error.code, error.message);
  }

  if (error instanceof ZodError) {
    return new ApiError(400, "INVALID_INPUT", "The request payload is invalid.", error.issues);
  }

  if (error instanceof PersistenceConflictError) {
    return new ApiError(409, "PERSISTENCE_CONFLICT", error.message);
  }

  return new ApiError(500, "INTERNAL_ERROR", "The request could not be completed.");
}
