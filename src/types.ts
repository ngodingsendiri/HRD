/**
 * Type definitions are derived from the Zod schemas in src/lib/schemas.ts,
 * which are the single source of truth. Prisma schema (prisma/schema.prisma),
 * form validation, and API validation all follow those schemas.
 */
import type {
  FamilyMemberT,
  EmployeeT,
  EmployeeStatusT,
  AppSettingsT,
} from "./lib/schemas.js";

export type FamilyMember = FamilyMemberT;
export type Employee = EmployeeT;
export type EmployeeStatus = EmployeeStatusT;
export type AppSettings = AppSettingsT;
