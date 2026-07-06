/**
 * Centralized error handling for API responses.
 * Captures only the operation context for diagnostics, never PII.
 */
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface ErrorContext {
  error: string;
  operationType: OperationType;
  path: string | null;
}

/**
 * Normalize an error into a user-friendly message based on the operation.
 * Logs a redacted context to the console for debugging (no auth/PII data).
 */
export function handleApiError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): Error {
  const message = error instanceof Error ? error.message : String(error);

  const ctx: ErrorContext = {
    error: message,
    operationType,
    path,
  };
  console.error("API Error:", JSON.stringify(ctx));

  // Translate to a generic user-facing message (no stack/PII).
  const friendly: Record<OperationType, string> = {
    [OperationType.CREATE]: "Gagal menambahkan data.",
    [OperationType.UPDATE]: "Gagal memperbarui data.",
    [OperationType.DELETE]: "Gagal menghapus data.",
    [OperationType.LIST]: "Gagal memuat data.",
    [OperationType.GET]: "Gagal memuat data.",
    [OperationType.WRITE]: "Gagal menyimpan data.",
  };
  return new Error(friendly[operationType]);
}
