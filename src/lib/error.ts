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
 * Prefers intentional API error strings (409, validation) over generic text.
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

  const friendly: Record<OperationType, string> = {
    [OperationType.CREATE]: "Gagal menambahkan data.",
    [OperationType.UPDATE]: "Gagal memperbarui data.",
    [OperationType.DELETE]: "Gagal menghapus data.",
    [OperationType.LIST]: "Gagal memuat data.",
    [OperationType.GET]: "Gagal memuat data.",
    [OperationType.WRITE]: "Gagal menyimpan data.",
  };

  // Surface server messages (validation, 409, 403) when present
  const isNetwork =
    /failed to fetch|networkerror|load failed|network request failed/i.test(
      message,
    );
  const isBareStatus = /^Request failed:\s*\d+$/i.test(message);
  if (
    message &&
    !isNetwork &&
    !isBareStatus &&
    message.length > 0 &&
    message.length < 280
  ) {
    return new Error(message);
  }

  return new Error(friendly[operationType]);
}
