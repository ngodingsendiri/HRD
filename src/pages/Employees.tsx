import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
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
  Sparkles,
  Loader2,
  Check,
  X,
  AlertCircle,
  Printer,
  ArrowUpDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import { handleFirestoreError, OperationType } from "../lib/error";
import {
  extractEmployeeData,
  extractEmployeeDataFromText,
  mapExcelColumnsWithAI,
} from "../services/geminiService";
import { motion, AnimatePresence } from "motion/react";

import { DEFAULT_KAMUS } from "../constants";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

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
    // Fetch Settings
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "shared/data/settings/app");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as AppSettings);
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();

    const unsubscribe = onSnapshot(
      collection(db, "shared/data/employees"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const d = doc.data();

          let updatedMasaKerja = d.masaKerja || "";
          const statusVal = (d.status || "").toUpperCase();

          if ((statusVal === "PNS" || statusVal === "CPNS") && d.nip) {
            const nipStr = String(d.nip).replace(/[^0-9]/g, "");
            if (nipStr.length >= 14) {
              const yearAppt = parseInt(nipStr.substring(8, 12), 10);
              const monthAppt = parseInt(nipStr.substring(12, 14), 10);
              if (
                !isNaN(yearAppt) &&
                !isNaN(monthAppt) &&
                yearAppt > 1900 &&
                yearAppt <= new Date().getFullYear() &&
                monthAppt >= 1 &&
                monthAppt <= 12
              ) {
                const now = new Date();
                let years = now.getFullYear() - yearAppt;
                let months = now.getMonth() + 1 - monthAppt;
                if (months < 0) {
                  years--;
                  months += 12;
                }
                updatedMasaKerja = `${years} Tahun ${months} Bulan`;
              }
            }
          } else if (
            (statusVal === "PPPK" || statusVal === "PPPKPW") &&
            d.tmtKerja
          ) {
            const tmtDate = new Date(d.tmtKerja);
            if (!isNaN(tmtDate.getTime())) {
              const now = new Date();
              let years = now.getFullYear() - tmtDate.getFullYear();
              let months = now.getMonth() - tmtDate.getMonth();
              if (now.getDate() < tmtDate.getDate()) {
                months--;
              }
              if (months < 0) {
                years--;
                months += 12;
              }
              if (years >= 0 && months >= 0) {
                updatedMasaKerja = `${years} Tahun ${months} Bulan`;
              }
            }
          }

          return {
            id: doc.id,
            ...d,
            masaKerja: updatedMasaKerja,
            nama: d.nama || d.name || "",
            pangkatGolongan: d.pangkatGolongan || d.pangkatGol || "",
            nik: d.nik || "",
            nip: d.nip || "",
            status: d.status || "",
            jabatan: d.jabatan || "",
            bidang: d.bidang || "",
          };
        }) as Employee[];
        setRawEmployees(data);

        // Auto-fill kelasJabatan to database if empty
        const docsToUpdate = snapshot.docs.filter((doc) => {
          const kt = doc.data().kelasJabatan;
          return !kt || String(kt).trim() === "";
        });

        if (docsToUpdate.length > 0) {
          try {
            const batch = writeBatch(db);
            let count = 0;
            for (const d of docsToUpdate) {
              const emp = d.data();
              const jab = (emp.jabatan || "").toLowerCase();
              let predictedKelas = "6"; // default
              if (jab.includes("kepala dinas") || jab.includes("kepala badan"))
                predictedKelas = "14";
              else if (jab.includes("sekretaris")) predictedKelas = "12";
              else if (jab.includes("kepala bidang") || jab.includes("kabid"))
                predictedKelas = "11";
              else if (
                jab.includes("kepala seksi") ||
                jab.includes("kasi ") ||
                jab.includes("kasubbag") ||
                jab.includes("kepala sub")
              )
                predictedKelas = "9";
              else if (jab.includes("madya")) predictedKelas = "11";
              else if (jab.includes("muda")) predictedKelas = "9";
              else if (jab.includes("pertama")) predictedKelas = "8";
              else if (jab.includes("penyelia")) predictedKelas = "8";
              else if (jab.includes("mahir")) predictedKelas = "7";
              else if (jab.includes("terampil")) predictedKelas = "6";
              else if (jab.includes("pemula")) predictedKelas = "5";
              else {
                const p = (
                  emp.pangkatGolongan ||
                  emp.gol ||
                  emp.pangkat ||
                  ""
                ).toUpperCase();
                if (p.includes("IV/E")) predictedKelas = "15";
                else if (p.includes("IV/D")) predictedKelas = "14";
                else if (p.includes("IV/C")) predictedKelas = "13";
                else if (p.includes("IV/B")) predictedKelas = "12";
                else if (p.includes("IV/A")) predictedKelas = "11";
                else if (p.includes("III/D")) predictedKelas = "10";
                else if (p.includes("III/C")) predictedKelas = "9";
                else if (p.includes("III/B")) predictedKelas = "8";
                else if (p.includes("III/A")) predictedKelas = "7";
                else if (p.includes("II/C") || p.includes("II/D"))
                  predictedKelas = "6";
                else if (p.includes("II/A") || p.includes("II/B"))
                  predictedKelas = "5";
                else if (p.includes("I")) predictedKelas = "3";
              }
              batch.update(d.ref, { kelasJabatan: predictedKelas });
              count++;
              if (count >= 490) break; // Firestore batch limit protection
            }
            if (count > 0) {
              batch
                .commit()
                .catch((e) => console.error("Batch update failed:", e));
            }
          } catch (err) {
            console.error("Autofill kelasJabatan error", err);
          }
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, "shared/data/employees");
        } catch (e) {
          if (e instanceof Error) setError(e);
        }
      },
    );

    return () => unsubscribe();
  }, []);

  if (error) {
    throw error;
  }

  const handleSave = async (data: Employee) => {
    try {
      if (editingEmployee?.id) {
        await updateDoc(doc(db, "shared/data/employees", editingEmployee.id), {
          ...data,
          updatedAt: Date.now(),
        });
      } else {
        await addDoc(collection(db, "shared/data/employees"), {
          ...data,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      setIsModalOpen(false);
      setEditingEmployee(undefined);
    } catch (err) {
      try {
        handleFirestoreError(
          err,
          editingEmployee?.id ? OperationType.UPDATE : OperationType.CREATE,
          "shared/data/employees",
        );
      } catch (e) {
        if (e instanceof Error) setError(e);
      }
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
      await deleteDoc(doc(db, "shared/data/employees", employeeToDelete));
      setIsDeleteModalOpen(false);
      setEmployeeToDelete(null);
    } catch (err) {
      try {
        handleFirestoreError(
          err,
          OperationType.DELETE,
          `shared/data/employees/${employeeToDelete}`,
        );
      } catch (e) {
        if (e instanceof Error) setError(e);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    const exportData = employees.map(
      ({ id, dataKeluarga, createdAt, updatedAt, ...rest }) => {
        return {
          Nama: rest.nama,
          "N I P": rest.nip,
          "N I K": rest.nik,
          JK: rest.jk,
          "Tempat Lahir": rest.tempatLahir,
          "Tanggal Lahir": rest.tanggalLahir,
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
          Pensiun: rest.pensiun,
          "TMT Golongan Ruang": rest.tmtGolonganRuang,
          "Masa Kerja Golongan Ruang": rest.masaKerjaGolonganRuang,
          "No. Rekening Bank": rest.noRekeningBank,
          NPWP: rest.npwp,
          Pangkat: rest.pangkat,
          Gol: rest.gol,
          "Tanggal Berkala Terakhir": rest.tanggalBerkalaTerakhir,
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
          "Nama Istri/Suami":
            dataKeluarga?.find(
              (k: any) => k.relation === "Istri" || k.relation === "Suami",
            )?.name || "",
          "Tanggal Lahir Pasangan":
            dataKeluarga?.find(
              (k: any) => k.relation === "Istri" || k.relation === "Suami",
            )?.birthDate || "",
          "Perkawinan Pasangan":
            dataKeluarga?.find(
              (k: any) => k.relation === "Istri" || k.relation === "Suami",
            )?.marriageDate || "",
          "Pekerjaan Pasangan":
            dataKeluarga?.find(
              (k: any) => k.relation === "Istri" || k.relation === "Suami",
            )?.occupation || "",
          "Keterangan Pasangan":
            dataKeluarga?.find(
              (k: any) => k.relation === "Istri" || k.relation === "Suami",
            )?.description || "",
          "Nama Anak 1":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[0]?.name ||
            "",
          "Tanggal Lahir Anak 1":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[0]
              ?.birthDate || "",
          "Perkawinan Anak 1":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[0]
              ?.marriageDate || "",
          "Pekerjaan Anak 1":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[0]
              ?.occupation || "",
          "Keterangan Anak 1":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[0]
              ?.description || "",
          "Nama Anak 2":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[1]?.name ||
            "",
          "Tanggal Lahir Anak 2":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[1]
              ?.birthDate || "",
          "Perkawinan Anak 2":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[1]
              ?.marriageDate || "",
          "Pekerjaan Anak 2":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[1]
              ?.occupation || "",
          "Keterangan Anak 2":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[1]
              ?.description || "",
          "Nama Anak 3":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[2]?.name ||
            "",
          "Tanggal Lahir Anak 3":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[2]
              ?.birthDate || "",
          "Perkawinan Anak 3":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[2]
              ?.marriageDate || "",
          "Pekerjaan Anak 3":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[2]
              ?.occupation || "",
          "Keterangan Anak 3":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[2]
              ?.description || "",
          "Nama Anak 4":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[3]?.name ||
            "",
          "Tanggal Lahir Anak 4":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[3]
              ?.birthDate || "",
          "Perkawinan Anak 4":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[3]
              ?.marriageDate || "",
          "Pekerjaan Anak 4":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[3]
              ?.occupation || "",
          "Keterangan Anak 4":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[3]
              ?.description || "",
          "Nama Anak 5":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[4]?.name ||
            "",
          "Tanggal Lahir Anak 5":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[4]
              ?.birthDate || "",
          "Perkawinan Anak 5":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[4]
              ?.marriageDate || "",
          "Pekerjaan Anak 5":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[4]
              ?.occupation || "",
          "Keterangan Anak 5":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[4]
              ?.description || "",
          "Jumlah Tertanggung": rest.jumlahTertanggung,
        };
      },
    );
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pegawai");
    XLSX.writeFile(wb, "Data_Pegawai_Full.xlsx");
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Nama",
      "N I P",
      "N I K",
      "JK",
      "Tempat Lahir",
      "Tanggal Lahir",
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
      "Pensiun",
      "TMT Golongan Ruang",
      "Masa Kerja Golongan Ruang",
      "No. Rekening Bank",
      "NPWP",
      "Pangkat",
      "Gol",
      "Tanggal Berkala Terakhir",
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
        "11 Januari 1983",
        "Perum Muktisari Blok BF No. 6",
        "004",
        "003",
        "Tegal Besar",
        "Kaliwates",
        "Jember",
        "10",
        "Tinggi",
        "02 Januari 2026",
        "24 Tahun 4 Bulan",
        "2041-01-11",
        "01/10/2025",
        "Pembina Tk. I",
        "IV.b",
        "01/10/2025",
        "4.672.800",
        "7.236.979",
        "Kepala Dinas",
        "Sekretariat",
        "PNS",
        "L.066441",
        "S2",
        "Ilmu Pemerintahan",
        "PIM II",
        "2020",
        "Kawin",
        "Islam",
        "081252748226",
        "12",
        "0",
        "0",
        "Bupati Jember",
        "-",
        "Sekda Jember",
        "-",
        "SK Bupati No. 123",
        "Nama Pasangan",
        "1985-01-01",
        "2010-01-01",
        "Wiraswasta",
        "Aktif",
        "Anak Pertama",
        "2012-05-10",
        "-",
        "Sekolah",
        "Tertanggung",
        "Anak Kedua",
        "2017-08-20",
        "-",
        "Belum Sekolah",
        "Tertanggung",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "2",
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
        let successCount = 0;
        let updateCount = 0;

        if (rows.length === 0) throw new Error("File Excel kosong.");

        // Load existing employees for upsert logic (prevent duplicates)
        const existingSnapshot = await getDocs(
          collection(db, "shared/data/employees"),
        );
        const nipMap: Record<string, string> = {};
        const nikMap: Record<string, string> = {};
        existingSnapshot.docs.forEach((d) => {
          const data = d.data();
          if (data.nip) nipMap[String(data.nip).trim()] = d.id;
          if (data.nik) nikMap[String(data.nik).trim()] = d.id;
        });

        // Find header row and create mapping
        let headerIdx = -1;
        let colMap: Record<string, number> = {};

        // Search first 10 rows for headers
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const row = rows[i];
          if (
            row.some((c) => {
              const s = String(c || "").toUpperCase();
              return (
                s === "NIP" ||
                s === "NIK" ||
                s === "NAMA LENGKAP" ||
                s === "N I P"
              );
            })
          ) {
            headerIdx = i;
            row.forEach((cell, idx) => {
              if (cell) colMap[String(cell).trim().toUpperCase()] = idx;
            });
            break;
          }
        }

        // Helper to get value by possible header names
        const getVal = (row: any[], names: string[]) => {
          for (const name of names) {
            const idx = colMap[name.toUpperCase()];
            if (idx !== undefined) return row[idx];
          }
          return undefined;
        };

        // Helper to convert Excel date number to string
        const excelDateToJSDate = (serial: any) => {
          if (typeof serial !== "number") return String(serial || "").trim();
          if (serial < 10000) return String(serial).trim(); // Not a serial date
          const utc_days = Math.floor(serial - 25569);
          const utc_value = utc_days * 86400;
          const date_info = new Date(utc_value * 1000);
          return date_info.toISOString().split("T")[0];
        };

        // If we found headers, we can use direct mapping
        if (headerIdx !== -1) {
          const dataRows = rows.slice(headerIdx + 1);

          // Use batch to prevent freezing and multiple onSnapshot triggers
          let batch = writeBatch(db);
          let batchCount = 0;

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];

            if (!row || row.length < 2) continue;

            const nama = String(
              getVal(row, ["Nama Lengkap", "Nama", "NAMA"]) || "",
            ).trim();
            const nik = String(getVal(row, ["NIK", "N I K"]) || "").trim();
            const nip = String(getVal(row, ["NIP", "N I P"]) || "").trim();

            if (!nama && !nik && !nip) continue;
            if (nama.toLowerCase().includes("nama lengkap")) continue;

            // Family Data Parsing
            const dataKeluarga: any[] = [];
            const spouseName = getVal(row, [
              "Nama Istri/Suami",
              "Nama Pasangan",
            ]);
            if (spouseName && String(spouseName).trim()) {
              const jk = String(
                getVal(row, ["JK", "Jenis Kelamin"]) || "",
              ).toUpperCase();
              dataKeluarga.push({
                name: String(spouseName).trim(),
                relation: jk.includes("L") ? "Istri" : "Suami",
                birthDate: excelDateToJSDate(
                  getVal(row, ["Tgl Lahir Pasangan", "Tanggal Lahir Pasangan"]),
                ),
                marriageDate: excelDateToJSDate(
                  getVal(row, ["Tgl Nikah", "Tanggal Nikah"]),
                ),
                occupation: String(
                  getVal(row, ["Pekerjaan Pasangan"]) || "",
                ).trim(),
                description: String(
                  getVal(row, ["Keterangan Pasangan"]) || "",
                ).trim(),
              });
            }

            // Children
            for (let c = 1; c <= 5; c++) {
              const cName = getVal(row, [`Nama Anak ${c}`]);
              if (cName && String(cName).trim()) {
                dataKeluarga.push({
                  name: String(cName).trim(),
                  relation: "Anak",
                  birthDate: excelDateToJSDate(
                    getVal(row, [`Tgl Lahir Anak ${c}`]),
                  ),
                  marriageDate: excelDateToJSDate(
                    getVal(row, [`Tgl Nikah Anak ${c}`]),
                  ),
                  occupation: String(
                    getVal(row, [`Pekerjaan Anak ${c}`]) || "",
                  ).trim(),
                  description: String(
                    getVal(row, [`Keterangan Anak ${c}`]) || "",
                  ).trim(),
                });
              }
            }

            let rawStatus = String(
              getVal(row, ["Status"]) || "PNS",
            ).toUpperCase();
            let status: Employee["status"] = "PNS";
            if (rawStatus.includes("CPNS")) status = "CPNS";
            else if (rawStatus.includes("PPPKPW")) status = "PPPKPW";
            else if (rawStatus.includes("PPPK")) status = "PPPK";
            else if (rawStatus.includes("PNS")) status = "PNS";

            const employeeData: Partial<Employee> = {
              nip,
              nik,
              nama,
              jk: String(getVal(row, ["JK", "Jenis Kelamin"]) || "")
                .trim()
                .toUpperCase()
                .startsWith("L")
                ? "L"
                : "P",
              tempatLahir: String(getVal(row, ["Tempat Lahir"]) || "").trim(),
              tanggalLahir: excelDateToJSDate(
                getVal(row, ["Tanggal Lahir", "Tgl Lahir"]),
              ),
              jalanDusun: String(
                getVal(row, ["Jalan/Dusun", "Alamat"]) || "",
              ).trim(),
              rt: String(getVal(row, ["RT"]) || "").trim(),
              rw: String(getVal(row, ["RW"]) || "").trim(),
              desaKelurahan: String(
                getVal(row, ["Desa/Kelurahan"]) || "",
              ).trim(),
              kecamatan: String(getVal(row, ["Kecamatan"]) || "").trim(),
              kabupaten: String(getVal(row, ["Kabupaten"]) || "").trim(),
              kelasJabatan: String(getVal(row, ["Kelas Jabatan"]) || "").trim(),
              bebanKerja: String(getVal(row, ["Beban Kerja"]) || "").trim(),
              tmtKerja: excelDateToJSDate(getVal(row, ["TMT Kerja"])),
              masaKerja: String(getVal(row, ["Masa Kerja"]) || "").trim(),
              pensiun: excelDateToJSDate(getVal(row, ["Pensiun"])),
              tmtGolonganRuang: excelDateToJSDate(
                getVal(row, ["TMT Golongan Ruang"]),
              ),
              masaKerjaGolonganRuang: String(
                getVal(row, ["Masa Kerja Golongan Ruang"]) || "",
              ).trim(),
              noRekeningBank: String(
                getVal(row, ["No. Rekening Bank", "Rekening"]) || "",
              ).trim(),
              npwp: String(getVal(row, ["NPWP"]) || "").trim(),
              pangkat: String(getVal(row, ["Pangkat"]) || "").trim(),
              gol: String(getVal(row, ["Gol"]) || "").trim(),
              pangkatGolongan:
                `${getVal(row, ["Pangkat"]) || ""} / ${getVal(row, ["Gol"]) || ""}`.trim(),
              tanggalBerkalaTerakhir: excelDateToJSDate(
                getVal(row, ["Tanggal Berkala Terakhir"]),
              ),
              gajiPokok: String(getVal(row, ["Gaji Pokok"]) || "").trim(),
              besaranGajiKotor: String(
                getVal(row, ["Besaran Gaji Kotor"]) || "",
              ).trim(),
              digajiMenurut: String(
                getVal(row, ["Digaji Menurut PP/SK"]) || "",
              ).trim(),
              jabatan: String(getVal(row, ["Jabatan"]) || "").trim(),
              bidang: String(
                getVal(row, ["Bidang", "Unit Kerja"]) || "",
              ).trim(),
              status,
              nomorKarpeg: String(getVal(row, ["Nomor Karpeg"]) || "").trim(),
              pendidikan: String(getVal(row, ["Pendidikan"]) || "").trim(),
              jurusan: String(getVal(row, ["Jurusan"]) || "").trim(),
              diklatJenjang: String(
                getVal(row, ["Diklat Jenjang"]) || "",
              ).trim(),
              tahunDiklat: String(getVal(row, ["Tahun Diklat"]) || "").trim(),
              statusKawin: String(getVal(row, ["Status Kawin"]) || "").trim(),
              agama: String(getVal(row, ["Agama"]) || "").trim(),
              nomorHp: String(
                getVal(row, ["Nomor HP", "No HP", "Nomo HP", "No. HP"]) || "",
              ).trim(),
              sisaCutiN: String(getVal(row, ["Sisa Cuti N"]) || "").trim(),
              sisaCutiN1: String(getVal(row, ["Sisa Cuti N-1"]) || "").trim(),
              sisaCutiN2: String(getVal(row, ["Sisa Cuti N-2"]) || "").trim(),
              skTerakhir: String(getVal(row, ["SK Terakhir"]) || "").trim(),
              jumlahTertanggung: Number(
                getVal(row, ["Jumlah Tertanggung"]) || 0,
              ),
              dataKeluarga,
            };

            // Apply Kamus Auto-fill during import if empty
            if (settings?.jabatanKamusCsv && employeeData.jabatan) {
              const rows = settings.jabatanKamusCsv.split("\n");
              for (const kamusRow of rows) {
                if (!kamusRow || kamusRow.trim() === "") continue;
                const cols = kamusRow.split(/;|\t/);
                if (cols.length >= 4) {
                  const kamusJabatan = cols[1]?.trim().toLowerCase() || "";
                  if (kamusJabatan === employeeData.jabatan.toLowerCase()) {
                    if (!employeeData.kelasJabatan)
                      employeeData.kelasJabatan = cols[2]?.trim() || "";
                    if (!employeeData.bebanKerja)
                      employeeData.bebanKerja = cols[3]?.trim() || "";
                    break;
                  }
                }
              }
            }

            let existingId = null;
            if (nip && nipMap[nip]) existingId = nipMap[nip];
            else if (nik && nikMap[nik]) existingId = nikMap[nik];

            const docRef = existingId
              ? doc(db, "shared/data/employees", existingId)
              : doc(collection(db, "shared/data/employees"));

            batch.set(
              docRef,
              {
                ...employeeData,
                ...(existingId ? {} : { createdAt: Date.now() }),
                updatedAt: Date.now(),
              },
              { merge: true },
            );

            batchCount++;
            if (existingId) updateCount++;
            else successCount++;

            if (batchCount >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
          }
        } else {
          // AI SEMI-AUTO MAPPING (Fallback if no standard headers found)
          const rawHeaders = rows[0].map((h) => String(h || "").trim());
          const validHeaders = rawHeaders.filter((h) => h !== "");

          if (validHeaders.length === 0)
            throw new Error("File Excel tidak memiliki header yang valid.");

          const mapping = await mapExcelColumnsWithAI(validHeaders);
          if (!mapping || Object.keys(mapping).length === 0) {
            throw new Error(
              "AI tidak dapat mengenali kolom di file Excel Anda.",
            );
          }

          const dataRows = rows.slice(1);
          let batch = writeBatch(db);
          let batchCount = 0;

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (!row || row.length === 0) continue;

            const employeeData: any = {
              dataKeluarga: [],
            };

            rawHeaders.forEach((header, idx) => {
              const field = mapping[header];
              if (field && row[idx] !== undefined) {
                employeeData[field] = excelDateToJSDate(row[idx]);
              }
            });

            const nipRaw = String(employeeData.nip || "").trim();
            const nikRaw = String(employeeData.nik || "").trim();

            if (employeeData.nama || nikRaw || nipRaw) {
              // Apply Kamus Auto-fill for AI Mapping as well
              if (settings?.jabatanKamusCsv && employeeData.jabatan) {
                const rows = settings.jabatanKamusCsv.split("\n");
                for (const kamusRow of rows) {
                  if (!kamusRow || kamusRow.trim() === "") continue;
                  const cols = kamusRow.split(/;|\t/);
                  if (cols.length >= 4) {
                    const kamusJabatan = cols[1]?.trim().toLowerCase() || "";
                    if (
                      kamusJabatan ===
                      String(employeeData.jabatan).trim().toLowerCase()
                    ) {
                      if (!employeeData.kelasJabatan)
                        employeeData.kelasJabatan = cols[2]?.trim() || "";
                      if (!employeeData.bebanKerja)
                        employeeData.bebanKerja = cols[3]?.trim() || "";
                      break;
                    }
                  }
                }
              }

              let existingId = null;
              if (nipRaw && nipMap[nipRaw]) existingId = nipMap[nipRaw];
              else if (nikRaw && nikMap[nikRaw]) existingId = nikMap[nikRaw];

              const docRef = existingId
                ? doc(db, "shared/data/employees", existingId)
                : doc(collection(db, "shared/data/employees"));

              batch.set(
                docRef,
                {
                  ...employeeData,
                  ...(existingId ? {} : { createdAt: Date.now() }),
                  updatedAt: Date.now(),
                },
                { merge: true },
              );

              batchCount++;
              if (existingId) updateCount++;
              else successCount++;

              if (batchCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
              }
            }
          }

          if (batchCount > 0) {
            await batch.commit();
          }
        }

        alert(
          `Import selesai! Berhasil menambah ${successCount} data baru, dan memperbarui/melengkapi ${updateCount} data lama.`,
        );
      } catch (err) {
        console.error("Import error:", err);
        alert("Gagal mengimport data. Pastikan format file benar.");
      } finally {
        e.target.value = ""; // Reset input
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
      let batch = writeBatch(db);
      let i = 0;
      for (const id of selectedIds) {
        batch.delete(doc(db, "shared/data/employees", id));
        i++;
        if (i % 400 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
      if (i > 0) await batch.commit();
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
    } catch (err) {
      try {
        handleFirestoreError(
          err,
          OperationType.DELETE,
          "shared/data/employees",
        );
      } catch (e) {
        if (e instanceof Error) setError(e);
      }
    } finally {
      setIsDeletingBulk(false);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-5 md:space-y-10 max-w-[1400px] mx-auto p-4 sm:p-0 pb-12 antialiased"
    >
      {/* Page Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6 border-b border-slate-100 pb-5 md:pb-8"
      >
        <div className="w-full lg:w-auto">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Direktori Pegawai
          </h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Kelola informasi induk pegawai, penempatan, dan rekam jejak karir
            secara terpusat.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
          <button
            onClick={handleDownloadTemplate}
            className="w-full sm:w-auto justify-center group inline-flex items-center px-4 py-2.5 text-[12px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-emerald-600" />
            Template
          </button>

          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden w-full sm:w-auto">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2.5 text-[12px] font-bold text-white bg-red-600 hover:bg-red-700 transition-all active:scale-95 border-r border-red-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus {selectedIds.size}</span>
              </button>
            )}
            <button
              onClick={() => {
                setEditingEmployee(undefined);
                setIsModalOpen(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2.5 text-[12px] font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Data</span>
            </button>
            <label className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-bold text-slate-700 hover:bg-slate-50 border-r border-slate-100 transition-all active:scale-95 cursor-pointer order-first">
              <Upload className="w-3.5 h-3.5" />
              <span>Impor Excel</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleImport}
              />
            </label>
            <button
              onClick={handleExport}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Data</span>
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-4 md:space-y-6">
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
              className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900/10 active:scale-95 transition-all cursor-pointer "
            >
              <option value={10}>10 Baris</option>
              <option value={20}>20 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-100 overflow-hidden flex flex-col h-[600px] ">
          {/* Desktop Table View */}
          <div className="hidden lg:block flex-1 overflow-auto bg-slate-50">
            <table className="min-w-[1500px] w-full border-collapse bg-white">
              <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-50 px-4 py-3 border-r border-slate-100 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-14">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900/20 cursor-pointer"
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
                <AnimatePresence mode="popLayout">
                  {displayedEmployees.map((emp, index) => (
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      key={emp.id}
                      className="group hover:bg-slate-50 transition-colors duration-150 border-b border-slate-100 last:border-0"
                    >
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-4 py-3 border-b border-r border-slate-100 whitespace-nowrap text-[10px] font-bold text-slate-400">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900/20 cursor-pointer transition-all"
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
                        <span
                          className={`px-2 py-0.5 inline-flex text-[9px] font-bold uppercase tracking-wider rounded border
 ${
   emp.status === "PNS"
     ? "bg-slate-900 text-white border-slate-900"
     : emp.status === "PPPK"
       ? "bg-white text-slate-900 border-slate-200"
       : "bg-slate-100 text-slate-600 border-slate-200"
 }`}
                        >
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
                    <td
                      colSpan={16}
                      className="px-6 py-16 text-center bg-white"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-4 ring-4 ring-white border border-slate-100">
                          <Search className="w-6 h-6 text-slate-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Data belum tersedia
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          Coba sesuaikan kata kunci pencarian atau tambahkan
                          data kepegawaian baru.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden flex-1 overflow-y-auto bg-slate-50/50 p-2 sm:p-4 space-y-3 sm:space-y-4">
            <AnimatePresence mode="popLayout">
              {displayedEmployees.map((emp, index) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  key={emp.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
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
                      </div>
                      <span
                        className={`px-2 py-1 inline-flex text-[10px] font-bold uppercase tracking-wider rounded border shrink-0
 ${
   emp.status === "PNS"
     ? "bg-emerald-50 text-emerald-700 border-emerald-100"
     : emp.status === "CPNS"
       ? "bg-sky-50 text-sky-700 border-sky-100"
       : emp.status === "PPPK"
         ? "bg-indigo-50 text-indigo-700 border-indigo-100"
         : emp.status === "PPPKPW"
           ? "bg-violet-50 text-violet-700 border-violet-100"
           : "bg-slate-50 text-slate-700 border-slate-100"
 }`}
                      >
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
                      className="flex-1 sm:flex-none inline-flex justify-center items-center px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Hapus
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {filteredEmployees.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-slate-300" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Tidak ada data ditemukan
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Coba sesuaikan kata pencarian.
                </p>
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
              className="flex-1 px-4 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
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
              className="flex-1 px-4 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
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
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-red-600 text-white px-6 py-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <div className="text-sm font-medium">{error.message}</div>
            <button
              onClick={() => setError(null)}
              className="ml-4 p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
