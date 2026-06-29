import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Employee, AppSettings } from "../types";
import { Printer, Settings, Users, FileText, ChevronDown } from "lucide-react";

type PrintType =
  | "absen_global"
  | "absen_bidang"
  | "tanda_terima"
  | "surat_cuti"
  | "anjab"
  | "model_dk"
  | "duk"
  | "bezetting"
  | "usulan_kgb"
  | "usulan_kp";
type SortAction = "default_kelas" | "abjad";

export default function Print() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Print Configuration States
  const [printCategory, setPrintCategory] = useState<"laporan" | "layanan">(
    "laporan",
  );
  const [printType, setPrintType] = useState<PrintType>("absen_global");
  const [customTitle, setCustomTitle] = useState("DAFTAR HADIR / ABSENSI");
  const [customSubtitle, setCustomSubtitle] = useState(
    "KEGIATAN: .......................................",
  );
  const [selectedBidang, setSelectedBidang] = useState<string>("Semua");
  const [sortOption, setSortOption] = useState<SortAction>("default_kelas");

  // Cuti Form Config
  const [cutiEmployeeId, setCutiEmployeeId] = useState<string>("");
  const [cutiJenis, setCutiJenis] = useState<string>("1. Cuti Tahunan");
  const [cutiAlasan, setCutiAlasan] = useState<string>("Ibadah Umroh");
  const [cutiLamaHari, setCutiLamaHari] = useState<number>(13);
  const [cutiMulai, setCutiMulai] = useState<string>("2026-03-02");
  const [cutiAkhir, setCutiAkhir] = useState<string>("2026-03-18");
  const [cutiAlamat, setCutiAlamat] = useState<string>("Mekah");
  const [cutiHp, setCutiHp] = useState<string>("082120202180");
  const [cutiMasaKerja, setCutiMasaKerja] =
    useState<string>("0 Tahun 10 Bulan");

  useEffect(() => {
    if (cutiMulai && cutiAkhir) {
      const start = new Date(cutiMulai);
      const end = new Date(cutiAkhir);

      let workDays = 0;
      let currentDate = new Date(start);

      // Mocked public holidays (can be updated later)
      const publicHolidays = [
        "2024-01-01",
        "2024-02-08",
        "2024-02-09",
        "2024-02-10",
        "2024-03-11",
        "2024-03-12",
        "2024-03-29",
        "2024-03-31",
        "2024-04-10",
        "2024-04-11",
        "2024-05-01",
        "2024-05-09",
        "2024-05-23",
        "2024-06-01",
        "2024-06-17",
        "2024-07-07",
        "2024-08-17",
        "2024-09-16",
        "2024-12-25",
        "2025-01-01",
        "2025-01-27",
        "2025-03-29",
        "2025-03-31",
        "2025-04-18",
        "2025-05-01",
        "2025-05-12",
        "2025-05-29",
        "2025-06-01",
        "2025-06-27",
        "2025-08-17",
        "2025-09-05",
        "2025-12-25",
        "2026-01-01",
        "2026-02-17",
        "2026-03-19",
        "2026-03-20",
        "2026-04-03",
        "2026-05-01",
        "2026-05-14",
        "2026-06-01",
        "2026-06-16",
        "2026-08-17",
        "2026-12-25",
      ];

      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay();
        const dateString = currentDate.toISOString().split("T")[0];

        // Exclude weekends (0 = Sunday, 6 = Saturday) and public holidays
        if (
          dayOfWeek !== 0 &&
          dayOfWeek !== 6 &&
          !publicHolidays.includes(dateString)
        ) {
          workDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (workDays >= 0) setCutiLamaHari(workDays);
    }
  }, [cutiMulai, cutiAkhir]);

  useEffect(() => {
    if (cutiJenis.startsWith("3")) {
      setCutiAlasan("Sakit");
    } else if (cutiJenis.startsWith("4")) {
      setCutiAlasan("Melahirkan");
    }
  }, [cutiJenis]);

  useEffect(() => {
    if (cutiEmployeeId && employees.length > 0) {
      const emp = employees.find((e) => e.id === cutiEmployeeId);
      if (emp) {
        setCutiMasaKerja(emp.masaKerja || "");
        setCutiHp(emp.nomorHp || "");
      }
    }
  }, [cutiEmployeeId, employees]);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Settings
        const settingsDoc = await getDoc(doc(db, "shared/data/settings/app"));
        let currentSettings: AppSettings | null = null;
        if (settingsDoc.exists()) {
          currentSettings = settingsDoc.data() as AppSettings;
          setSettings(currentSettings);
        }

        // Fetch Employees
        const empSnapshot = await getDocs(
          collection(db, "shared/data/employees"),
        );
        let empData = empSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Employee,
        );

        // Apply Kamus Jabatan Overrides dynamically
        if (currentSettings?.jabatanKamusCsv) {
          const kamusMap = new Map<string, { kelas: string; beban: string }>();
          const rows = currentSettings.jabatanKamusCsv.split("\n");
          for (let i = 1; i < rows.length; i++) {
            const kamusRow = rows[i];
            if (!kamusRow || kamusRow.trim() === "") continue;
            const cols = kamusRow.split(/;|\t/);
            if (cols.length >= 4) {
              kamusMap.set(cols[1].trim().toLowerCase(), {
                kelas: cols[2].trim(),
                beban: cols[3].trim(),
              });
            }
          }

          empData = empData.map((emp) => {
            if (emp.jabatan && kamusMap.has(emp.jabatan.trim().toLowerCase())) {
              const match = kamusMap.get(emp.jabatan.trim().toLowerCase())!;
              return {
                ...emp,
                kelasJabatan: match.kelas,
                bebanKerja: match.beban,
              };
            }
            return emp;
          });
        }

        setEmployees(empData);
      } catch (err) {
        console.error("Error fetching data for print:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const getUniqueBidang = () => {
    const bidangSet = new Set(
      employees.map((e) => e.bidang || "Tidak Ada Bidang"),
    );
    return Array.from(bidangSet).sort();
  };

  const filteredEmployees = employees.filter((emp) => {
    if (printType === "absen_bidang" && selectedBidang !== "Semua") {
      return (emp.bidang || "Tidak Ada Bidang") === selectedBidang;
    }
    return true;
  });

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    if (sortOption === "abjad") {
      return (a.nama || "").localeCompare(b.nama || "");
    } else {
      // Status
      const statusOrder: Record<string, number> = {
        PNS: 1,
        CPNS: 2,
        PPPK: 3,
        PPPKPW: 4,
        Lainnya: 5,
      };

      const statusA = statusOrder[a.status || ""] || 99;
      const statusB = statusOrder[b.status || ""] || 99;

      if (statusA !== statusB) {
        return statusA - statusB;
      }

      // Kelas Jabatan (DESC)
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

      // Fallback a to z
    }
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 font-medium text-slate-500 text-sm">
        Menginisialisasi data formulir cetak...
      </div>
    );
  }

  const toProperCase = (str: string) => {
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase(),
    );
  };

  const getHierarchy = (emp: Employee | undefined) => {
    if (!emp)
      return { atasan: "-", nipAtasan: "-", pejabat: "-", nipPejabat: "-" };
    const kadis = employees.find((e) =>
      e.jabatan?.toLowerCase().includes("kepala dinas"),
    );
    const sekre = employees.find(
      (e) =>
        e.jabatan?.toLowerCase().includes("sekretaris") &&
        e.bidang?.toLowerCase().includes("sekretariat"),
    );
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
    if (isKabid || isSekretariat) {
      return {
        atasan: sekre?.nama || "-",
        nipAtasan: sekre?.nip || "-",
        pejabat: kadis?.nama || "-",
        nipPejabat: kadis?.nip || "-",
      };
    }

    return {
      atasan: kabid?.nama || "-",
      nipAtasan: kabid?.nip || "-",
      pejabat: kadis?.nama || "-",
      nipPejabat: kadis?.nip || "-",
    };
  };

  // Find employee with "kepala dinas" or "kadis" in their jabatan
  const kadisEmp = employees.find((e) =>
    /(kepala\s+dinas|kadis)/i.test(e.jabatan || ""),
  );
  const kadisTitle = settings?.kopLine2
    ? `Kepala ${toProperCase(settings.kopLine2)}`
    : "Kepala Dinas Komunikasi Dan Informatika";
  const ttdName =
    kadisEmp?.nama || "...........................................";
  const ttdPangkat =
    kadisEmp?.pangkatGolongan || "Pangkat Golongan ..........................";
  const ttdNip = kadisEmp?.nip || "........................................";

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 md:space-y-8 p-4 sm:p-0 sm:py-8 pb-12 antialiased">
      {/* Control Panel (Hidden on Print) */}
      <div className="print-hidden space-y-5 md:space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6 border-b border-slate-100 pb-5 md:pb-8">
          <div className="w-full lg:w-auto">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Pusat Pencetakan Dokumen
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">
              Konfigurasi pratinjau tabel pracetak dan detail dokumen Anda.
            </p>
          </div>
          <button
            onClick={async () => {
              if (printType === "surat_cuti" && cutiJenis.startsWith("1")) {
                if (
                  window.confirm(
                    "Cetak surat cuti akan memotong sisa cuti pegawai secara otomatis. Lanjutkan?",
                  )
                ) {
                  try {
                    const emp = employees.find((e) => e.id === cutiEmployeeId);
                    if (emp) {
                      const sisaN = parseInt(emp.sisaCutiN || "0") || 0;
                      const sisaN1 = parseInt(emp.sisaCutiN1 || "0") || 0;
                      const sisaN2 = parseInt(emp.sisaCutiN2 || "0") || 0;

                      let toDeduct = cutiLamaHari;
                      let newN = sisaN;
                      let newN1 = sisaN1;
                      let newN2 = sisaN2;

                      // Deduct logic: Usually deduct from N first or N-2 first? Most rules deduct from N-2 first, then N-1, then N.
                      if (toDeduct <= newN2) {
                        newN2 -= toDeduct;
                      } else {
                        toDeduct -= newN2;
                        newN2 = 0;
                        if (toDeduct <= newN1) {
                          newN1 -= toDeduct;
                        } else {
                          toDeduct -= newN1;
                          newN1 = 0;
                          if (toDeduct <= newN) {
                            newN -= toDeduct;
                          } else {
                            newN = 0; // Cut off, max available cuti taken
                          }
                        }
                      }

                      const empRef = doc(db, "shared/data/employees", emp.id!);
                      await updateDoc(empRef, {
                        sisaCutiN: String(newN),
                        sisaCutiN1: String(newN1),
                        sisaCutiN2: String(newN2),
                      });

                      // Refresh local state without reloading whole page to show updated preview
                      setEmployees(
                        employees.map((e) =>
                          e.id === emp.id
                            ? {
                                ...e,
                                sisaCutiN: String(newN),
                                sisaCutiN1: String(newN1),
                                sisaCutiN2: String(newN2),
                              }
                            : e,
                        ),
                      );
                    }
                    setTimeout(() => window.print(), 300);
                  } catch (err) {
                    console.error("Gagal mengurangi sisa cuti", err);
                    alert("Terjadi kesalahan saat mengurangi sisa cuti.");
                  }
                }
              } else {
                try {
                  window.print();
                } catch (e) {
                  alert(
                    "Perintah otomatis terblokir oleh browser. Silakan tekan Ctrl+P atau Cmd+P untuk mencetak secara manual.",
                  );
                }
              }
            }}
            className="flex items-center gap-2 px-6 py-2.5 text-[13px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors active:scale-95 w-full lg:w-auto justify-center"
            title="Klik untuk cetak atau tekan Ctrl+P"
          >
            <Printer className="w-4 h-4" />
            Cetak Dokumen Sekarang
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-[12px] text-amber-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <p>
            Jika tombol cetak tidak berfungsi di mode pratinjau ini, silakan
            tekan <strong>Ctrl+P</strong> (Windows) atau <strong>Cmd+P</strong>{" "}
            (Mac) langsung pada keyboard Anda.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-max">
          <button
            onClick={() => {
              setPrintCategory("laporan");
              setPrintType("absen_global");
              setCustomTitle("DAFTAR HADIR / ABSENSI PEGAWAI");
              setSelectedBidang("Semua");
            }}
            className={`flex-1 sm:flex-none px-6 py-2 font-bold text-[12px] rounded-lg transition-colors ${printCategory === "laporan" ? "bg-white text-slate-900 " : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"}`}
          >
            Laporan Umum
          </button>
          <button
            onClick={() => {
              setPrintCategory("layanan");
              setPrintType("surat_cuti");
              setCustomTitle("SURAT IZIN CUTI PEGAWAI");
            }}
            className={`flex-1 sm:flex-none px-6 py-2 font-bold text-[12px] rounded-lg transition-colors ${printCategory === "layanan" ? "bg-white text-slate-900 " : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"}`}
          >
            Layanan Kepegawaian
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {printCategory === "laporan" && (
            <>
              <button
                onClick={() => {
                  setPrintType("absen_global");
                  setCustomTitle("DAFTAR HADIR / ABSENSI PEGAWAI");
                  setSelectedBidang("Semua");
                }}
                className={`px-4 py-2 rounded-lg text-[12px] font-bold transition-colors border ${printType === "absen_global" || printType === "absen_bidang" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"}`}
              >
                Daftar Hadir / Absensi
              </button>
              <button
                onClick={() => {
                  setPrintType("tanda_terima");
                  setCustomTitle("DAFTAR TANDA TERIMA ......................");
                }}
                className={`px-4 py-2 rounded-lg text-[12px] font-bold transition-colors border ${printType === "tanda_terima" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"}`}
              >
                Tanda Terima
              </button>
              <button
                onClick={() => {
                  setPrintType("duk");
                  setCustomTitle("DAFTAR URUT KEPANGKATAN (DUK)");
                }}
                className={`px-4 py-2 rounded-lg text-[12px] font-bold transition-colors border ${printType === "duk" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"}`}
              >
                Data Urut Kepangkatan
              </button>
            </>
          )}

          {printCategory === "layanan" && (
            <>
              <button
                onClick={() => {
                  setPrintType("surat_cuti");
                  setCustomTitle("SURAT IZIN CUTI PEGAWAI");
                }}
                className={`px-4 py-2 rounded-lg text-[12px] font-bold transition-colors border ${printType === "surat_cuti" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"}`}
              >
                Surat Cuti
              </button>
              <button
                onClick={() => {
                  setPrintType("model_dk");
                  setCustomTitle(
                    "SURAT KETERANGAN UNTUK MENDAPATKAN PEMBAYARAN TUNJANGAN KELUARGA",
                  );
                }}
                className={`px-4 py-2 rounded-lg text-[12px] font-bold transition-colors border ${printType === "model_dk" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"}`}
              >
                Model DK
              </button>
              <button
                onClick={() => {
                  setPrintType("anjab");
                  setCustomTitle("DOKUMEN ANALISIS JABATAN (ANJAB)");
                }}
                className={`px-4 py-2 rounded-lg text-[12px] font-bold transition-colors border opacity-60 ${printType === "anjab" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
              >
                ANJAB (WIP)
              </button>
              <button
                onClick={() => {
                  setPrintType("bezetting");
                  setCustomTitle("DAFTAR SUSUNAN BEZETTING PEGAWAI");
                }}
                className={`px-4 py-2 rounded-lg text-[12px] font-bold transition-colors border opacity-60 ${printType === "bezetting" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
              >
                Bezetting (WIP)
              </button>
              <button
                onClick={() => {
                  setPrintType("usulan_kgb");
                  setCustomTitle("USULAN KENAIKAN GAJI BERKALA (KGB)");
                }}
                className={`px-4 py-2 rounded-lg text-[12px] font-bold transition-colors border opacity-60 ${printType === "usulan_kgb" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
              >
                Usulan KGB (WIP)
              </button>
              <button
                onClick={() => {
                  setPrintType("usulan_kp");
                  setCustomTitle("USULAN KENAIKAN PANGKAT (KP)");
                }}
                className={`px-4 py-2 rounded-lg text-[12px] font-bold transition-colors border opacity-60 ${printType === "usulan_kp" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
              >
                Usulan KP (WIP)
              </button>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 lg:gap-6 pt-4">
          {(printType === "absen_global" || printType === "absen_bidang") && (
            <div className="space-y-2 lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Filter Unit Kerja
              </label>
              <select
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors cursor-pointer"
                value={selectedBidang}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedBidang(val);
                  if (val === "Semua") {
                    setPrintType("absen_global");
                    setCustomTitle("DAFTAR HADIR / ABSENSI PEGAWAI");
                  } else {
                    setPrintType("absen_bidang");
                    setCustomTitle(
                      `DAFTAR HADIR UNIT KERJA ${val.toUpperCase()}`,
                    );
                  }
                }}
              >
                <option value="Semua">Semua / Pilih Filter...</option>
                {getUniqueBidang().map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}

          {printCategory === "laporan" && (
            <>
              <div className="space-y-2 lg:col-span-1">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Metode Pengurutan
                </label>
                <select
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors cursor-pointer"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortAction)}
                >
                  <option value="default_kelas">
                    Hierarki (Kelas Jabatan, Status)
                  </option>
                  <option value="abjad">Alfabetis (A-Z)</option>
                </select>
              </div>

              <div
                className={`space-y-2 ${printType === "tanda_terima" || printType === "duk" ? "md:col-span-3 lg:col-span-2" : "md:col-span-2 lg:col-span-2"}`}
              >
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Judul Utama Dokumen
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-4 lg:col-span-5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Informasi Tambahan / Keterangan Dokumen
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                  value={customSubtitle}
                  onChange={(e) => setCustomSubtitle(e.target.value)}
                />
              </div>
            </>
          )}
          {printCategory === "layanan" && (
            <>
              {[
                "surat_cuti",
                "model_dk",
                "anjab",
                "bezetting",
                "usulan_kgb",
                "usulan_kp",
              ].includes(printType) && (
                <div className="space-y-2 lg:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Pilih Pegawai Pemohon
                  </label>
                  <select
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors cursor-pointer"
                    value={cutiEmployeeId}
                    onChange={(e) => setCutiEmployeeId(e.target.value)}
                  >
                    <option value="">-- Pilih Pegawai --</option>
                    {[...employees]
                      .sort((a, b) =>
                        (a.nama || "").localeCompare(b.nama || ""),
                      )
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nama} - {emp.nip}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {printType === "surat_cuti" && (
                <>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Jenis Cuti
                    </label>
                    <select
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors cursor-pointer"
                      value={cutiJenis}
                      onChange={(e) => setCutiJenis(e.target.value)}
                    >
                      <option value="1. Cuti Tahunan">1. Cuti Tahunan</option>
                      <option value="2. Cuti Besar">2. Cuti Besar</option>
                      <option value="3. Cuti Sakit">3. Cuti Sakit</option>
                      <option value="4. Cuti Melahirkan">
                        4. Cuti Melahirkan
                      </option>
                      <option value="5. Cuti Karena Alasan Penting">
                        5. Cuti Karena Alasan Penting
                      </option>
                      <option value="6. Cuti di Luar Tanggungan Negara">
                        6. Cuti di Luar Tanggungan Negara
                      </option>
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2 lg:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Alasan Cuti
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                      value={cutiAlasan}
                      onChange={(e) => setCutiAlasan(e.target.value)}
                      placeholder="Contoh: Ibadah Umroh"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Lama Hari
                    </label>
                    <input
                      type="number"
                      className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-500 focus:outline-none transition-colors cursor-not-allowed"
                      value={cutiLamaHari}
                      readOnly
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Mulai Tgl
                    </label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                      value={cutiMulai}
                      onChange={(e) => setCutiMulai(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Sampai Tgl
                    </label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                      value={cutiAkhir}
                      onChange={(e) => setCutiAkhir(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2 lg:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Alamat Selama Cuti
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
                      value={cutiAlamat}
                      onChange={(e) => setCutiAlamat(e.target.value)}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-slate-100 p-4 sm:p-8 rounded-xl border border-slate-200 overflow-x-auto print:p-0 print:bg-transparent print:border-none print:shadow-none print:-mx-4 print:overflow-visible flex flex-col items-center">
        <div className="text-center mb-6 text-xs sm:text-sm font-bold text-slate-400 tracking-widest uppercase print:hidden w-full">
          — Mode Pratinjau Cetak —
        </div>

        {/* Actual Print Paper Container */}
        <div
          ref={printRef}
          className="bg-white border border-slate-200 print-container text-[12pt] w-[210mm] max-w-none shrink-0 p-[15mm] print:max-w-full print:w-full print:p-0 mx-auto print:border-none"
          style={{
            minHeight: "297mm",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          {/* MAIN DOCUMENT BODY */}
          {printType === "absen_global" ||
          printType === "absen_bidang" ||
          printType === "tanda_terima" ? (
            <>
              {/* KOP SURAT */}
              <div
                className="flex items-center border-b-[3px] border-black pb-2 mb-1"
                style={{ lineHeight: "1.2" }}
              >
                <div className="flex-shrink-0 w-24 h-24 flex items-center justify-center">
                  {settings?.logoBase64 ? (
                    <img
                      src={settings.logoBase64}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-center text-gray-400 print-hidden">
                      Logo
                      <br />
                      (Kosong)
                    </div>
                  )}
                </div>
                <div className="flex-1 text-center pr-24 flex flex-col justify-center">
                  {settings?.kopLine1 && (
                    <div className="text-[14pt] font-bold tracking-widest uppercase">
                      {settings.kopLine1}
                    </div>
                  )}
                  {settings?.kopLine2 && (
                    <div className="text-[16pt] font-bold tracking-widest uppercase">
                      {settings.kopLine2}
                    </div>
                  )}
                  {settings?.kopLine3 && (
                    <div className="text-[10pt] mt-0.5">
                      {settings.kopLine3}
                    </div>
                  )}
                  {settings?.kopLine4 && (
                    <div className="text-[10pt]">{settings.kopLine4}</div>
                  )}
                </div>
              </div>
              <div className="border-b border-black mb-6"></div>

              {/* DOCUMENT HEADER */}
              <div className="text-center mb-6 space-y-1">
                <h2 className="text-[12pt] font-bold uppercase">
                  {customTitle}
                </h2>
                {customSubtitle && (
                  <p className="text-[12pt] font-bold">{customSubtitle}</p>
                )}
              </div>

              <table className="w-full border-collapse mb-10 text-[12pt] leading-tight">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black px-2 py-1 w-10 text-center font-bold align-middle">
                      NO
                    </th>
                    <th className="border border-black px-2 py-1 text-center font-bold align-middle">
                      NAMA PEGAWAI
                    </th>
                    <th className="border border-black px-2 py-1 w-10 text-center font-bold align-middle">
                      JK
                    </th>
                    <th className="border border-black px-2 py-1 w-44 text-center font-bold align-middle">
                      NIP
                    </th>
                    <th className="border border-black px-2 py-1 w-40 font-bold text-center align-middle">
                      {printType === "tanda_terima"
                        ? "TANDA TERIMA"
                        : "TANDA TANGAN"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEmployees.map((emp, idx) => (
                    <tr key={emp.id || idx} className="h-8">
                      <td className="border border-black px-2 py-1 text-center align-middle">
                        {idx + 1}
                      </td>
                      <td className="border border-black px-3 py-1 align-middle">
                        <div className="text-[11pt] leading-none">
                          {emp.nama}
                        </div>
                      </td>
                      <td className="border border-black px-1 py-1 text-center align-middle text-[11pt]">
                        {emp.jk || "-"}
                      </td>
                      <td className="border border-black px-2 py-1 align-middle text-center">
                        <div className="text-[11pt] leading-none">
                          {emp.nip || "-"}
                        </div>
                      </td>
                      <td className="border border-black px-2 py-1 align-middle">
                        {/* Odd rows left aligned, Even rows indented slightly space for TTD */}
                        <div
                          className={`text-[11pt] font-semibold ${idx % 2 === 0 ? "text-left pl-1" : "text-left pl-10"}`}
                        >
                          {idx + 1}.
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sortedEmployees.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="border border-black px-4 py-6 text-center italic text-gray-500 text-[12pt]"
                      >
                        Tidak ada data pegawai yang sesuai untuk dicetak.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* SIGNATURE SECTION */}
              <div className="flex justify-end mt-12 pr-8 page-break-inside-avoid">
                <div className="text-left min-w-[200px] max-w-[350px]">
                  <p className="text-[12pt] mb-1">
                    Jember,{" "}
                    {new Date().toLocaleDateString("id-ID", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-[12pt] mb-20 leading-snug">{kadisTitle}</p>

                  <p className="text-[12pt] font-bold underline whitespace-nowrap">
                    {ttdName}
                  </p>
                  <p className="text-[12pt] whitespace-nowrap">{ttdPangkat}</p>
                  <p className="text-[12pt] mt-0.5 whitespace-nowrap">
                    NIP. {ttdNip}
                  </p>
                </div>
              </div>
            </>
          ) : printType === "surat_cuti" ? (
            (() => {
              const emp = employees.find((e) => e.id === cutiEmployeeId);
              const hierarchy = getHierarchy(emp);
              const curYear = new Date().getFullYear();

              const formatTgl = (d: string) => {
                if (!d) return "-";
                const date = new Date(d);
                const opts: Intl.DateTimeFormatOptions = {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                };
                return date.toLocaleDateString("id-ID", opts);
              };

              // Reformat jenis cuti for rendering checks
              const listJenis = [
                "1. Cuti Tahunan",
                "4. Cuti Melahirkan",
                "2. Cuti Besar",
                "5. Cuti Karena Alasan Penting",
                "3. Cuti Sakit",
                "6. Cuti di Luar Tanggungan Negara",
              ];

              const _sisaN = parseInt(emp?.sisaCutiN || "0") || 0;
              const _sisaN1 = parseInt(emp?.sisaCutiN1 || "0") || 0;
              const _sisaN2 = parseInt(emp?.sisaCutiN2 || "0") || 0;

              return (
                <div className="text-[11pt] leading-tight text-black relative pt-[40px]">
                  {/* Top Right Header Context */}
                  <div className="absolute top-0 right-0 text-[10pt] w-[400px]">
                    <p>ANAK LAMPIRAN 1.b</p>
                    <p>PERATURAN BADAN KEPEGAWAIAN NEGARA REPUBLIK INDONESIA</p>
                    <p>NOMOR 24 TAHUN 2017</p>
                    <p>TENTANG TATA CARA PEMBERIAN CUTI PEGAWAI NEGERI SIPIL</p>
                  </div>

                  <div className="mt-28 flex justify-end">
                    <div className="w-[350px]">
                      <p>Jember, {formatTgl(new Date().toISOString())}</p>
                      <p>Kepada Yth.</p>
                      <p>{hierarchy.pejabat}</p>
                      <p>di</p>
                      <p className="ml-8 underline">Jember</p>
                    </div>
                  </div>

                  <h1 className="text-center font-bold text-[12pt] mt-8 mb-4">
                    FORMULIR PERMINTAAN DAN PEMBERIAN CUTI
                  </h1>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">I. DATA PEGAWAI</div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5 w-[15%]">
                          Nama
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[35%]">
                          {emp?.nama || "-"}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[15%]">
                          NIP
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[35%]">
                          {emp?.nip || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5">
                          Jabatan
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          {emp?.jabatan || "-"}
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          Pangkat/Gol.
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          {emp?.pangkatGolongan || " - "}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5">
                          Unit Kerja
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          {emp?.bidang || "-"}
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          Masa Kerja
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          {cutiMasaKerja}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">
                      II. JENIS CUTI YANG DIAMBIL **
                    </div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3 text-[10.5pt]">
                    <tbody>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[0]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {cutiJenis.startsWith("1") ? "✓" : ""}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[1]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {cutiJenis.startsWith("4") ? "✓" : ""}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[2]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {cutiJenis.startsWith("2") ? "✓" : ""}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[3]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {cutiJenis.startsWith("5") ? "✓" : ""}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[4]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {cutiJenis.startsWith("3") ? "✓" : ""}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[5]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {cutiJenis.startsWith("6") ? "✓" : ""}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">III. ALASAN CUTI</div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td className="px-1.5 py-1.5 min-h-[30px]">
                          {cutiAlasan || "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">IV. LAMANYA CUTI</div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td className="border-r border-black px-1.5 py-0.5 w-[30%]">
                          Selama {cutiLamaHari} Hari
                          <strike className={cutiLamaHari > 30 ? "" : "hidden"}>
                            /Bulan/Tahun
                          </strike>
                          <strike
                            className={cutiLamaHari <= 30 ? "" : "hidden"}
                          >
                            /Bulan/Tahun
                          </strike>
                        </td>
                        <td className="px-1.5 py-0.5">
                          Mulai tanggal{" "}
                          <span className="mx-2">
                            {cutiMulai ? formatTgl(cutiMulai) : "-"}
                          </span>{" "}
                          s/d{" "}
                          <span className="mx-2">
                            {cutiAkhir ? formatTgl(cutiAkhir) : "-"}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">V. CATATAN CUTI ***</div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3 text-[10.5pt]">
                    <tbody>
                      <tr>
                        <td
                          colSpan={3}
                          className="border border-black px-1.5 py-0.5 w-[50%]"
                        >
                          1. Cuti Tahunan
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[35%]">
                          2. Cuti Besar
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[15%]"></td>
                      </tr>
                      <tr>
                        <td className="border border-black text-center w-[15%]">
                          Tahun
                        </td>
                        <td className="border border-black text-center w-[15%]">
                          Sisa
                        </td>
                        <td className="border border-black text-center w-[20%]">
                          Keterangan
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          3. Cuti Sakit
                        </td>
                        <td className="border border-black px-1.5 py-0.5"></td>
                      </tr>
                      <tr>
                        <td className="border border-black text-center">N-2</td>
                        <td className="border border-black text-center">
                          {emp?.sisaCutiN2 || "-"}
                        </td>
                        <td className="border border-black text-center"></td>
                        <td className="border border-black px-1.5 py-0.5">
                          4. Cuti Melahirkan
                        </td>
                        <td className="border border-black px-1.5 py-0.5"></td>
                      </tr>
                      <tr>
                        <td className="border border-black text-center">N-1</td>
                        <td className="border border-black text-center">
                          {emp?.sisaCutiN1 || "-"}
                        </td>
                        <td className="border border-black text-center"></td>
                        <td className="border border-black px-1.5 py-0.5">
                          5. Cuti Karena Alasan Penting
                        </td>
                        <td className="border border-black px-1.5 py-0.5"></td>
                      </tr>
                      <tr>
                        <td className="border border-black text-center">N</td>
                        <td className="border border-black text-center">
                          {emp?.sisaCutiN || "-"}
                        </td>
                        <td className="border border-black text-center"></td>
                        <td className="border border-black px-1.5 py-0.5">
                          6. Cuti di Luar Tanggungan Negara
                        </td>
                        <td className="border border-black px-1.5 py-0.5"></td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">
                      VI. ALAMAT SELAMA MENJALANKAN CUTI
                    </div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td className="border border-black text-center p-1 font-bold w-[45%]">
                          Alamat Lengkap
                        </td>
                        <td className="border border-black text-center p-1 font-bold w-[25%]">
                          Nomor HP
                        </td>
                        <td
                          colSpan={2}
                          className="border border-black text-center p-1.5 font-bold w-[30%]"
                        >
                          Hormat Saya,
                        </td>
                      </tr>
                      <tr>
                        <td
                          className="border border-black align-top p-1"
                          rowSpan={3}
                        >
                          {cutiAlamat}
                        </td>
                        <td
                          className="border border-black align-top p-1 text-center"
                          rowSpan={3}
                        >
                          {cutiHp}
                        </td>
                        <td
                          colSpan={2}
                          className="border-r border-black p-1 h-[60px]"
                        ></td>
                      </tr>
                      <tr>
                        <td
                          colSpan={2}
                          className="border-r border-black p-0 h-[10px]"
                        ></td>
                      </tr>
                      <tr>
                        <td
                          colSpan={2}
                          className="border-r border-black p-1 text-center h-[20px]"
                        >
                          {emp?.nama || "-"}
                          <br />
                          NIP. {emp?.nip || "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">
                      VII. PERTIMBANGAN ATASAN LANGSUNG **
                    </div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td className="border border-black text-center p-0.5">
                          Disetujui
                        </td>
                        <td className="border border-black text-center p-0.5">
                          Perubahan ****
                        </td>
                        <td className="border border-black text-center p-0.5">
                          Ditangguhkan ****
                        </td>
                        <td
                          colSpan={2}
                          className="border border-black text-center p-0.5"
                        >
                          Tidak Disetujui ****
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black h-[20px]"></td>
                        <td className="border border-black h-[20px]"></td>
                        <td className="border border-black h-[20px]"></td>
                        <td
                          colSpan={2}
                          className="border border-black h-[20px]"
                        ></td>
                      </tr>
                      <tr>
                        <td
                          colSpan={3}
                          className="border border-black border-r-0"
                        ></td>
                        <td
                          colSpan={2}
                          className="border border-black border-l-0 text-center py-6 align-bottom"
                        >
                          {hierarchy.atasan}
                          <br />
                          NIP. {hierarchy.nipAtasan}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">
                      VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI **
                    </div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td className="border border-black text-center p-0.5">
                          Disetujui
                        </td>
                        <td className="border border-black text-center p-0.5">
                          Perubahan ****
                        </td>
                        <td className="border border-black text-center p-0.5">
                          Ditangguhkan ****
                        </td>
                        <td
                          colSpan={2}
                          className="border border-black text-center p-0.5"
                        >
                          Tidak Disetujui ****
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black h-[20px]"></td>
                        <td className="border border-black h-[20px]"></td>
                        <td className="border border-black h-[20px]"></td>
                        <td
                          colSpan={2}
                          className="border border-black h-[20px]"
                        ></td>
                      </tr>
                      <tr>
                        <td
                          colSpan={3}
                          className="border border-black border-r-0"
                        ></td>
                        <td
                          colSpan={2}
                          className="border border-black border-l-0 text-center py-6 align-bottom"
                        >
                          {hierarchy.pejabat}
                          <br />
                          NIP. {hierarchy.nipPejabat}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="text-[10pt] mt-4">
                    <p className="font-bold">Catatan:</p>
                    <table className="border-collapse">
                      <tbody>
                        <tr>
                          <td className="w-6 align-top">*</td>
                          <td>Coret yang tidak perlu</td>
                        </tr>
                        <tr>
                          <td className="w-6 align-top">**</td>
                          <td>
                            Pilih salah satu dengan memberi tanda centang (✓)
                          </td>
                        </tr>
                        <tr>
                          <td className="w-6 align-top">***</td>
                          <td>
                            diisi oleh pejabat yang menangani bidang kepegawaian
                            sebelum PNS mengajukan Cuti
                          </td>
                        </tr>
                        <tr>
                          <td className="w-6 align-top">****</td>
                          <td>diberi tanda centang dan alasannya.</td>
                        </tr>
                        <tr>
                          <td className="w-6 align-top">N</td>
                          <td>Cuti tahun berjalan</td>
                        </tr>
                        <tr>
                          <td className="w-6 align-top">N-1</td>
                          <td>Sisa cuti 1 tahun sebelumnya</td>
                        </tr>
                        <tr>
                          <td className="w-6 align-top">N-2</td>
                          <td>Sisa cuti 2 tahun sebelumnya</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()
          ) : printType === "model_dk" ? (
            (() => {
              const emp = employees.find((e) => e.id === cutiEmployeeId);
              let _gaji = String(emp?.besaranGajiKotor || "0").replace(
                /[^0-9]/g,
                "",
              );
              const numGaji = parseInt(_gaji) || 0;
              const formatRp = new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
              }).format(numGaji);

              const keluarga = emp?.dataKeluarga || [];
              const tglSurat = new Date().toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });

              const formatTglBulanTahun = (d?: string) => {
                if (!d) return "-";
                const date = new Date(d);
                if (isNaN(date.getTime())) return d;
                return date.toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
              };

              return (
                <div className="text-[11pt] leading-tight text-black p-[20px]">
                  <div className="text-right text-[11pt] mb-8 font-bold">
                    Model DK
                  </div>

                  <div className="text-center font-bold text-[12pt] leading-snug mb-8 tracking-widest pb-6">
                    SURAT KETERANGAN
                    <br />
                    UNTUK MENDAPATKAN PEMBAYARAN TUNJANGAN KELUARGA
                  </div>

                  <table className="w-full text-[11pt] border-none mb-6">
                    <tbody>
                      <tr>
                        <td className="w-64 align-top py-0.5">Nama Instansi</td>
                        <td className="w-4 align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          DINAS KOMUNIKASI DAN INFORMATIKA
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">Alamat</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          Jl. Nusantara No. 02 (Area Balai Serbaguna)
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">
                          Nama Pembuat Daftar Gaji
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          ..............................................
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="font-bold text-[11pt] mb-2 uppercase">
                    DATA PEGAWAI
                  </div>

                  <table className="w-full text-[11pt] border-none mb-4 pl-4 block">
                    <tbody className="w-full display-block">
                      {/* Using indices 1 to 18 as per spec */}
                      <tr>
                        <td className="w-6 align-top py-0.5">1.</td>
                        <td className="w-60 align-top py-0.5">Nama lengkap</td>
                        <td className="w-4 align-top py-0.5">:</td>
                        <td className="align-top py-0.5">{emp?.nama || "-"}</td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">2.</td>
                        <td className="align-top py-0.5">NIP</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">{emp?.nip || "-"}</td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">3.</td>
                        <td className="align-top py-0.5">
                          Pangkat /Golongan Ruang
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.pangkat} / {emp?.gol}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">4.</td>
                        <td className="align-top py-0.5">TMT Golongan Ruang</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {formatTglBulanTahun(emp?.tmtGolonganRuang)}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">5.</td>
                        <td className="align-top py-0.5">
                          Tempat/Tanggal Lahir
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.tempatLahir || "-"},{" "}
                          {formatTglBulanTahun(emp?.tanggalLahir)}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">6.</td>
                        <td className="align-top py-0.5">Jenis Kelamin</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.jk === "P" ? "Perempuan" : "Laki-laki"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">7.</td>
                        <td className="align-top py-0.5">Agama</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.agama || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">8.</td>
                        <td className="align-top py-0.5">Alamat Lengkap</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.jalanDusun ||
                          emp?.rt ||
                          emp?.rw ||
                          emp?.desaKelurahan ||
                          emp?.kecamatan ||
                          emp?.kabupaten
                            ? `${emp?.jalanDusun || ""} ${emp?.rt ? `RT.${emp?.rt}` : ""} ${emp?.rw ? `RW.${emp?.rw}` : ""} ${emp?.desaKelurahan || ""}, ${emp?.kecamatan || ""}, ${emp?.kabupaten || ""}`
                            : "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">9.</td>
                        <td className="align-top py-0.5">TMT Pegawai</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {formatTglBulanTahun(emp?.tmtKerja)}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">10.</td>
                        <td className="align-top py-0.5">Status Kepegawaian</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.status || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">11.</td>
                        <td className="align-top py-0.5">
                          Digaji Menurut PP/SK
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          ......................................
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">12.</td>
                        <td className="align-top py-0.5">Besaran Gaji Kotor</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">{formatRp}</td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">13.</td>
                        <td className="align-top py-0.5">Jabatan</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.jabatan || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">14.</td>
                        <td className="align-top py-0.5">
                          Jumlah Keluarga Tertanggung
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.jumlahTertanggung || "0"} Orang
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">15.</td>
                        <td className="align-top py-0.5">
                          SK Terakhir yang dimiliki
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.skTerakhir || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">16.</td>
                        <td className="align-top py-0.5">
                          Masa kerja golongan
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          ....... Tahun ....... Bulan
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">17.</td>
                        <td className="align-top py-0.5">
                          Masa kerja Keseluruhan
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.masaKerja || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">18.</td>
                        <td className="align-top py-0.5">Susunan Keluarga</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5"></td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="w-full border-collapse border border-black mb-6 text-[11pt]">
                    <thead>
                      <tr>
                        <th className="border border-black p-1">No</th>
                        <th className="border border-black p-1">
                          Nama Istri / Suami / Anak
                          <br />
                          Tanggungan
                        </th>
                        <th className="border border-black p-1">
                          Tanggal Kelahiran
                          <br />
                          (Umur)
                        </th>
                        <th className="border border-black p-1">Perkawinan</th>
                        <th className="border border-black p-1">
                          Pekerjaan / Sekolah
                        </th>
                        <th className="border border-black p-1">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const validKeluarga = keluarga.filter((k) => k.name);
                        const emptyRowContext: any = {
                          name: "",
                          birthDate: "",
                          marriageDate: "",
                          occupation: "",
                          description: "",
                        };
                        const rows =
                          validKeluarga.length > 0
                            ? [...validKeluarga, emptyRowContext]
                            : [emptyRowContext];

                        return rows.map((member, i) => (
                          <tr key={i} className="h-7 text-center">
                            <td className="border border-black">
                              {member?.name ? i + 1 : ""}
                            </td>
                            <td className="border border-black text-left px-2">
                              {member?.name || ""}
                            </td>
                            <td className="border border-black">
                              {member?.name && member.birthDate
                                ? formatTglBulanTahun(member.birthDate)
                                : ""}
                            </td>
                            <td className="border border-black">
                              {member?.name && member.marriageDate
                                ? formatTglBulanTahun(member.marriageDate)
                                : ""}
                            </td>
                            <td className="border border-black">
                              {member?.occupation || ""}
                            </td>
                            <td className="border border-black">
                              {member?.description || ""}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>

                  <p className="text-justify mb-8">
                    Keterangan ini saya buat dengan sesungguhnya dan apabila
                    keterangan ini ternyata tidak benar (palsu), saya bersedia
                    dituntut dimuka pengadilan berdasarkan Undang-undang yang
                    berlaku, dan bersedia mengembalikan semua penghasilan yang
                    telah saya terima yang seharusnya bukan menjadi hak saya.
                  </p>

                  <div className="flex justify-between mt-8 page-break-inside-avoid">
                    <div className="w-[45%] flex flex-col justify-between">
                      <div>
                        <p>Mengetahui,</p>
                        <p>Kepala Dinas Komunikasi dan Informatika</p>
                        <p>Kabupaten Jember</p>
                      </div>
                      <div className="mt-20">
                        <p className="font-bold underline whitespace-nowrap">
                          {ttdName}
                        </p>
                        <p className="whitespace-nowrap">NIP. {ttdNip}</p>
                      </div>
                    </div>
                    <div className="w-[45%] flex flex-col justify-between">
                      <div>
                        <p>Jember, {tglSurat}</p>
                        <p>Pegawai yang bersangkutan,</p>
                        <p>&nbsp;</p>
                      </div>
                      <div className="mt-20">
                        <p className="font-bold underline whitespace-nowrap">
                          {emp?.nama ||
                            "..........................................."}
                        </p>
                        <p className="whitespace-nowrap">
                          NIP.{" "}
                          {emp?.nip ||
                            "..........................................."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="py-20 text-center border-2 border-dashed border-slate-300 rounded-xl mb-10 print-hidden">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-500">
                Modul Cetak Belum Tersedia
              </h3>
              <p className="text-slate-400 max-w-md mx-auto mt-2">
                Modul untuk mencetak <strong>{customTitle}</strong> saat ini
                sedang dalam tahap pengembangan (WIP) dan belum dapat digunakan.
              </p>
            </div>
          )}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
 @page {
 size: A4 portrait;
 margin: 15mm;
 }
 @media print {
 body {
 background-color: white !important;
 }
 .print-hidden {
 display: none !important;
 }
 .page-break-inside-avoid {
 page-break-inside: avoid;
 }
 .print-container {
 width: 100% !important;
 max-width: 100% !important;
 min-height: auto !important;
 margin: 0 !important;
 padding: 0 !important;
 box-shadow: none !important;
 border: none !important;
 }
 }
 `,
        }}
      />
    </div>
  );
}
