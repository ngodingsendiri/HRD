import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, Download, Upload, FileText, Database } from "lucide-react";

interface PetaRow {
  id: string;
  no: string;
  bidang: string;
  jabatan: string;
  kelas: string;
  kebutuhan: string;
}

interface PetaManagerProps {
  csvData: string;
  onChange: (csv: string) => void;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function parseCsvToRows(csv: string): PetaRow[] {
  const rows = csv.split("\n");
  const peta: PetaRow[] = [];
  let isFirstRow = true;
  for (const row of rows) {
    if (!row || row.trim() === "") continue;
    const cols = row.split(/;|\t/);
    if (isFirstRow && cols[1]?.toLowerCase().includes("bidang")) {
      isFirstRow = false;
      continue;
    }
    isFirstRow = false;

    if (cols.length >= 2) {
      peta.push({
        id: generateId(),
        no: cols[0]?.trim() || "",
        bidang: cols[1]?.trim() || "",
        jabatan: cols[2]?.trim() || "",
        kelas: cols[3]?.trim() || "",
        kebutuhan: cols[4]?.trim() || "",
      });
    }
  }
  return peta;
}

function stringifyRowsToCsv(rows: PetaRow[]): string {
  const header = "No;Bidang;Jabatan;Kelas;Kebutuhan";
  const dataLines = rows.map(
    (r) => `${r.no};${r.bidang};${r.jabatan};${r.kelas};${r.kebutuhan}`,
  );
  return [header, ...dataLines].join("\n");
}

async function loadXlsx() {
  return import("xlsx");
}

export function PetaManager({ csvData, onChange }: PetaManagerProps) {
  const [rows, setRows] = useState<PetaRow[]>(() => parseCsvToRows(csvData || ""));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCsvRef = useRef(csvData);

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
    (newRows: PetaRow[], immediate = false) => {
      const csv = stringifyRowsToCsv(newRows);
      lastCsvRef.current = csv;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (immediate) {
        onChange(csv);
        return;
      }
      debounceRef.current = setTimeout(() => onChange(csv), 200);
    },
    [onChange],
  );

  const handleAddRow = () => {
    const newRow = {
      id: generateId(),
      no: String(rows.length + 1),
      bidang: "",
      jabatan: "",
      kelas: "",
      kebutuhan: "",
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
    field: keyof PetaRow,
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
      Bidang: row.bidang,
      Jabatan: row.jabatan,
      Kelas: row.kelas,
      Kebutuhan: row.kebutuhan,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Peta_Jabatan");
    XLSX.writeFile(wb, "Master_Peta_Jabatan.xlsx");
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await loadXlsx();
    const headers = ["No", "Bidang", "Jabatan", "Kelas", "Kebutuhan"];
    const sampleData = [
      ["1", "Sekretariat", "Kepala Dinas", "14", "1"],
      ["2", "Sekretariat", "Sekretaris", "12", "1"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Peta");
    XLSX.writeFile(wb, "Template_Master_Peta_Jabatan.xlsx");
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
          const newRows: PetaRow[] = data
            .map((d, idx) => {
              const no = d["No"] ?? d["no"] ?? String(idx + 1);
              const bidang = d["Bidang"] ?? d["bidang"] ?? "";
              const jabatan =
                d["Jabatan"] ?? d["jabatan"] ?? d["JABATAN"] ?? "";
              const kelas = String(
                d["Kelas"] ?? d["kelas"] ?? d["Kelas Jabatan"] ?? "",
              );
              const kebutuhan = String(
                d["Kebutuhan"] ?? d["kebutuhan"] ?? "",
              );

              return {
                id: generateId(),
                no: String(no),
                bidang: String(bidang),
                jabatan: String(jabatan),
                kelas: String(kelas),
                kebutuhan: String(kebutuhan),
              };
            })
            .filter((r) => r.jabatan);

          setRows(newRows);
          pushParent(newRows, true);
        }
      } catch (error) {
        console.error("Error parsing import:", error);
        alert(
          "Gagal membaca file Excel/CSV. Pastikan format kolom sesuai: No, Bidang, Jabatan, Kelas, Kebutuhan.",
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
          Kelola Master Peta Jabatan untuk menghitung analisis Bezetting secara
          akurat. Anda dapat mengetik langsung ke tabel, menambah baris, atau
          memproses massal menggunakan Excel.
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
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[140px]">
                  Bidang
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[180px]">
                  Jabatan
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-24">
                  Kelas
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-28">
                  Kebutuhan
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
                      value={row.bidang}
                      onChange={(e) =>
                        handleCellChange(row.id, "bidang", e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                      placeholder="Bidang..."
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
                      placeholder="Jabatan..."
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
                    />
                  </td>
                  <td className="px-2 py-1 border-b border-slate-100">
                    <input
                      type="text"
                      value={row.kebutuhan}
                      onChange={(e) =>
                        handleCellChange(row.id, "kebutuhan", e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
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
                  <td colSpan={6} className="px-6 py-16 text-center bg-white">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mb-4 border border-slate-100">
                        <Database className="w-6 h-6 text-slate-400" />
                      </div>
                      <h3 className="text-[13px] font-bold text-slate-900">
                        Belum ada Peta Jabatan
                      </h3>
                      <p className="text-[12px] text-slate-500 mt-1 max-w-sm">
                        Tambah baris manual atau impor dari Excel.
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
