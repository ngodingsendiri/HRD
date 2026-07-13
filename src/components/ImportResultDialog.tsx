import { Modal } from "./Modal";
import { btnPrimary, btnSecondary } from "../lib/ui";
import type { BulkImportError, BulkImportWarning } from "../lib/api";
import { CheckCircle2, AlertTriangle, Info, Download } from "lucide-react";

interface ImportResultDialogProps {
  open: boolean;
  onClose: () => void;
  created: number;
  updated: number;
  errors: number;
  skipped?: number;
  errorDetails?: BulkImportError[];
  warnings?: BulkImportWarning[];
  /** Preview only — show apply button */
  dryRun?: boolean;
  mode?: "patch" | "replace";
  onConfirmApply?: () => void;
  applying?: boolean;
}

export function ImportResultDialog({
  open,
  onClose,
  created,
  updated,
  errors,
  skipped = 0,
  errorDetails = [],
  warnings = [],
  dryRun = false,
  mode = "patch",
  onConfirmApply,
  applying = false,
}: ImportResultDialogProps) {
  const ok = errors === 0;
  const canApply = dryRun && ok && created + updated > 0 && onConfirmApply;

  const downloadIssues = async () => {
    const XLSX = await import("xlsx");
    const errRows = errorDetails.map((e) => ({
      Jenis: "Error",
      Baris: e.row,
      Nama: e.nama || "",
      NIP: e.nip || "",
      NIK: e.nik || "",
      Pesan: e.message,
    }));
    const warnRows = warnings.map((w) => ({
      Jenis: "Peringatan",
      Baris: w.row,
      Nama: w.nama || "",
      NIP: w.nip || "",
      NIK: "",
      Pesan: w.message,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([...errRows, ...warnRows]),
      "Masalah_Impor",
    );
    XLSX.writeFile(wb, "Hasil_Cek_Impor_Pegawai.xlsx");
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => !applying && onClose()}
      title={dryRun ? "Pratinjau impor" : "Hasil impor"}
      size="md"
    >
      <div className="space-y-4">
        <div
          className={`flex items-start gap-3 p-3 rounded-xl border ${
            ok
              ? "bg-emerald-50 border-emerald-100 text-emerald-800"
              : "bg-amber-50 border-amber-100 text-amber-900"
          }`}
        >
          {ok ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="text-sm leading-relaxed">
            <p className="font-semibold">
              {created} baru · {updated} diperbarui
              {errors > 0 ? ` · ${errors} ditolak` : ""}
              {skipped > 0 ? ` · ${skipped} baris kosong dilewati` : ""}
            </p>
            <p className="text-xs mt-1 opacity-80">
              Mode:{" "}
              <strong>{mode === "replace" ? "Ganti penuh" : "Patch (aman)"}</strong>
              {dryRun ? " · belum ditulis ke database" : ""}
            </p>
            <p className="text-xs mt-1 opacity-80">
              {dryRun
                ? ok
                  ? canApply
                    ? "Periksa ringkasan, lalu terapkan jika sudah benar."
                    : "Tidak ada baris yang bisa diimpor."
                  : "Perbaiki baris error di Excel, lalu impor ulang."
                : ok
                  ? "Semua baris valid berhasil diproses."
                  : "Beberapa baris gagal. Perbaiki Excel lalu impor ulang baris tersebut."}
            </p>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
              <Info className="w-3.5 h-3.5" />
              Peringatan ({warnings.length}
              {warnings.length >= 50 ? "+" : ""})
            </p>
            <ul className="max-h-28 overflow-y-auto text-[11px] text-slate-600 space-y-1">
              {warnings.slice(0, 20).map((w, i) => (
                <li key={i}>
                  Baris {w.row}
                  {w.nama ? ` · ${w.nama}` : ""}: {w.message}
                </li>
              ))}
              {warnings.length > 20 && (
                <li className="text-slate-400">…dan {warnings.length - 20} lainnya</li>
              )}
            </ul>
          </div>
        )}

        {errorDetails.length > 0 && (
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-slate-500">
                  <th className="px-3 py-2 font-semibold">Baris</th>
                  <th className="px-3 py-2 font-semibold">Nama</th>
                  <th className="px-3 py-2 font-semibold">Pesan</th>
                </tr>
              </thead>
              <tbody>
                {errorDetails.map((e, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 tabular-nums text-slate-600">
                      {e.row}
                    </td>
                    <td className="px-3 py-2 text-slate-800">{e.nama || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {(errorDetails.length > 0 || warnings.length > 0) && (
            <button
              type="button"
              className={btnSecondary}
              disabled={applying}
              onClick={() => void downloadIssues()}
            >
              <Download className="w-3.5 h-3.5" />
              Unduh error/peringatan
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={canApply ? btnSecondary : btnPrimary}
            disabled={applying}
          >
            {dryRun ? "Batal" : "Tutup"}
          </button>
          {canApply && (
            <button
              type="button"
              className={btnPrimary}
              disabled={applying}
              onClick={() => onConfirmApply?.()}
            >
              {applying ? "Menerapkan…" : "Terapkan impor"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
