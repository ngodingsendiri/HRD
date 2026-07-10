import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, Download, Upload, FileText, Database } from "lucide-react";

interface KamusRow {
  id: string;
  no: string;
  jabatan: string;
  kelas: string;
  beban: string;
}

interface KamusManagerProps {
  csvData: string;
  onChange: (csv: string) => void;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function parseCsvToRows(csv: string): KamusRow[] {
  const rows = csv.split("\n");
  const kamus: KamusRow[] = [];
  let isFirstRow = true;
  for (const row of rows) {
    if (!row || row.trim() === "") continue;
    const cols = row.split(/;|\t/);
    if (isFirstRow && cols[1]?.toLowerCase().includes("jabatan")) {
      isFirstRow = false;
      continue;
    }
    isFirstRow = false;

    if (cols.length >= 2) {
      kamus.push({
        id: generateId(),
        no: cols[0]?.trim() || "",
        jabatan: cols[1]?.trim() || "",
        kelas: cols[2]?.trim() || "",
        beban: cols[3]?.trim() || "",
      });
    }
  }
  return kamus;
}

function stringifyRowsToCsv(rows: KamusRow[]): string {
  const header = "No;Jabatan;Kelas;Beban Kerja";
  const dataLines = rows.map(
    (r) => `${r.no};${r.jabatan};${r.kelas};${r.beban}`,
  );
  return [header, ...dataLines].join("\n");
}

/** Load SheetJS only when user exports/imports (keeps Settings route light). */
async function loadXlsx() {
  return import("xlsx");
}

export function KamusManager({ csvData, onChange }: KamusManagerProps) {
  const [rows, setRows] = useState<KamusRow[]>(() => parseCsvToRows(csvData || ""));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCsvRef = useRef(csvData);

  // Sync from parent only when csvData actually changes from outside (load/save).
  useEffect(() => {
    if (csvData === lastCsvRef.current) return;
    lastCsvRef.current = csvData;
    setRows(parseCsvToRows(csvData || ""));
  }, [csvData]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const pushParent = useCallback(
    (newRows: KamusRow[], immediate = false) => {
      const csv = stringifyRowsToCsv(newRows);
      lastCsvRef.current = csv;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (immediate) {
        onChange(csv);
        return;
      }
      // Debounce cell edits so typing doesn't re-stringify parent every keystroke.
      debounceRef.current = setTimeout(() => onChange(csv), 200);
    },
    [onChange],
  );

  const handleAddRow = () => {
    const newRow = {
      id: generateId(),
      no: String(rows.length + 1),
      jabatan: "",
      kelas: "",
      beban: "",
    };
    const newRows = [...rows, newRow];
    setRows(newRows);
    pushParent(newRows, true);
  };

  const handleDeleteRow = (id: string) => {
    const newRows = rows.filter((r) => r.id !== id);
    newRows.forEach((r, idx) => {
      r.no = String(idx + 1);
    });
    setRows(newRows);
    pushParent(newRows, true);
  };

  const handleCellChange = (
    id: string,
    field: keyof KamusRow,
    value: string,
  ) => {
    const newRows = rows.map((r) =>
      r.id === id ? { ...r, [field]: value } : r,
    );
    setRows(newRows);
    pushParent(newRows, false);
  };

  const handleExport = async () => {
    const XLSX = await loadXlsx();
    const exportData = rows.map((row) => ({
      No: row.no,
      Jabatan: row.jabatan,
      Kelas: row.kelas,
      "Beban Kerja": row.beban,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kamus_Jabatan");
    XLSX.writeFile(wb, "Kamus_Kelas_Jabatan.xlsx");
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await loadXlsx();
    const headers = ["No", "Jabatan", "Kelas", "Beban Kerja"];
    const sampleData = [
      ["1", "Kepala Dinas", "14", "1"],
      ["2", "Sekretaris", "12", "1"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Kamus");
    XLSX.writeFile(wb, "Template_Kamus_Jabatan.xlsx");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await loadXlsx();
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        if (data && data.length > 0) {
          const newRows: KamusRow[] = data
            .map((d, idx) => {
              const no = d["No"] ?? d["no"] ?? String(idx + 1);
              const jabatan =
                d["Jabatan"] ?? d["jabatan"] ?? d["JABATAN"] ?? "";
              const kelas = String(
                d["Kelas"] ?? d["kelas"] ?? d["Kelas Jabatan"] ?? "",
              );
              const beban = String(
                d["Beban Kerja"] ?? d["beban kerja"] ?? d["Beban"] ?? "",
              );

              return {
                id: generateId(),
                no: String(no),
                jabatan: String(jabatan),
                kelas: String(kelas),
                beban: String(beban),
              };
            })
            .filter((r) => r.jabatan);

          setRows(newRows);
          pushParent(newRows, true);
        }
      } catch (error) {
        console.error("Error parsing import:", error);
        alert(
          "Gagal membaca file Excel/CSV. Pastikan format kolom sesuai: No, Jabatan, Kelas, Beban Kerja.",
        );
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-xs text-slate-500 max-w-lg">
          Kelola data Kamus Jabatan untuk Autofill otomatis. Anda dapat mengetik
          langsung ke tabel, menambah baris, atau memproses massal menggunakan
          Excel.
        </p>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 w-full sm:w-auto">
          <input
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
          <button
            type="button"
            onClick={handleAddRow}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-3 py-2 text-[12px] font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-all active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Tambah
          </button>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-3 py-2 text-[12px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:scale-[0.98]"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Template
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-3 py-2 text-[12px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:scale-[0.98]"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" /> Impor
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-3 py-2 text-[12px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Ekspor
          </button>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16">
                  No
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[200px]">
                  Jabatan
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-32">
                  Kelas
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-32">
                  Beban Kerja
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="group hover:bg-slate-50 transition-colors"
                >
                  <td className="px-2 py-1 border-b border-slate-100">
                    <input
                      type="text"
                      value={row.no}
                      onChange={(e) =>
                        handleCellChange(row.id, "no", e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                    />
                  </td>
                  <td className="px-2 py-1 border-b border-slate-100">
                    <input
                      type="text"
                      value={row.jabatan}
                      onChange={(e) =>
                        handleCellChange(row.id, "jabatan", e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs font-medium text-slate-700 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                      placeholder="Nama Jabatan..."
                    />
                  </td>
                  <td className="px-2 py-1 border-b border-slate-100">
                    <input
                      type="text"
                      value={row.kelas}
                      onChange={(e) =>
                        handleCellChange(row.id, "kelas", e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                      placeholder="Misal: 14"
                    />
                  </td>
                  <td className="px-2 py-1 border-b border-slate-100">
                    <input
                      type="text"
                      value={row.beban}
                      onChange={(e) =>
                        handleCellChange(row.id, "beban", e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                      placeholder="Misal: 1.738"
                    />
                  </td>
                  <td className="px-2 py-1 text-center border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(row.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-95"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center bg-white">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mb-4 border border-slate-100">
                        <Database className="w-6 h-6 text-slate-400" />
                      </div>
                      <h3 className="text-[13px] font-bold text-slate-900">
                        Belum ada Kamus Jabatan
                      </h3>
                      <p className="text-[12px] text-slate-500 mt-1 max-w-sm">
                        Silakan tambah baris kosong untuk mengisi manual, atau
                        impor dari file Excel untuk memproses massal.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
