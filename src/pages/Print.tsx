import React, { useState, useEffect, useRef } from "react";
import { Employee, AppSettings } from "../types";
import { Printer, FileText, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { lookupKamus } from "../lib/kamus";
import { countWorkingDays } from "../lib/holidays";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { notify } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { motion } from "motion/react";
import {
  btnPrimary,
  btnSecondary,
  card,
  cardHeader,
  input,
  pageContainerVariants,
  pageItemVariants,
  pageShellWide,
  select,
} from "../lib/ui";

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
  const { canWrite } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [cutiConfirmOpen, setCutiConfirmOpen] = useState(false);
  const [cutiBusy, setCutiBusy] = useState(false);

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

  // Cuti Form Config — defaults intentionally empty so the user must fill them
  // (previously hardcoded "Mekah" / "082120202180" / etc., which risked being
  // printed on official documents unchanged).
  const [cutiEmployeeId, setCutiEmployeeId] = useState<string>("");
  const [cutiJenis, setCutiJenis] = useState<string>("1. Cuti Tahunan");
  const [cutiAlasan, setCutiAlasan] = useState<string>("");
  const [cutiLamaHari, setCutiLamaHari] = useState<number>(0);
  const [cutiMulai, setCutiMulai] = useState<string>("");
  const [cutiAkhir, setCutiAkhir] = useState<string>("");
  const [cutiAlamat, setCutiAlamat] = useState<string>("");
  const [cutiHp, setCutiHp] = useState<string>("");
  const [cutiMasaKerja, setCutiMasaKerja] = useState<string>("");

  useEffect(() => {
    if (cutiMulai && cutiAkhir) {
      setCutiLamaHari(countWorkingDays(cutiMulai, cutiAkhir));
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
        const currentSettings = await api.getSettings(["core", "logo", "kamus"]);
        setSettings(currentSettings);

        const all: Employee[] = [];
        let offset = 0;
        const pageSize = 500;
        for (;;) {
          const res = await api.getEmployeesPage({
            limit: pageSize,
            offset,
            lean: true,
          });
          all.push(...res.data);
          offset += res.data.length;
          if (offset >= res.total || res.data.length === 0) break;
        }

        const kamus = currentSettings.jabatanKamusCsv;
        setEmployees(
          all.map((emp) => {
            if (!emp.jabatan || !kamus) return emp;
            const { kelas, beban } = lookupKamus(emp.jabatan, kamus);
            return kelas || beban
              ? { ...emp, kelasJabatan: kelas, bebanKerja: beban }
              : emp;
          }),
        );
      } catch (err) {
        console.error("Error fetching data for print:", err);
        notify.error("Gagal memuat data cetak");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Hydrate full employee for cuti (lean list lacks sisaCuti*)
  useEffect(() => {
    if (!cutiEmployeeId) return;
    let cancelled = false;
    (async () => {
      try {
        const full = await api.getEmployee(cutiEmployeeId);
        if (cancelled || !full) return;
        setCutiMasaKerja(full.masaKerja || "");
        setCutiHp(full.nomorHp || "");
        setEmployees((prev) => {
          const idx = prev.findIndex((e) => e.id === cutiEmployeeId);
          if (idx < 0) return [...prev, full];
          const next = [...prev];
          next[idx] = { ...next[idx], ...full };
          return next;
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cutiEmployeeId]);

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
      return (a.nama || "").localeCompare(b.nama || "");
    }
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 gap-2 font-medium text-slate-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        Memuat data cetak…
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


  const runCutiDeductionAndPrint = async () => {
    if (!canWrite) {
      notify.error("Mode baca saja", "Viewer tidak dapat mengurangi sisa cuti.");
      setCutiConfirmOpen(false);
      return;
    }
    if (!cutiEmployeeId) {
      notify.error("Pilih pegawai dulu");
      return;
    }
    if (!cutiLamaHari || cutiLamaHari <= 0) {
      notify.error("Lama cuti tidak valid");
      return;
    }
    setCutiBusy(true);
    try {
      const emp = await api.getEmployee(cutiEmployeeId);
      if (!emp) {
        notify.error("Pegawai tidak ditemukan");
        return;
      }
      const sisaN = parseInt(String(emp.sisaCutiN ?? "0"), 10) || 0;
      const sisaN1 = parseInt(String(emp.sisaCutiN1 ?? "0"), 10) || 0;
      const sisaN2 = parseInt(String(emp.sisaCutiN2 ?? "0"), 10) || 0;
      const total = sisaN + sisaN1 + sisaN2;
      if (total < cutiLamaHari) {
        notify.error(
          "Sisa cuti tidak cukup",
          `Tersedia ${total} hari, diminta ${cutiLamaHari} hari.`,
        );
        return;
      }
      let toDeduct = cutiLamaHari;
      let newN = sisaN;
      let newN1 = sisaN1;
      let newN2 = sisaN2;
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
          newN -= toDeduct;
        }
      }
      await api.updateEmployee(emp.id!, {
        sisaCutiN: String(newN),
        sisaCutiN1: String(newN1),
        sisaCutiN2: String(newN2),
      });
      setEmployees((prev) =>
        prev.map((e) =>
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
      setCutiConfirmOpen(false);
      notify.success("Sisa cuti diperbarui");
      setTimeout(() => window.print(), 300);
    } catch (err) {
      console.error(err);
      notify.error(
        "Gagal mengurangi sisa cuti",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setCutiBusy(false);
    }
  };

  const handlePrintClick = async () => {
    if (printType === "surat_cuti" && cutiJenis.startsWith("1")) {
      if (!canWrite) {
        try {
          window.print();
        } catch {
          notify.warning(
            "Cetak diblokir browser",
            "Gunakan Ctrl+P (Windows) atau Cmd+P (Mac).",
          );
        }
        return;
      }
      setCutiConfirmOpen(true);
      return;
    }
    try {
      window.print();
    } catch {
      notify.warning(
        "Cetak diblokir browser",
        "Gunakan Ctrl+P (Windows) atau Cmd+P (Mac).",
      );
    }
  };


  const DOCUMENTS: {
    category: "laporan" | "layanan";
    type: PrintType;
    label: string;
    title: string;
    wip?: boolean;
  }[] = [
    { category: "laporan", type: "absen_global", label: "Absensi", title: "DAFTAR HADIR / ABSENSI PEGAWAI" },
    { category: "laporan", type: "tanda_terima", label: "Tanda terima", title: "DAFTAR TANDA TERIMA ......................" },
    { category: "laporan", type: "duk", label: "DUK", title: "DAFTAR URUT KEPANGKATAN (DUK)" },
    { category: "layanan", type: "surat_cuti", label: "Surat cuti", title: "SURAT IZIN CUTI PEGAWAI" },
    {
      category: "layanan",
      type: "model_dk",
      label: "Model DK",
      title: "SURAT KETERANGAN UNTUK MENDAPATKAN PEMBAYARAN TUNJANGAN KELUARGA",
    },
  ];

  const selectDocument = (doc: (typeof DOCUMENTS)[number]) => {
    setPrintCategory(doc.category);
    if (doc.type === "absen_global") {
      if (selectedBidang !== "Semua") {
        setPrintType("absen_bidang");
        setCustomTitle(`DAFTAR HADIR UNIT KERJA ${selectedBidang.toUpperCase()}`);
      } else {
        setPrintType("absen_global");
        setCustomTitle(doc.title);
      }
    } else {
      setPrintType(doc.type);
      setCustomTitle(doc.title);
      setSelectedBidang("Semua");
    }
  };

  const activeDocKey =
    printType === "absen_bidang" || printType === "absen_global"
      ? "absen_global"
      : printType;

  const fieldLabel =
    "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageContainerVariants}
      className={pageShellWide}
    >
      <div className="print-hidden mb-4 md:mb-5">
        <motion.div variants={pageItemVariants}>
          <PageHeader
            title="Cetak"
            description="Pilih dokumen, atur opsi, pratinjau langsung, lalu cetak."
            actions={
              <button
                type="button"
                onClick={handlePrintClick}
                className={`${btnPrimary} w-full sm:w-auto`}
              >
                <Printer className="w-4 h-4" />
                Cetak
              </button>
            }
          />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
        <aside className={`print-hidden ${card} lg:col-span-3 overflow-hidden`}>
          <div className={cardHeader}>
            <h2 className="text-sm font-semibold text-slate-800">Dokumen</h2>
          </div>
          <div className="p-2 space-y-3">
            {(
              [
                ["laporan", "Laporan"],
                ["layanan", "Layanan"],
              ] as const
            ).map(([cat, title]) => (
              <div key={cat}>
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {title}
                </p>
                <ul className="space-y-0.5">
                  {DOCUMENTS.filter((d) => d.category === cat).map((doc) => {
                    const active = activeDocKey === doc.type;
                    return (
                      <li key={doc.type}>
                        <button
                          type="button"
                          onClick={() => selectDocument(doc)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors active:scale-[0.98] ${
                            active
                              ? "bg-slate-900 text-white"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          {doc.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <section className={`print-hidden ${card} lg:col-span-4 overflow-hidden`}>
          <div className={cardHeader}>
            <h2 className="text-sm font-semibold text-slate-800">Opsi</h2>
          </div>
          <div className="p-4 sm:p-5 space-y-4 max-h-[min(70vh,720px)] overflow-y-auto">
            {(printType === "absen_global" || printType === "absen_bidang") && (
              <div>
                <label className={fieldLabel}>Unit kerja</label>
                <select
                  className={select}
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
                  <option value="Semua">Semua unit</option>
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
                <div>
                  <label className={fieldLabel}>Urutan</label>
                  <select
                    className={select}
                    value={sortOption}
                    onChange={(e) =>
                      setSortOption(e.target.value as SortAction)
                    }
                  >
                    <option value="default_kelas">
                      Hierarki (kelas, status)
                    </option>
                    <option value="abjad">Alfabetis (A–Z)</option>
                  </select>
                </div>
                <div>
                  <label className={fieldLabel}>Judul</label>
                  <input
                    type="text"
                    className={`${input} font-semibold`}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className={fieldLabel}>Subjudul / keterangan</label>
                  <input
                    type="text"
                    className={input}
                    value={customSubtitle}
                    onChange={(e) => setCustomSubtitle(e.target.value)}
                  />
                </div>
              </>
            )}

            {printCategory === "layanan" && (
              <>
                <div>
                  <label className={fieldLabel}>Pegawai</label>
                  <select
                    className={select}
                    value={cutiEmployeeId}
                    onChange={(e) => setCutiEmployeeId(e.target.value)}
                  >
                    <option value="">— Pilih pegawai —</option>
                    {[...employees]
                      .sort((a, b) =>
                        (a.nama || "").localeCompare(b.nama || ""),
                      )
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nama} — {emp.nip}
                        </option>
                      ))}
                  </select>
                </div>
                {printType === "surat_cuti" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className={fieldLabel}>Jenis cuti</label>
                      <select
                        className={select}
                        value={cutiJenis}
                        onChange={(e) => setCutiJenis(e.target.value)}
                      >
                        <option value="1. Cuti Tahunan">Cuti tahunan</option>
                        <option value="2. Cuti Besar">Cuti besar</option>
                        <option value="3. Cuti Sakit">Cuti sakit</option>
                        <option value="4. Cuti Melahirkan">
                          Cuti melahirkan
                        </option>
                        <option value="5. Cuti Karena Alasan Penting">
                          Cuti alasan penting
                        </option>
                        <option value="6. Cuti di Luar Tanggungan Negara">
                          CLTN
                        </option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={fieldLabel}>Alasan</label>
                      <input
                        type="text"
                        className={input}
                        value={cutiAlasan}
                        onChange={(e) => setCutiAlasan(e.target.value)}
                        placeholder="Contoh: ibadah / keperluan keluarga"
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>Mulai</label>
                      <input
                        type="date"
                        className={input}
                        value={cutiMulai}
                        onChange={(e) => setCutiMulai(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>Selesai</label>
                      <input
                        type="date"
                        className={input}
                        value={cutiAkhir}
                        onChange={(e) => setCutiAkhir(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>Lama (hari kerja)</label>
                      <input
                        type="number"
                        className={`${input} bg-slate-50 text-slate-600`}
                        value={cutiLamaHari}
                        readOnly
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={fieldLabel}>Alamat selama cuti</label>
                      <input
                        type="text"
                        className={input}
                        value={cutiAlamat}
                        onChange={(e) => setCutiAlamat(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
              {sortedEmployees.length} pegawai
              {printCategory === "laporan"
                ? ` · ${sortOption === "abjad" ? "A–Z" : "hierarki"}`
                : ""}
            </p>
          </div>
        </section>

        <section className="lg:col-span-5 space-y-2 min-w-0">
          <div
            className={`print-hidden ${card} px-4 py-3 flex items-center justify-between gap-2`}
          >
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Pratinjau
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">A4 · live</p>
            </div>
            <button
              type="button"
              onClick={handlePrintClick}
              className={btnSecondary}
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100 p-3 sm:p-4 overflow-auto max-h-[min(75vh,900px)] print:p-0 print:border-none print:bg-transparent print:max-h-none print:overflow-visible print:rounded-none">
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
                          <s className={cutiLamaHari > 30 ? "" : "hidden"}>
                            /Bulan/Tahun
                          </s>
                          <s
                            className={cutiLamaHari <= 30 ? "" : "hidden"}
                          >
                            /Bulan/Tahun
                          </s>
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
        </section>
      </div>


      <ConfirmDialog
        open={cutiConfirmOpen}
        onClose={() => !cutiBusy && setCutiConfirmOpen(false)}
        loading={cutiBusy}
        variant="danger"
        title="Potong sisa cuti & cetak?"
        description={`Surat cuti tahunan akan memotong ${cutiLamaHari} hari kerja dari saldo cuti (N-2 → N-1 → N). Lanjutkan?`}
        confirmLabel="Ya, potong & cetak"
        onConfirm={() => void runCutiDeductionAndPrint()}
      />

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
    </motion.div>
  );
}
