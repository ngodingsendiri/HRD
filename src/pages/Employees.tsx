import React, { useState, useEffect } from "react";
import { Employee, AppSettings } from "../types";
import { Modal } from "../components/Modal";
import { EmployeeForm } from "../components/EmployeeForm";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Download,
  Upload,
  FileSpreadsheet,
  Loader2,
  Check,
  X,
  AlertCircle,
  Printer,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { handleApiError, OperationType } from "../lib/error";
import { api } from "../lib/api";
import { mapExcelHeaders } from "../lib/excelMapping";
import { buildFamilyExportFields } from "../lib/employeeExport";
import { motion, AnimatePresence } from "motion/react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  listItemMotion,
  pageContainerVariants,
  pageItemVariants,
  pageShellWide,
  statusBadge,
} from "../lib/ui";

import { DEFAULT_KAMUS } from "../constants";
import {
  checkKGBandKP,
  formatKPLabel,
  type KPStatus,
} from "../lib/employeeUtils";

/** Badge peringatan KP/KGB. Warna merah = lewat, kuning = mendekati. */
function KPBadge({ kind, status }: { kind: "KP" | "KGB"; status: KPStatus }) {
  if (!status.due && !status.overdue) return null;
  const isOverdue = status.overdue;
  return (
    <span
      title={
        status.targetDate
          ? `${kind} jatuh tempo ${status.targetDate}${
              status.daysLeft !== null
                ? status.daysLeft < 0
                  ? ` (lewat ${Math.abs(status.daysLeft)} hari)`
                  : ` (sisa ${status.daysLeft} hari)`
                : ""
            }`
          : kind
      }
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-lg border whitespace-nowrap ${
        isOverdue
          ? "bg-red-50 text-red-700 border-red-100"
          : "bg-amber-50 text-amber-700 border-amber-100"
      }`}
    >
      <AlertTriangle className="w-2.5 h-2.5" />
      {formatKPLabel(kind, status)}
    </span>
  );
}

/** Render badge KP & KGB untuk seorang pegawai. */
function KPKGBBadges({ emp }: { emp: Employee }) {
  const { kp, kgb, clear } = checkKGBandKP(
    emp.tmtGolonganRuang,
    emp.tanggalBerkalaTerakhir,
  );
  if (clear) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <KPBadge kind="KP" status={kp} />
      <KPBadge kind="KGB" status={kgb} />
    </div>
  );
}

export default function Employees() {
  const [rawEmployees, setRawEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<
    Employee | undefined
  >();
  const [error, setError] = useState<Error | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Employee | "pangkatGolongan";
    direction: "asc" | "desc";
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const employees = React.useMemo(() => {
    const kamusMap = new Map<string, { kelas: string; beban: string }>();
    const csvData = settings?.jabatanKamusCsv || DEFAULT_KAMUS;
    if (csvData) {
      const rows = csvData.split("\n");
      for (const row of rows) {
        if (!row || row.trim() === "") continue;
        const cols = row.split(/;|\t/);
        if (cols.length >= 4) {
          kamusMap.set(cols[1].trim().toLowerCase(), {
            kelas: cols[2].trim(),
            beban: cols[3].trim(),
          });
        }
      }
    }

    return rawEmployees.map((emp) => {
      let overrides = {};
      if (emp.jabatan && kamusMap.size > 0) {
        const match = kamusMap.get(emp.jabatan.trim().toLowerCase());
        if (match) {
          overrides = { kelasJabatan: match.kelas, bebanKerja: match.beban };
        }
      }
      return { ...emp, ...overrides };
    });
  }, [rawEmployees, settings?.jabatanKamusCsv]);

  useEffect(() => {
    let cancelled = false;

    // Fetch settings
    api
      .getSettings()
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch((err) => console.error("Error fetching settings:", err));

    // Fetch employees (computed fields come back from the API already).
    const loadEmployees = async () => {
      try {
        const data = await api.getEmployees();
        if (!cancelled) setRawEmployees(data);
      } catch (e) {
        const err = handleApiError(e, OperationType.LIST, "/api/employees");
        if (!cancelled) setError(err);
      }
    };
    loadEmployees();

    // Light refresh polling (every 60s) — realtime replacement.
    const interval = setInterval(loadEmployees, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error) {
    throw error;
  }

  const handleSave = async (data: Employee) => {
    try {
      if (editingEmployee?.id) {
        await api.updateEmployee(editingEmployee.id, data);
      } else {
        await api.createEmployee(data);
      }
      // Refresh list after mutation
      const fresh = await api.getEmployees();
      setRawEmployees(fresh);
      setIsModalOpen(false);
      setEditingEmployee(undefined);
    } catch (e) {
      const err = handleApiError(
        e,
        editingEmployee?.id ? OperationType.UPDATE : OperationType.CREATE,
        editingEmployee?.id ? `/api/employees/${editingEmployee.id}` : "/api/employees",
      );
      setError(err);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setEmployeeToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteEmployee(employeeToDelete);
      setIsDeleteModalOpen(false);
      setEmployeeToDelete(null);
      const fresh = await api.getEmployees();
      setRawEmployees(fresh);
    } catch (e) {
      const err = handleApiError(
        e,
        OperationType.DELETE,
        `/api/employees/${employeeToDelete}`,
      );
      setError(err);
    } finally {
      setIsDeleting(false);
    }
  };

    const handleExport = () => {
    const today = new Date();
    const exportData = employees.map(
      ({ id, dataKeluarga, createdAt, updatedAt, ...rest }) => {
        let usia = "";
        let tmtPensiun = rest.pensiun;
        if (rest.tanggalLahir) {
          const birth = new Date(rest.tanggalLahir);
          if (!isNaN(birth.getTime())) {
            const ageDate = new Date(today.getTime() - birth.getTime());
            usia = String(Math.abs(ageDate.getUTCFullYear() - 1970));
            
            if (!tmtPensiun) {
              const pensiunDate = new Date(birth);
              const pensiunAge = String(rest.jabatan).toLowerCase().includes('guru') || String(rest.jabatan).toLowerCase().includes('medis') ? 60 : 58;
              pensiunDate.setFullYear(pensiunDate.getFullYear() + pensiunAge);
              tmtPensiun = pensiunDate.toISOString().split("T")[0];
            }
          }
        }

        let nextKgb = "";
        if (rest.tanggalBerkalaTerakhir) {
           const d = new Date(rest.tanggalBerkalaTerakhir);
           if (!isNaN(d.getTime())) {
             d.setFullYear(d.getFullYear() + 2);
             nextKgb = d.toISOString().split("T")[0];
           }
        }
        
        let nextKp = "";
        if (rest.tmtGolonganRuang) {
           const d = new Date(rest.tmtGolonganRuang);
           if (!isNaN(d.getTime())) {
             d.setFullYear(d.getFullYear() + 4);
             nextKp = d.toISOString().split("T")[0];
           }
        }

        return {
          Nama: rest.nama,
          "N I P": rest.nip,
          "N I K": rest.nik,
          JK: rest.jk,
          "Tempat Lahir": rest.tempatLahir,
          "Tanggal Lahir": rest.tanggalLahir,
          "Usia": usia,
          "Jalan/Dusun": rest.jalanDusun,
          RT: rest.rt,
          RW: rest.rw,
          "Desa/Kelurahan": rest.desaKelurahan,
          Kecamatan: rest.kecamatan,
          Kabupaten: rest.kabupaten,
          "kelas jabatan": rest.kelasJabatan,
          "beban kerja": rest.bebanKerja,
          "TMT Kerja": rest.tmtKerja,
          "Masa Kerja": rest.masaKerja,
          "Pensiun (BUP)": tmtPensiun,
          "TMT Golongan Ruang": rest.tmtGolonganRuang,
          "Masa Kerja Golongan Ruang": rest.masaKerjaGolonganRuang,
          "Prediksi Kenaikan Pangkat (KP)": nextKp,
          "No. Rekening Bank": rest.noRekeningBank,
          NPWP: rest.npwp,
          Pangkat: rest.pangkat,
          Gol: rest.gol,
          "Tanggal Berkala Terakhir": rest.tanggalBerkalaTerakhir,
          "Prediksi Kenaikan Gaji Berkala (KGB)": nextKgb,
          "Gaji Pokok": rest.gajiPokok,
          "Besaran Gaji Kotor": rest.besaranGajiKotor,
          "Digaji Menurut PP/SK": rest.digajiMenurut,
          Jabatan: rest.jabatan,
          Bidang: rest.bidang,
          Status: rest.status,
          "Nomor Karpeg": rest.nomorKarpeg,
          Pendidikan: rest.pendidikan,
          Jurusan: rest.jurusan,
          "Diklat Jenjang": rest.diklatJenjang,
          "Tahun Diklat": rest.tahunDiklat,
          "Status Kawin": rest.statusKawin,
          Agama: rest.agama,
          "Nomor HP": rest.nomorHp,
          "Sisa Cuti Tahunan N": rest.sisaCutiN,
          "Sisa Cuti Tahunan N1": rest.sisaCutiN1,
          "Sisa Cuti Tahunan N2": rest.sisaCutiN2,
          "SK Terakhir Yang Dimiliki": rest.skTerakhir,
          ...buildFamilyExportFields(dataKeluarga),
          "Jumlah Tertanggung": rest.jumlahTertanggung,
        };
      },
    );
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pegawai");
    XLSX.writeFile(wb, "Data_Pegawai_Full.xlsx");
  };

  
    const handleExportBezetting = () => {
    // Read from settings or fallback to empty
    let petaMap = [];
    const csvData = settings?.petaJabatanCsv || "";
    if (csvData) {
      const rows = csvData.split("\n");
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
          petaMap.push({
            bidang: cols[1]?.trim() || "",
            jabatan: cols[2]?.trim() || "",
            kelas: cols[3]?.trim() || "",
            kebutuhan: Number(cols[4]?.trim()) || 0,
          });
        }
      }
    } else {
       // If no master map is provided, we just group the existing data
    }

    const grouped = new Map<string, any>();

    // Initialize map with master peta data
    petaMap.forEach((item) => {
      if (!item.bidang || !item.jabatan) return;
      const key = `${item.bidang.trim().toLowerCase()}|${item.jabatan.trim().toLowerCase()}`;
      grouped.set(key, {
        bidang: item.bidang,
        jabatan: item.jabatan,
        kelasJabatan: item.kelas,
        kebutuhan: item.kebutuhan,
        pns: 0,
        cpns: 0,
        pppk: 0,
        pppkpw: 0,
      });
    });

    // Populate with actual employees
    employees.forEach((emp) => {
      if (!emp.bidang || !emp.jabatan) return;
      const key = `${emp.bidang.trim().toLowerCase()}|${emp.jabatan.trim().toLowerCase()}`;
      
      // If employee's jabatan is not in the map, add it
      if (!grouped.has(key)) {
        grouped.set(key, {
          bidang: emp.bidang,
          jabatan: emp.jabatan,
          kelasJabatan: emp.kelasJabatan || "",
          kebutuhan: 0, // 0 since not in peta
          pns: 0,
          cpns: 0,
          pppk: 0,
          pppkpw: 0,
        });
      }

      const group = grouped.get(key);
      if (emp.status === "PNS") group.pns += 1;
      else if (emp.status === "CPNS") group.cpns += 1;
      else if (emp.status === "PPPK") group.pppk += 1;
      else if (emp.status === "PPPKPW") group.pppkpw += 1;
    });

    let exportData = Array.from(grouped.values())
      .sort((a, b) => {
        if (a.bidang < b.bidang) return -1;
        if (a.bidang > b.bidang) return 1;
        // if same bidang, sort by kebutuhan (desc) then kelas jabatan (desc)
        if (b.kebutuhan !== a.kebutuhan) return b.kebutuhan - a.kebutuhan;
        return Number(b.kelasJabatan) - Number(a.kelasJabatan);
      })
      .map((g, index) => {
        const totalBezetting = g.pns + g.cpns + g.pppk + g.pppkpw;
        return {
          No: index + 1,
          Bidang: g.bidang,
          "Nama Jabatan Sesuai Peta Jabatan": g.jabatan,
          "Kelas Jabatan": g.kelasJabatan,
          "Kebutuhan Berdasarkan Peta Jabatan": g.kebutuhan,
          PNS: g.pns || "",
          CPNS: g.cpns || "",
          PPPK: g.pppk || "",
          "PPPK PW": g.pppkpw || "",
          Selisih: totalBezetting - g.kebutuhan,
        };
      });

    // Hitung baris Jumlah (Total)
    const totalKebutuhan = exportData.reduce((acc, curr) => acc + (Number(curr["Kebutuhan Berdasarkan Peta Jabatan"]) || 0), 0);
    const totalPNS = exportData.reduce((acc, curr) => acc + (Number(curr["PNS"]) || 0), 0);
    const totalCPNS = exportData.reduce((acc, curr) => acc + (Number(curr["CPNS"]) || 0), 0);
    const totalPPPK = exportData.reduce((acc, curr) => acc + (Number(curr["PPPK"]) || 0), 0);
    const totalPPPKPW = exportData.reduce((acc, curr) => acc + (Number(curr["PPPK PW"]) || 0), 0);
    const totalSelisih = exportData.reduce((acc, curr) => acc + (Number(curr["Selisih"]) || 0), 0);

    exportData.push({
      // @ts-ignore
      No: "",
      Bidang: "Jumlah",
      "Nama Jabatan Sesuai Peta Jabatan": "",
      "Kelas Jabatan": "",
      "Kebutuhan Berdasarkan Peta Jabatan": totalKebutuhan,
      PNS: totalPNS || "",
      CPNS: totalCPNS || "",
      PPPK: totalPPPK || "",
      "PPPK PW": totalPPPKPW || "",
      Selisih: totalSelisih,
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Sesuaikan lebar kolom
    const wscols = [
      { wch: 5 }, // No
      { wch: 40 }, // Bidang
      { wch: 50 }, // Jabatan
      { wch: 15 }, // Kelas
      { wch: 35 }, // Kebutuhan
      { wch: 10 }, // PNS
      { wch: 10 }, // CPNS
      { wch: 10 }, // PPPK
      { wch: 15 }, // PPPK PW
      { wch: 10 }  // Selisih
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bezetting");
    XLSX.writeFile(workbook, "Data_Bezetting_Pegawai.xlsx");
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Nama",
      "N I P",
      "N I K",
      "JK",
      "Tempat Lahir",
      "Tanggal Lahir",
      "Usia",
      "Jalan/Dusun",
      "RT",
      "RW",
      "Desa/Kelurahan",
      "Kecamatan",
      "Kabupaten",
      "kelas jabatan",
      "beban kerja",
      "TMT Kerja",
      "Masa Kerja",
      "Pensiun (BUP)",
      "TMT Golongan Ruang",
      "Masa Kerja Golongan Ruang",
      "Prediksi Kenaikan Pangkat (KP)",
      "No. Rekening Bank",
      "NPWP",
      "Pangkat",
      "Gol",
      "Tanggal Berkala Terakhir",
      "Prediksi Kenaikan Gaji Berkala (KGB)",
      "Gaji Pokok",
      "Besaran Gaji Kotor",
      "Digaji Menurut PP/SK",
      "Jabatan",
      "Bidang",
      "Status",
      "Nomor Karpeg",
      "Pendidikan",
      "Jurusan",
      "Diklat Jenjang",
      "Tahun Diklat",
      "Status Kawin",
      "Agama",
      "Nomor HP",
      "Sisa Cuti Tahunan N",
      "Sisa Cuti Tahunan N1",
      "Sisa Cuti Tahunan N2",
      "SK Terakhir Yang Dimiliki",
      "Nama Istri/Suami",
      "Tanggal Lahir Pasangan",
      "Perkawinan Pasangan",
      "Pekerjaan Pasangan",
      "Keterangan Pasangan",
      "Nama Anak 1",
      "Tanggal Lahir Anak 1",
      "Perkawinan Anak 1",
      "Pekerjaan Anak 1",
      "Keterangan Anak 1",
      "Nama Anak 2",
      "Tanggal Lahir Anak 2",
      "Perkawinan Anak 2",
      "Pekerjaan Anak 2",
      "Keterangan Anak 2",
      "Nama Anak 3",
      "Tanggal Lahir Anak 3",
      "Perkawinan Anak 3",
      "Pekerjaan Anak 3",
      "Keterangan Anak 3",
      "Nama Anak 4",
      "Tanggal Lahir Anak 4",
      "Perkawinan Anak 4",
      "Pekerjaan Anak 4",
      "Keterangan Anak 4",
      "Nama Anak 5",
      "Tanggal Lahir Anak 5",
      "Perkawinan Anak 5",
      "Pekerjaan Anak 5",
      "Keterangan Anak 5",
      "Jumlah Tertanggung",
    ];

    const exampleData = [
      [
        "Regar Jeane Dealen Nangka, S.STP., M.Si.",
        "198301112001121002",
        "3509191101830005",
        "L",
        "Bondowoso",
        "1983-01-11", // Tanggal Lahir
        "43", // Usia
        "Perum Muktisari Blok BF No. 6",
        "004",
        "003",
        "Tegal Besar",
        "Kaliwates",
        "Jember",
        "10",
        "Tinggi",
        "2002-01-01", // TMT Kerja
        "24", // Masa Kerja
        "2041-01-11", // Pensiun (BUP)
        "2021-10-01", // TMT Golongan Ruang
        "20", // Masa Kerja Golongan Ruang
        "2025-10-01", // Prediksi Kenaikan Pangkat (KP)
        "1234567890", // No. Rekening Bank
        "12.345.678.9-012.000", // NPWP
        "Pembina Tk. I", // Pangkat
        "IV.b", // Gol
        "2023-10-01", // Tanggal Berkala Terakhir
        "2025-10-01", // Prediksi Kenaikan Gaji Berkala (KGB)
        "4.672.800", // Gaji Pokok
        "7.236.979", // Besaran Gaji Kotor
        "Kepala Dinas", // Digaji Menurut PP/SK
        "Kepala Dinas Pendidikan", // Jabatan
        "Sekretariat", // Bidang
        "PNS", // Status
        "L.066441", // Nomor Karpeg
        "S2", // Pendidikan
        "Ilmu Pemerintahan", // Jurusan
        "PIM II", // Diklat Jenjang
        "2020", // Tahun Diklat
        "Kawin", // Status Kawin
        "Islam", // Agama
        "081252748226", // Nomor HP
        "12", // Sisa Cuti N
        "0", // Sisa Cuti N-1
        "0", // Sisa Cuti N-2
        "SK Bupati No. 123", // SK Terakhir
        "Nama Pasangan", // Pasangan
        "1985-01-01",
        "2010-01-01",
        "Wiraswasta",
        "Aktif",
        "Anak Pertama", // Anak 1
        "2012-05-10",
        "",
        "Pelajar",
        "Tanggungan",
        "", "", "", "", "", // Anak 2
        "", "", "", "", "", // Anak 3
        "", "", "", "", "", // Anak 4
        "", "", "", "", "", // Anak 5
        "2", // Jumlah Tertanggung
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_dataHRD");
    XLSX.writeFile(wb, "Template_Import_dataHRD_Full.xlsx");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (rows.length === 0) throw new Error("File Excel kosong.");

        // Locate header row (first 10 rows containing NIP/NIK/Nama).
        let headerIdx = -1;
        let colMap: Record<string, number> = {};
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const row = rows[i];
          if (
            row.some((c) => {
              const s = String(c || "").toUpperCase().trim();
              return s === "NIP" || s === "NIK" || s === "NAMA LENGKAP" || s === "N I P";
            })
          ) {
            headerIdx = i;
            row.forEach((cell, idx) => {
              if (cell) colMap[String(cell).trim().toUpperCase()] = idx;
            });
            break;
          }
        }

        // Convert Excel serial date → YYYY-MM-DD
        const excelDateToJSDate = (serial: any) => {
          if (typeof serial !== "number") return String(serial || "").trim();
          if (serial < 10000) return String(serial).trim();
          const utc_days = Math.floor(serial - 25569);
          const utc_value = utc_days * 86400;
          const date_info = new Date(utc_value * 1000);
          return date_info.toISOString().split("T")[0];
        };

        const getVal = (row: any[], names: string[]) => {
          for (const name of names) {
            const idx = colMap[name.toUpperCase()];
            if (idx !== undefined) return row[idx];
          }
          return undefined;
        };

        // Build a normalized header lookup if the standard template wasn't
        // detected — uses the deterministic mapper (no AI).
        let fallbackMap: Record<string, string> = {};
        if (headerIdx === -1) {
          const rawHeaders = rows[0].map((h) => String(h || "").trim());
          fallbackMap = mapExcelHeaders(rawHeaders);
          headerIdx = 0;
          rawHeaders.forEach((h, idx) => {
            if (h) colMap[h.toUpperCase()] = idx;
          });
        }

        const dataRows = rows.slice(headerIdx + 1);
        const payload: Record<string, unknown>[] = [];

        for (const row of dataRows) {
          if (!row || row.length < 2) continue;

          let employeeData: Record<string, unknown> = {};

          if (Object.keys(fallbackMap).length > 0) {
            // Fallback path: use deterministic mapping
            for (const [header, field] of Object.entries(fallbackMap)) {
              const idx = colMap[header.toUpperCase()];
              if (idx !== undefined && row[idx] !== undefined) {
                employeeData[field] = excelDateToJSDate(row[idx]);
              }
            }
          } else {
            // Standard template path
            const nama = String(getVal(row, ["Nama Lengkap", "Nama", "NAMA"]) || "").trim();
            const nik = String(getVal(row, ["NIK", "N I K"]) || "").trim();
            const nip = String(getVal(row, ["NIP", "N I P"]) || "").trim();
            if (!nama && !nik && !nip) continue;
            if (nama.toLowerCase().includes("nama lengkap")) continue;

            // Family data
            const dataKeluarga: any[] = [];
            const spouseName = getVal(row, ["Nama Istri/Suami", "Nama Pasangan"]);
            if (spouseName && String(spouseName).trim()) {
              const jk = String(getVal(row, ["JK", "Jenis Kelamin"]) || "").toUpperCase();
              dataKeluarga.push({
                name: String(spouseName).trim(),
                relation: jk.includes("L") ? "Istri" : "Suami",
                birthDate: excelDateToJSDate(getVal(row, ["Tgl Lahir Pasangan", "Tanggal Lahir Pasangan"])),
                marriageDate: excelDateToJSDate(getVal(row, ["Tgl Nikah", "Tanggal Nikah"])),
                occupation: String(getVal(row, ["Pekerjaan Pasangan"]) || "").trim(),
                description: String(getVal(row, ["Keterangan Pasangan"]) || "").trim(),
              });
            }
            for (let c = 1; c <= 5; c++) {
              const cName = getVal(row, [`Nama Anak ${c}`]);
              if (cName && String(cName).trim()) {
                dataKeluarga.push({
                  name: String(cName).trim(),
                  relation: "Anak",
                  birthDate: excelDateToJSDate(getVal(row, [`Tgl Lahir Anak ${c}`])),
                  marriageDate: excelDateToJSDate(getVal(row, [`Tgl Nikah Anak ${c}`])),
                  occupation: String(getVal(row, [`Pekerjaan Anak ${c}`]) || "").trim(),
                  description: String(getVal(row, [`Keterangan Anak ${c}`]) || "").trim(),
                });
              }
            }

            let rawStatus = String(getVal(row, ["Status"]) || "PNS").toUpperCase();
            let status: Employee["status"] = "PNS";
            if (rawStatus.includes("CPNS")) status = "CPNS";
            else if (rawStatus.includes("PPPKPW")) status = "PPPKPW";
            else if (rawStatus.includes("PPPK")) status = "PPPK";
            else if (rawStatus.includes("PNS")) status = "PNS";

            const pangkat = String(getVal(row, ["Pangkat"]) || "").trim();
            const gol = String(getVal(row, ["Gol"]) || "").trim();

            employeeData = {
              nip,
              nik,
              nama,
              jk: String(getVal(row, ["JK", "Jenis Kelamin"]) || "").trim().toUpperCase().startsWith("L") ? "L" : "P",
              tempatLahir: String(getVal(row, ["Tempat Lahir"]) || "").trim(),
              tanggalLahir: excelDateToJSDate(getVal(row, ["Tanggal Lahir", "Tgl Lahir"])),
              jalanDusun: String(getVal(row, ["Jalan/Dusun", "Alamat"]) || "").trim(),
              rt: String(getVal(row, ["RT"]) || "").trim(),
              rw: String(getVal(row, ["RW"]) || "").trim(),
              desaKelurahan: String(getVal(row, ["Desa/Kelurahan"]) || "").trim(),
              kecamatan: String(getVal(row, ["Kecamatan"]) || "").trim(),
              kabupaten: String(getVal(row, ["Kabupaten"]) || "").trim(),
              tmtKerja: excelDateToJSDate(getVal(row, ["TMT Kerja"])),
              tmtGolonganRuang: excelDateToJSDate(getVal(row, ["TMT Golongan Ruang"])),
              masaKerjaGolonganRuang: String(getVal(row, ["Masa Kerja Golongan Ruang"]) || "").trim(),
              noRekeningBank: String(getVal(row, ["No. Rekening Bank", "Rekening"]) || "").trim(),
              npwp: String(getVal(row, ["NPWP"]) || "").trim(),
              pangkat,
              gol,
              pangkatGolongan: `${pangkat} / ${gol}`.trim(),
              tanggalBerkalaTerakhir: excelDateToJSDate(getVal(row, ["Tanggal Berkala Terakhir"])),
              gajiPokok: String(getVal(row, ["Gaji Pokok"]) || "").trim(),
              besaranGajiKotor: String(getVal(row, ["Besaran Gaji Kotor"]) || "").trim(),
              digajiMenurut: String(getVal(row, ["Digaji Menurut PP/SK"]) || "").trim(),
              jabatan: String(getVal(row, ["Jabatan"]) || "").trim(),
              bidang: String(getVal(row, ["Bidang", "Unit Kerja"]) || "").trim(),
              status,
              nomorKarpeg: String(getVal(row, ["Nomor Karpeg"]) || "").trim(),
              pendidikan: String(getVal(row, ["Pendidikan"]) || "").trim(),
              jurusan: String(getVal(row, ["Jurusan"]) || "").trim(),
              diklatJenjang: String(getVal(row, ["Diklat Jenjang"]) || "").trim(),
              tahunDiklat: String(getVal(row, ["Tahun Diklat"]) || "").trim(),
              statusKawin: String(getVal(row, ["Status Kawin"]) || "").trim(),
              agama: String(getVal(row, ["Agama"]) || "").trim(),
              nomorHp: String(getVal(row, ["Nomor HP", "No HP", "Nomo HP", "No. HP"]) || "").trim(),
              sisaCutiN: String(getVal(row, ["Sisa Cuti N", "Sisa Cuti Tahunan N"]) || "").trim(),
              sisaCutiN1: String(getVal(row, ["Sisa Cuti N-1", "Sisa Cuti Tahunan N1"]) || "").trim(),
              sisaCutiN2: String(getVal(row, ["Sisa Cuti N-2", "Sisa Cuti Tahunan N2"]) || "").trim(),
              skTerakhir: String(getVal(row, ["SK Terakhir", "SK Terakhir Yang Dimiliki"]) || "").trim(),
              jumlahTertanggung: Number(getVal(row, ["Jumlah Tertanggung"]) || 0),
              dataKeluarga,
            };
          }

          const nama = String(employeeData.nama || "").trim();
          const nip = String(employeeData.nip || "").trim();
          const nik = String(employeeData.nik || "").trim();
          if (!nama && !nip && !nik) continue;

          payload.push(employeeData);
        }

        if (payload.length === 0) {
          throw new Error("Tidak ada baris valid untuk diimport.");
        }

        const result = await api.bulkUpsert(payload);
        alert(
          `Import selesai! ${result.created} data baru, ${result.updated} diperbarui` +
            (result.errors > 0 ? `, ${result.errors} baris dilewati (data invalid).` : "."),
        );

        const fresh = await api.getEmployees();
        setRawEmployees(fresh);
      } catch (err) {
        console.error("Import error:", err);
        alert(
          err instanceof Error && err.message
            ? `Gagal mengimport: ${err.message}`
            : "Gagal mengimport data. Pastikan format file benar.",
        );
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const getHierarchy = (emp: Employee) => {
    const kadis = employees.find((e) =>
      e.jabatan?.toLowerCase().includes("kepala dinas"),
    );
    const sekre = employees.find(
      (e) =>
        e.jabatan?.toLowerCase().includes("sekretaris") &&
        e.bidang?.toLowerCase().includes("sekretariat"),
    );

    // Find Kabid for the employee's bidang
    const kabid = employees.find(
      (e) =>
        e.jabatan?.toLowerCase().includes("kepala bidang") &&
        e.bidang === emp.bidang,
    );

    const isKadis = emp.jabatan?.toLowerCase().includes("kepala dinas");
    const isSekre =
      emp.jabatan?.toLowerCase().includes("sekretaris") &&
      emp.bidang?.toLowerCase().includes("sekretariat");
    const isKabid = emp.jabatan?.toLowerCase().includes("kepala bidang");
    const isSekretariat = emp.bidang?.toLowerCase().includes("sekretariat");

    if (isKadis) {
      return {
        atasan: settings?.sekdaNama || "-",
        nipAtasan: settings?.sekdaNip || "-",
        pejabat: settings?.bupatiNama || "-",
        nipPejabat: "-",
      };
    }

    if (isSekre) {
      return {
        atasan: kadis?.nama || "-",
        nipAtasan: kadis?.nip || "-",
        pejabat: settings?.sekdaNama || "-",
        nipPejabat: settings?.sekdaNip || "-",
      };
    }

    if (isKabid) {
      return {
        atasan: sekre?.nama || "-",
        nipAtasan: sekre?.nip || "-",
        pejabat: kadis?.nama || "-",
        nipPejabat: kadis?.nip || "-",
      };
    }

    if (isSekretariat) {
      return {
        atasan: sekre?.nama || "-",
        nipAtasan: sekre?.nip || "-",
        pejabat: kadis?.nama || "-",
        nipPejabat: kadis?.nip || "-",
      };
    }

    // Default for other employees in Bidang
    return {
      atasan: kabid?.nama || "-",
      nipAtasan: kabid?.nip || "-",
      pejabat: kadis?.nama || "-",
      nipPejabat: kadis?.nip || "-",
    };
  };

  const val = (v: any) => (v ? v : <span className="text-slate-300">—</span>);

  const filteredEmployees = employees.filter((emp) => {
    const searchLower = searchTerm.toLowerCase();
    const nama = (emp.nama || "").toLowerCase();
    const nip = (emp.nip || "").toLowerCase();
    const nik = (emp.nik || "").toLowerCase();

    return (
      nama.includes(searchLower) ||
      nip.includes(searchLower) ||
      nik.includes(searchLower)
    );
  });

  const sortedEmployees = React.useMemo(() => {
    let sortableItems = [...filteredEmployees];
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        let aValue = a[sortConfig.key] || "";
        let bValue = b[sortConfig.key] || "";
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      // Default sorting: PNS > CPNS > PPPK > PPPKPW, then by Kelas Jabatan DESC
      sortableItems.sort((a, b) => {
        const statusOrder: Record<string, number> = {
          PNS: 1,
          CPNS: 2,
          PPPK: 3,
          PPPKPW: 4,
        };
        const statusA = statusOrder[a.status || ""] || 99;
        const statusB = statusOrder[b.status || ""] || 99;
        if (statusA !== statusB) {
          return statusA - statusB;
        }
        const kelasA = parseInt(a.kelasJabatan || "0", 10);
        const kelasB = parseInt(b.kelasJabatan || "0", 10);
        if (kelasB !== kelasA) {
          return kelasB - kelasA;
        }

        // Golongan/Pangkat Fallback (DESC)
        const getGolonganWeight = (emp: any) => {
          const g = (
            emp.pangkatGolongan ||
            emp.gol ||
            emp.pangkat ||
            ""
          ).toUpperCase();
          if (g.includes("IV/E") || g.includes("IV / E")) return 45;
          if (g.includes("IV/D") || g.includes("IV / D")) return 44;
          if (g.includes("IV/C") || g.includes("IV / C")) return 43;
          if (g.includes("IV/B") || g.includes("IV / B")) return 42;
          if (g.includes("IV/A") || g.includes("IV / A")) return 41;
          if (g.includes("III/D") || g.includes("III / D")) return 34;
          if (g.includes("III/C") || g.includes("III / C")) return 33;
          if (g.includes("III/B") || g.includes("III / B")) return 32;
          if (g.includes("III/A") || g.includes("III / A")) return 31;
          if (g.includes("II/D") || g.includes("II / D")) return 24;
          if (g.includes("II/C") || g.includes("II / C")) return 23;
          if (g.includes("II/B") || g.includes("II / B")) return 22;
          if (g.includes("II/A") || g.includes("II / A")) return 21;
          if (g.includes("I/D") || g.includes("I / D")) return 14;
          if (g.includes("I/C") || g.includes("I / C")) return 13;
          if (g.includes("I/B") || g.includes("I / B")) return 12;
          if (g.includes("I/A") || g.includes("I / A")) return 11;

          if (g.includes("XVII")) return 117;
          if (g.includes("XVI")) return 116;
          if (g.includes("XV")) return 115;
          if (g.includes("XIV")) return 114;
          if (g.includes("XIII")) return 113;
          if (g.includes("XII")) return 112;
          if (g.includes("XI")) return 111;
          if (g.includes("X")) return 110;
          if (g.includes("IX")) return 109;
          if (g.includes("VIII")) return 108;
          if (g.includes("VII")) return 107;
          if (g.includes("VI")) return 106;
          if (g.includes("V")) return 105;

          const num = parseInt(g, 10);
          if (!isNaN(num)) return num;
          return 0;
        };

        const golA = getGolonganWeight(a);
        const golB = getGolonganWeight(b);

        if (golA !== golB) {
          return golB - golA;
        }

        return (a.nama || "").localeCompare(b.nama || "");
      });
    }
    return sortableItems;
  }, [filteredEmployees, sortConfig]);

  const displayedEmployees = sortedEmployees.slice(0, rowsPerPage);

  const handleSort = (key: keyof Employee | "pangkatGolongan") => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newSet = new Set(selectedIds);
      displayedEmployees.forEach((emp) => {
        if (emp.id) newSet.add(emp.id);
      });
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      displayedEmployees.forEach((emp) => {
        if (emp.id) newSet.delete(emp.id);
      });
      setSelectedIds(newSet);
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    setIsDeletingBulk(true);
    try {
      await api.deleteEmployees(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
      const fresh = await api.getEmployees();
      setRawEmployees(fresh);
    } catch (e) {
      const err = handleApiError(e, OperationType.DELETE, "/api/employees");
      setError(err);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageContainerVariants}
      className={pageShellWide}
    >
      <motion.div variants={pageItemVariants}>
        <PageHeader
          title="Direktori Pegawai"
          description="Kelola informasi induk pegawai, penempatan, dan rekam jejak karir secara terpusat."
          actions={
            <>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className={`${btnDanger} w-full sm:w-auto`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus {selectedIds.size} Data
                </button>
              )}

              <div className="grid grid-cols-2 sm:flex sm:flex-row w-full sm:w-auto gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className={`${btnSecondary} w-full`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Template
                </button>

                <label className={`${btnSecondary} w-full cursor-pointer`}>
                  <Upload className="w-3.5 h-3.5" />
                  Impor
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleImport}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-row w-full sm:w-auto gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className={`${btnSecondary} w-full`}
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  Ekspor
                </button>
                <button
                  type="button"
                  onClick={handleExportBezetting}
                  className={`${btnSecondary} w-full`}
                >
                  <Download className="w-3.5 h-3.5 text-amber-600" />
                  Bezetting
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingEmployee(undefined);
                  setIsModalOpen(true);
                }}
                className={`${btnPrimary} w-full sm:w-auto`}
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah
              </button>
            </>
          }
        />
      </motion.div>

      <motion.div variants={pageItemVariants} className="space-y-4 md:space-y-6">
        {/* Search Row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
          <div className="relative w-full sm:flex-1 md:w-96 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all "
              placeholder="Pencarian berdasarkan NIP, Nama, atau NIK..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block whitespace-nowrap">
              Baris :
            </span>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900/10 active:scale-95 transition-all cursor-pointer "
            >
              <option value={10}>10 Baris</option>
              <option value={20}>20 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
            </select>
          </div>
        </div>

        <div className={`${card} overflow-hidden flex flex-col h-[min(600px,70vh)]`}>
          {/* Desktop Table View */}
          <div className="hidden lg:block flex-1 overflow-auto bg-slate-50">
            <table className="min-w-[1500px] w-full border-collapse bg-white">
              <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-50 px-4 py-3 border-r border-slate-100 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-14">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded-lg border-slate-300 text-slate-900 focus:ring-slate-900/20 cursor-pointer"
                        onChange={handleSelectAll}
                        checked={
                          displayedEmployees.length > 0 &&
                          displayedEmployees.every(
                            (emp) => emp.id && selectedIds.has(emp.id),
                          )
                        }
                      />
                      <span>No.</span>
                    </div>
                  </th>
                  <th className="sticky left-[56px] z-30 bg-slate-50 px-4 py-3 border-r border-slate-100 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[72px]">
                    Aksi
                  </th>
                  <th
                    onClick={() => handleSort("nama")}
                    className="sticky left-[128px] z-30 bg-slate-50 px-4 py-3 border-r border-slate-100 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Nama Lengkap{" "}
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortConfig?.key === "nama" ? "text-slate-900" : "text-slate-300"}`}
                      />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100">
                    Peringatan
                  </th>
                  <th
                    onClick={() => handleSort("nip")}
                    className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      NIP{" "}
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortConfig?.key === "nip" ? "text-slate-900" : "text-slate-300"}`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("nik")}
                    className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      NIK{" "}
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortConfig?.key === "nik" ? "text-slate-900" : "text-slate-300"}`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("jk")}
                    className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      L/P{" "}
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortConfig?.key === "jk" ? "text-slate-900" : "text-slate-300"}`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("jabatan")}
                    className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Jabatan{" "}
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortConfig?.key === "jabatan" ? "text-slate-900" : "text-slate-300"}`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("bidang")}
                    className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Bidang{" "}
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortConfig?.key === "bidang" ? "text-slate-900" : "text-slate-300"}`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("status")}
                    className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Status{" "}
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortConfig?.key === "status" ? "text-slate-900" : "text-slate-300"}`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("pangkatGolongan")}
                    className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Gol{" "}
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortConfig?.key === "pangkatGolongan" ? "text-slate-900" : "text-slate-300"}`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("nomorHp")}
                    className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      HP{" "}
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortConfig?.key === "nomorHp" ? "text-slate-900" : "text-slate-300"}`}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <AnimatePresence initial={false}>
                  {displayedEmployees.map((emp, index) => (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      key={emp.id}
                      className="group hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                    >
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-4 py-3 border-b border-r border-slate-100 whitespace-nowrap text-[10px] font-bold text-slate-400">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded-lg border-slate-300 text-slate-900 focus:ring-slate-900/20 cursor-pointer transition-all"
                            onChange={() => handleSelectOne(emp.id!)}
                            checked={emp.id ? selectedIds.has(emp.id) : false}
                          />
                          <span>{String(index + 1).padStart(2, "0")}</span>
                        </div>
                      </td>
                      <td className="sticky left-[56px] z-10 bg-white group-hover:bg-slate-50 px-4 py-3 border-b border-r border-slate-100 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingEmployee(emp);
                              setIsModalOpen(true);
                            }}
                            className="p-1 text-slate-300 hover:text-slate-900 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(emp.id!)}
                            className="p-1 text-slate-300 hover:text-red-600 transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="sticky left-[128px] z-10 bg-white group-hover:bg-slate-50 px-4 py-3 border-b border-r border-slate-100 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[12px] font-bold text-slate-900">
                            {val(emp.nama)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap">
                        <KPKGBBadges emp={emp} />
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap text-[11px] text-slate-500 tabular-nums">
                        {val(emp.nip)}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap text-[11px] text-slate-500 tabular-nums">
                        {val(emp.nik)}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap text-[11px] text-slate-500">
                        {val(emp.jk)}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap text-[11px] text-slate-700 font-medium">
                        {val(emp.jabatan)}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap text-[11px] text-slate-900 font-bold">
                        {val(emp.bidang)}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap">
                        <span className={statusBadge(emp.status)}>
                          {val(emp.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap text-[11px] text-slate-500 tabular-nums">
                        {val(emp.pangkatGolongan)}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap text-[11px] text-slate-500 tabular-nums tracking-tight">
                        {val(emp.nomorHp)}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={17} className="px-6 py-8 text-center bg-white">
                      <EmptyState
                        title="Data belum tersedia"
                        description="Coba sesuaikan kata kunci pencarian atau tambahkan data kepegawaian baru."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden flex-1 overflow-y-auto bg-slate-50/50 p-2 sm:p-4 space-y-3 sm:space-y-4">
            <AnimatePresence initial={false}>
              {displayedEmployees.map((emp, index) => (
                <motion.div
                  {...listItemMotion}
                  key={emp.id}
                  className={`${card} overflow-hidden`}
                >
                  <div className="p-3 sm:p-4 border-b border-slate-100">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">
                          {emp.nama || "-"}
                        </h3>
                        <div className="text-xs text-slate-500 mt-1 font-medium">
                          {emp.nip ? `NIP: ${emp.nip}` : "NIP: -"}
                        </div>
                        <KPKGBBadges emp={emp} />
                      </div>
                      <span className={`${statusBadge(emp.status)} shrink-0`}>
                        {emp.status || "-"}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 grid grid-cols-2 gap-y-3 sm:gap-y-4 gap-x-2 bg-slate-50/30">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Jabatan
                      </div>
                      <div className="text-xs font-semibold text-slate-700">
                        {emp.jabatan || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Unit Kerja
                      </div>
                      <div className="text-xs font-semibold text-indigo-600">
                        {emp.bidang || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Pangkat/Gol
                      </div>
                      <div className="text-xs text-slate-600">
                        {emp.pangkatGolongan || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        No HP
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {emp.nomorHp || "-"}
                      </div>
                    </div>
                  </div>
                  <div className="p-2 sm:p-3 border-t border-slate-100 bg-white flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingEmployee(emp);
                        setIsModalOpen(true);
                      }}
                      className="flex-1 sm:flex-none inline-flex justify-center items-center px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(emp.id!)}
                      className="flex-1 sm:flex-none inline-flex justify-center items-center px-4 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-colors active:scale-[0.98]"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Hapus
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {filteredEmployees.length === 0 && (
              <div className={`${card} py-4`}>
                <EmptyState
                  title="Tidak ada data ditemukan"
                  description="Coba sesuaikan kata kunci pencarian Anda atau tambah pegawai baru."
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmployee ? "Edit Data Pegawai" : "Tambah Pegawai Baru"}
      >
        <EmployeeForm
          initialData={editingEmployee}
          settings={settings}
          onSubmit={handleSave}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Konfirmasi Hapus"
        size="md"
      >
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-red-900">
                Hapus Data Pegawai?
              </h4>
              <p className="text-xs text-red-700 mt-1">
                Tindakan ini tidak dapat dibatalkan. Semua data terkait pegawai
                ini akan dihapus secara permanen dari sistem.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
              className={`${btnSecondary} flex-1 py-2.5 rounded-lg`}
            >
              Batal
            </button>
            <button
              onClick={confirmDelete}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Ya, Hapus Data"
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title="Konfirmasi Hapus Kolektif"
        size="md"
      >
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-red-900">
                Hapus {selectedIds.size} Data Pegawai?
              </h4>
              <p className="text-xs text-red-700 mt-1">
                Tindakan ini tidak dapat dibatalkan. Semua data terkait{" "}
                {selectedIds.size} pegawai ini akan dihapus secara permanen dari
                sistem.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsBulkDeleteModalOpen(false)}
              disabled={isDeletingBulk}
              className={`${btnSecondary} flex-1 py-2.5 rounded-lg`}
            >
              Batal
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isDeletingBulk}
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDeletingBulk ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Ya, Hapus Kolektif"
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Error Toast / Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm"
        >
          <div className="bg-white border border-red-100 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <div className="text-sm font-medium flex-1">
              {(error as Error).message}
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-1 hover:bg-red-50 rounded-lg transition-colors"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
