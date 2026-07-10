/**
 * Append-only audit logging for sensitive write paths.
 * Failures are logged to console but never fail the primary request.
 */
import { prisma } from "./db.js";

export type AuditAction =
  | "employee.create"
  | "employee.update"
  | "employee.delete"
  | "employee.bulk_delete"
  | "employee.import"
  | "settings.update"
  | "auth.login"
  | "auth.logout"
  | "api_key.create"
  | "api_key.revoke";

export interface AuditActor {
  id?: string | null;
  email?: string | null;
}

export async function writeAuditLog(input: {
  actor?: AuditActor | null;
  action: AuditAction;
  entityType: "employee" | "settings" | "session" | "system";
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor?.id || null,
        actorEmail: input.actor?.email || null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        meta: (input.meta ?? undefined) as never,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write log", err);
  }
}
