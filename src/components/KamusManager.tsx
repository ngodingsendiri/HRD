import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Download, Upload, FileText } from "lucide-react";
import * as XLSX from "xlsx";

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
    // identify header if it's the first row and contains "jabatan"
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

export function KamusManager({ csvData, onChange }: KamusManagerProps) {
  const [rows, setRows] = useState<KamusRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRows(parseCsvToRows(csvData || ""));
  }, [csvData]);

  const updateParent = (newRows: KamusRow[]) => {
    onChange(stringifyRowsToCsv(newRows));
  };

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
    updateParent(newRows);
  };

  const handleDeleteRow = (id: string) => {
    const newRows = rows.filter((r) => r.id !== id);
    // re-index
    newRows.forEach((r, idx) => (r.no = String(idx + 1)));
    setRows(newRows);
    updateParent(newRows);
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
    updateParent(newRows);
  };

  const handleExport = () => {
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (data && data.length > 0) {
          const newRows: KamusRow[] = data
            .map((d: any, idx: number) => {
              const no = d["No"] || d["no"] || String(idx + 1);
              const jabatan =
                d["Jabatan"] || d["jabatan"] || d["JABATAN"] || "";
              const kelas = String(
                d["Kelas"] || d["kelas"] || d["Kelas Jabatan"] || "",
              );
              const beban = String(
                d["Beban Kerja"] || d["beban kerja"] || d["Beban"] || "",
              );

              return {
                id: generateId(),
                no: String(no),
                jabatan: String(jabatan),
                kelas: String(kelas),
                beban: String(beban),
              };
            })
            .filter((r) => r.jabatan); // Only import rows with an actual jabatan

          setRows(newRows);
          updateParent(newRows);
        }
      } catch (error) {
        console.error("Error parsing import:", error);
        alert(
          "Gagal membaca file Excel/CSV. Pastikan format kolom sesuai: No, Jabatan, Kelas, Beban Kerja.",
        );
      }
    };
    reader.readAsBinaryString(file);
    // reset input
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
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:scale-95"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" /> Import
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export
          </button>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white ">
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16">
                  No
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[200px]">
                  Jabatan
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32">
                  Kelas
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32">
                  Beban Kerja
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16 text-center">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 group">
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.no}
                      onChange={(e) =>
                        handleCellChange(row.id, "no", e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none transition-colors"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.jabatan}
                      onChange={(e) =>
                        handleCellChange(row.id, "jabatan", e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs font-medium text-slate-700 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none transition-colors"
                      placeholder="Nama Jabatan..."
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.kelas}
                      onChange={(e) =>
                        handleCellChange(row.id, "kelas", e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none transition-colors"
                      placeholder="Misal: 14"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.beban}
                      onChange={(e) =>
                        handleCellChange(row.id, "beban", e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none transition-colors"
                      placeholder="Misal: 1.738"
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
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
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-400 text-sm"
                  >
                    Kamus jabatan kosong. Silakan tambah baris atau import dari
                    file Excel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 border-t border-slate-200 p-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-lg transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Baris Kosong
          </button>
        </div>
      </div>
    </div>
  );
}
