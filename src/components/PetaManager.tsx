import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Download, Upload, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";

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
    (r) => `${r.no};${r.bidang};${r.jabatan};${r.kelas};${r.kebutuhan}`
  );
  return [header, ...dataLines].join("\n");
}

export function PetaManager({ csvData, onChange }: PetaManagerProps) {
  const [rows, setRows] = useState<PetaRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRows(parseCsvToRows(csvData || ""));
  }, [csvData]);

  const updateParent = (newRows: PetaRow[]) => {
    onChange(stringifyRowsToCsv(newRows));
  };

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
    updateParent(newRows);
  };

  const handleDeleteRow = (id: string) => {
    const newRows = rows.filter((r) => r.id !== id);
    newRows.forEach((r, idx) => (r.no = String(idx + 1)));
    setRows(newRows);
    updateParent(newRows);
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
    updateParent(newRows);
  };

  const handleExport = () => {
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

  
  const handleDownloadTemplate = () => {
    const headers = [
      "No",
      "Bidang",
      "Jabatan",
      "Kelas",
      "Kebutuhan",
    ];

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
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (data && data.length > 0) {
          const newRows: PetaRow[] = data
            .map((d: any, idx: number) => {
              const no = d["No"] || d["no"] || String(idx + 1);
              const bidang = d["Bidang"] || d["bidang"] || "";
              const jabatan =
                d["Jabatan"] || d["jabatan"] || d["JABATAN"] || "";
              const kelas = String(
                d["Kelas"] || d["kelas"] || d["Kelas Jabatan"] || "",
              );
              const kebutuhan = String(
                d["Kebutuhan"] || d["kebutuhan"] || "",
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
          updateParent(newRows);
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
          Kelola Master Peta Jabatan untuk menghitung analisis Bezetting secara akurat. Anda dapat mengetik
          langsung ke tabel, menambah baris, atau memproses massal menggunakan Excel.
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
            onClick={handleDownloadTemplate}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:scale-95"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Template
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:scale-95"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" /> Import
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:scale-95"
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
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-12">No</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[150px]">Bidang / Unit Kerja</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[180px]">Jabatan</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">Kelas</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">Kebutuhan</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence initial={false}>
              {rows.map((row) => (
                <motion.tr layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} key={row.id} className="hover:bg-slate-50/50 group">
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.no}
                      onChange={(e) => handleCellChange(row.id, "no", e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none transition-colors"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.bidang}
                      onChange={(e) => handleCellChange(row.id, "bidang", e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-medium text-slate-700 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none transition-colors"
                      placeholder="Bidang..."
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.jabatan}
                      onChange={(e) => handleCellChange(row.id, "jabatan", e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-medium text-slate-700 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none transition-colors"
                      placeholder="Nama Jabatan..."
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.kelas}
                      onChange={(e) => handleCellChange(row.id, "kelas", e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none transition-colors"
                      placeholder="Misal: 14"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.kebutuhan}
                      onChange={(e) => handleCellChange(row.id, "kebutuhan", e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none transition-colors"
                      placeholder="0"
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
                </motion.tr>
              ))}
              {rows.length === 0 && (
                <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Master Peta Jabatan kosong. Silakan tambah baris atau import dari file Excel.
                  </td>
                </motion.tr>
              )}
            </AnimatePresence>
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
