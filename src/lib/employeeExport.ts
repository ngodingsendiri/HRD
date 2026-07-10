import type { FamilyMember } from "../types.js";

/**
 * Build the flat family-related columns for Excel export.
 * Replaces ~95 lines of repetitive "Anak 1..5" object literals.
 *
 * Spouse: the first family member whose relation is Istri/Suami.
 * Children: up to 5 members with relation "Anak", in array order.
 */
export function buildFamilyExportFields(dataKeluarga?: FamilyMember[]): Record<string, string> {
  const spouse = dataKeluarga?.find((k) => k.relation === "Istri" || k.relation === "Suami");
  const anak = dataKeluarga?.filter((k) => k.relation === "Anak").slice(0, 5) ?? [];

  const out: Record<string, string> = {
    "Nama Istri/Suami": spouse?.name ?? "",
    "Tanggal Lahir Pasangan": spouse?.birthDate ?? "",
    // Keep both labels for round-trip with old exports + new template
    "Tanggal Nikah Pasangan": spouse?.marriageDate ?? "",
    "Perkawinan Pasangan": spouse?.marriageDate ?? "",
    "Pekerjaan Pasangan": spouse?.occupation ?? "",
    "Keterangan Pasangan": spouse?.description ?? "",
  };

  for (let i = 0; i < 5; i++) {
    const n = i + 1;
    const a = anak[i];
    out[`Nama Anak ${n}`] = a?.name ?? "";
    out[`Tanggal Lahir Anak ${n}`] = a?.birthDate ?? "";
    out[`Tanggal Nikah Anak ${n}`] = a?.marriageDate ?? "";
    out[`Perkawinan Anak ${n}`] = a?.marriageDate ?? "";
    out[`Pekerjaan Anak ${n}`] = a?.occupation ?? "";
    out[`Keterangan Anak ${n}`] = a?.description ?? "";
  }

  return out;
}
