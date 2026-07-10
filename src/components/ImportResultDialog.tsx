import { Modal } from "./Modal";
import { btnPrimary } from "../lib/ui";
import type { BulkImportError } from "../lib/api";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface ImportResultDialogProps {
  open: boolean;
  onClose: () => void;
  created: number;
  updated: number;
  errors: number;
  skipped?: number;
  errorDetails?: BulkImportError[];
}

export function ImportResultDialog({
  open,
  onClose,
  created,
  updated,
  errors,
  skipped = 0,
  errorDetails = [],
}: ImportResultDialogProps) {
  const ok = errors === 0;
  return (
    <Modal isOpen={open} onClose={onClose} title="Hasil impor" size="md">
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
              {ok
                ? "Semua baris valid berhasil diproses."
                : "Beberapa baris gagal validasi. Perbaiki Excel lalu impor ulang baris tersebut."}
            </p>
          </div>
        </div>

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
                    <td className="px-3 py-2 tabular-nums text-slate-600">{e.row}</td>
                    <td className="px-3 py-2 text-slate-800">{e.nama || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={btnPrimary}>
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
