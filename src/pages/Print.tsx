import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Employee, AppSettings } from "../types";
import {
  Printer,
  Loader2,
  ClipboardList,
  FileSignature,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Eye,
  Shield,
} from "lucide-react";
import { api } from "../lib/api";
import { lookupKamus } from "../lib/kamus";
import { countWorkingDays } from "../lib/holidays";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { notify } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import {
  btnPrimary,
  btnSecondary,
  card,
  cardHeader,
  chip,
  input,
  pageContainerVariants,
  pageItemVariants,
  pageShellWide,
  select,
} from "../lib/ui";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { peekAllEmployeesLean } from "../lib/bootstrap";
import {
  isCutiTahunanJenis,
  matchesCutiJenisNumber,
  parseDocParam,
  resolveBidangLabel,
} from "../lib/printParams";

type PrintType =
  | "absen_global"
  | "absen_bidang"
  | "tanda_terima"
  | "surat_cuti"
  | "model_dk"
  | "duk";
type SortAction = "default_kelas" | "abjad";
type MobileStep = 1 | 2 | 3;
/** Snapshot sisa cuti for print (pre-deduction values on BKN form). */
type CutiSisaSnapshot = { n: string; n1: string; n2: string };

const LS_LAST_UNIT = "hrcube.print.lastUnit";
const LS_LAST_SORT = "hrcube.print.lastSort";

/** True only for "1. Cuti Tahunan" (not "10…"). */
function isCutiTahunan(jenis: string): boolean {
  return isCutiTahunanJenis(jenis);
}

function readLs(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLs(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

type PrintDoc = {
  category: "laporan" | "layanan";
  type: PrintType;
  /** Catalog key (absen uses absen_global for both global/unit). */
  catalogKey: PrintType | "absen_global";
  label: string;
  title: string;
  desc: string;
  needsEmployee?: boolean;
};

const DOCUMENTS: PrintDoc[] = [
  {
    category: "laporan",
    type: "absen_global",
    catalogKey: "absen_global",
    label: "Absensi",
    title: "DAFTAR HADIR / ABSENSI PEGAWAI",
    desc: "Daftar hadir global atau per unit",
  },
  {
    category: "laporan",
    type: "tanda_terima",
    catalogKey: "tanda_terima",
    label: "Tanda terima",
    title: "DAFTAR TANDA TERIMA ......................",
    desc: "Lembar tanda terima / serah terima",
  },
  {
    category: "laporan",
    type: "duk",
    catalogKey: "duk",
    label: "DUK (kepangkatan)",
    title: "DAFTAR URUT KEPANGKATAN (DUK)",
    desc: "Urut gol/pangkat, jabatan, unit — bukan lembar TTD absensi",
  },
  {
    category: "layanan",
    type: "surat_cuti",
    catalogKey: "surat_cuti",
    label: "Surat cuti",
    title: "SURAT IZIN CUTI PEGAWAI",
    desc: "Form izin cuti per pegawai",
    needsEmployee: true,
  },
  {
    category: "layanan",
    type: "model_dk",
    catalogKey: "model_dk",
    label: "Model DK",
    title:
      "SURAT KETERANGAN UNTUK MENDAPATKAN PEMBAYARAN TUNJANGAN KELUARGA",
    desc: "Surat keterangan tunjangan keluarga",
    needsEmployee: true,
  },
];

/** Quick subtitle chips for absensi / tanda terima. */
const KEGIATAN_TEMPLATES = [
  { label: "Rapat", value: "KEGIATAN: Rapat ......................................." },
  {
    label: "Penyerahan",
    value: "KEGIATAN: Penyerahan .......................................",
  },
  {
    label: "Diklat",
    value: "KEGIATAN: Pelatihan / diklat .......................................",
  },
  {
    label: "Kosong",
    value: "KEGIATAN: .......................................",
  },
];

export default function Print() {
  useDocumentTitle("Cetak");
  const { canWrite } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  /** Last applied query string — allow re-entry deep-links while already on /print. */
  const lastDeepLinkKey = useRef<string>("");
  const [employees, setEmployees] = useState<Employee[]>(
    () => peekAllEmployeesLean() ?? [],
  );
  const [settings, setSettings] = useState<AppSettings | null>(
    () => api.peekSettings(["core", "logo", "kamus"]) ?? null,
  );
  const [loading, setLoading] = useState(
    () => !peekAllEmployeesLean() || !api.peekSettings(["core", "logo", "kamus"]),
  );
  const [cutiConfirmOpen, setCutiConfirmOpen] = useState(false);
  const [cutiBusy, setCutiBusy] = useState(false);

  // Print Configuration States — restore last unit/sort for absensi habit
  const savedUnit = readLs(LS_LAST_UNIT);
  const savedSort = readLs(LS_LAST_SORT);
  const [printCategory, setPrintCategory] = useState<"laporan" | "layanan">(
    "laporan",
  );
  const [printType, setPrintType] = useState<PrintType>(() =>
    savedUnit && savedUnit !== "Semua" ? "absen_bidang" : "absen_global",
  );
  const [customTitle, setCustomTitle] = useState(() =>
    savedUnit && savedUnit !== "Semua"
      ? `DAFTAR HADIR UNIT KERJA ${savedUnit.toUpperCase()}`
      : "DAFTAR HADIR / ABSENSI PEGAWAI",
  );
  const [customSubtitle, setCustomSubtitle] = useState(
    "KEGIATAN: .......................................",
  );
  const [selectedBidang, setSelectedBidang] = useState<string>(
    () => savedUnit || "Semua",
  );
  const [sortOption, setSortOption] = useState<SortAction>(() =>
    savedSort === "abjad" ? "abjad" : "default_kelas",
  );

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
  /** Mobile studio steps: 1 dokumen → 2 opsi → 3 pratinjau */
  const [mobileStep, setMobileStep] = useState<MobileStep>(1);
  const [empQuery, setEmpQuery] = useState("");
  /** Full detail for layanan docs (lean list strips sisaCuti / keluarga / gaji). */
  const [empDetailLoading, setEmpDetailLoading] = useState(false);
  const [empDetailError, setEmpDetailError] = useState(false);
  /** While printing cuti tahunan after potong, form V shows saldo sebelum potong. */
  const [cutiSisaPrint, setCutiSisaPrint] = useState<CutiSisaSnapshot | null>(
    null,
  );
  /** Bump to re-fetch full employee after a failed hydrate. */
  const [empDetailRetry, setEmpDetailRetry] = useState(0);
  const printTimersRef = useRef<{
    printDelay?: ReturnType<typeof setTimeout>;
    fallback?: ReturnType<typeof setTimeout>;
    clearSnapshot?: () => void;
  }>({});

  useEffect(() => {
    if (cutiMulai && cutiAkhir) {
      setCutiLamaHari(countWorkingDays(cutiMulai, cutiAkhir));
    } else {
      setCutiLamaHari(0);
    }
  }, [cutiMulai, cutiAkhir]);

  // Prefill alasan only for sakit/melahirkan when field still empty (don't clobber edits)
  useEffect(() => {
    if (cutiJenis.startsWith("3.")) {
      setCutiAlasan((prev) => (prev.trim() ? prev : "Sakit"));
    } else if (cutiJenis.startsWith("4.")) {
      setCutiAlasan((prev) => (prev.trim() ? prev : "Melahirkan"));
    }
  }, [cutiJenis]);

  // New employee → clear leave window so we never print person A's dates on person B
  const prevCutiEmpRef = useRef<string>("");
  useEffect(() => {
    if (!cutiEmployeeId) {
      prevCutiEmpRef.current = "";
      return;
    }
    if (
      prevCutiEmpRef.current &&
      prevCutiEmpRef.current !== cutiEmployeeId
    ) {
      setCutiMulai("");
      setCutiAkhir("");
      setCutiAlamat("");
      setCutiSisaPrint(null);
      // Reset alasan; re-apply default for sakit/melahirkan
      if (cutiJenis.startsWith("3.")) setCutiAlasan("Sakit");
      else if (cutiJenis.startsWith("4.")) setCutiAlasan("Melahirkan");
      else setCutiAlasan("");
    }
    prevCutiEmpRef.current = cutiEmployeeId;
  }, [cutiEmployeeId, cutiJenis]);

  // Cleanup print listeners/timers if user leaves the page mid-print flow
  useEffect(() => {
    return () => {
      const t = printTimersRef.current;
      if (t.printDelay) clearTimeout(t.printDelay);
      if (t.fallback) clearTimeout(t.fallback);
      t.clearSnapshot?.();
      printTimersRef.current = {};
    };
  }, []);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Warm path: bootstrap already filled cache — usually instant
        const warmList = peekAllEmployeesLean();
        const warmSettings = api.peekSettings(["core", "logo", "kamus"]);
        if (warmList && warmSettings) {
          const kamus = warmSettings.jabatanKamusCsv;
          setSettings(warmSettings);
          setEmployees(
            warmList.map((emp) => {
              if (!emp.jabatan || !kamus) return emp;
              const { kelas, beban } = lookupKamus(emp.jabatan, kamus);
              return kelas || beban
                ? { ...emp, kelasJabatan: kelas, bebanKerja: beban }
                : emp;
            }),
          );
          setLoading(false);
          return;
        }

        const currentSettings = await api.getSettings(["core", "logo", "kamus"]);
        setSettings(currentSettings);

        const all: Employee[] = [];
        let offset = 0;
        const pageSize = 500;
        for (let page = 0; page < 50; page++) {
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

  // Hydrate full employee for layanan (lean list lacks sisaCuti*, keluarga, gaji, alamat)
  useEffect(() => {
    if (!cutiEmployeeId) {
      setEmpDetailLoading(false);
      setEmpDetailError(false);
      setCutiMasaKerja("");
      setCutiHp("");
      setCutiSisaPrint(null);
      return;
    }
    let cancelled = false;
    setEmpDetailLoading(true);
    setEmpDetailError(false);
    // Optimistic fill from lean list while full detail loads
    const lean = employees.find((e) => e.id === cutiEmployeeId);
    const leanHp = lean?.nomorHp || "";
    if (lean) {
      setCutiMasaKerja(lean.masaKerja || "");
      setCutiHp(leanHp);
    }
    (async () => {
      try {
        const full = await api.getEmployee(cutiEmployeeId);
        if (cancelled) return;
        if (!full) {
          setEmpDetailError(true);
          notify.error("Pegawai tidak ditemukan");
          return;
        }
        setEmpDetailError(false);
        setCutiMasaKerja(full.masaKerja || "");
        // Don't overwrite HP if operator already edited it during load
        setCutiHp((current) => {
          if (current && current !== leanHp) return current;
          return full.nomorHp || current || "";
        });
        setEmployees((prev) => {
          const idx = prev.findIndex((e) => e.id === cutiEmployeeId);
          if (idx < 0) return [...prev, full];
          const next = [...prev];
          // Keep kamus-enriched kelas from list if full omits it
          next[idx] = {
            ...next[idx],
            ...full,
            kelasJabatan: full.kelasJabatan || next[idx].kelasJabatan,
            bebanKerja: full.bebanKerja || next[idx].bebanKerja,
          };
          return next;
        });
      } catch {
        if (!cancelled) {
          setEmpDetailError(true);
          notify.error("Gagal memuat detail pegawai");
        }
      } finally {
        if (!cancelled) setEmpDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // employees intentionally omitted: re-run only on selection / retry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutiEmployeeId, empDetailRetry]);

  /** Golongan weight for hierarchy sort — exact token only (avoid III/A matching II/A). */
  const getGolonganWeight = useCallback((emp: Employee) => {
    const g = (emp.pangkatGolongan || emp.gol || emp.pangkat || "")
      .toUpperCase()
      .replace(/\s/g, "")
      .replace(/[.\-]/g, "/");

    const pns: [string, number][] = [
      ["IV/E", 45],
      ["IV/D", 44],
      ["IV/C", 43],
      ["IV/B", 42],
      ["IV/A", 41],
      ["III/D", 34],
      ["III/C", 33],
      ["III/B", 32],
      ["III/A", 31],
      ["II/D", 24],
      ["II/C", 23],
      ["II/B", 22],
      ["II/A", 21],
      ["I/D", 14],
      ["I/C", 13],
      ["I/B", 12],
      ["I/A", 11],
    ];
    for (const [token, w] of pns) {
      if (g === token || g === token.replace("/", "")) return w;
    }

    const roman: [string, number][] = [
      ["XVII", 117],
      ["XVI", 116],
      ["XV", 115],
      ["XIV", 114],
      ["XIII", 113],
      ["XII", 112],
      ["XI", 111],
      ["X", 110],
      ["IX", 109],
      ["VIII", 108],
      ["VII", 107],
      ["VI", 106],
      ["V", 105],
    ];
    for (const [token, w] of roman) {
      if (g === token) return w;
    }

    const num = parseInt(g, 10);
    if (!isNaN(num)) return num;
    return 0;
  }, []);

  const uniqueBidang = useMemo(() => {
    const bidangSet = new Set(
      employees.map((e) => e.bidang || "Tidak Ada Bidang"),
    );
    return Array.from(bidangSet).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (printType === "absen_bidang" && selectedBidang !== "Semua") {
        const b = (emp.bidang || "Tidak Ada Bidang").trim();
        return b.toLowerCase() === selectedBidang.trim().toLowerCase();
      }
      return true;
    });
  }, [employees, printType, selectedBidang]);

  const sortedEmployees = useMemo(() => {
    const statusOrder: Record<string, number> = {
      PNS: 1,
      CPNS: 2,
      PPPK: 3,
      PPPKPW: 4,
      Honorer: 5,
      Lainnya: 6,
    };
    return [...filteredEmployees].sort((a, b) => {
      if (sortOption === "abjad") {
        return (a.nama || "").localeCompare(b.nama || "", "id");
      }
      const statusA = statusOrder[a.status || ""] || 99;
      const statusB = statusOrder[b.status || ""] || 99;
      if (statusA !== statusB) return statusA - statusB;

      // For DUK, pangkat/gol first; otherwise kelas jabatan first
      if (printType === "duk") {
        const golA = getGolonganWeight(a);
        const golB = getGolonganWeight(b);
        if (golA !== golB) return golB - golA;
        const kelasA = parseInt(a.kelasJabatan || "0", 10);
        const kelasB = parseInt(b.kelasJabatan || "0", 10);
        if (kelasB !== kelasA) return kelasB - kelasA;
      } else {
        const kelasA = parseInt(a.kelasJabatan || "0", 10);
        const kelasB = parseInt(b.kelasJabatan || "0", 10);
        if (kelasB !== kelasA) return kelasB - kelasA;
        const golA = getGolonganWeight(a);
        const golB = getGolonganWeight(b);
        if (golA !== golB) return golB - golA;
      }
      return (a.nama || "").localeCompare(b.nama || "", "id");
    });
  }, [filteredEmployees, sortOption, printType, getGolonganWeight]);

  const activeDocKey =
    printType === "absen_bidang" || printType === "absen_global"
      ? "absen_global"
      : printType;

  const activeDoc = DOCUMENTS.find((d) => d.catalogKey === activeDocKey);

  const selectDocument = useCallback(
    (doc: PrintDoc) => {
      setPrintCategory(doc.category);
      setEmpQuery("");
      if (doc.type === "absen_global") {
        const lastRaw = readLs(LS_LAST_UNIT);
        const lastUnit =
          lastRaw && lastRaw !== "Semua"
            ? resolveBidangLabel(lastRaw, uniqueBidang) ||
              (uniqueBidang.length === 0 ? lastRaw : null)
            : null;
        if (lastUnit) {
          setSelectedBidang(lastUnit);
          setPrintType("absen_bidang");
          setCustomTitle(`DAFTAR HADIR UNIT KERJA ${lastUnit.toUpperCase()}`);
        } else {
          setSelectedBidang("Semua");
          setPrintType("absen_global");
          setCustomTitle(doc.title);
        }
        setCustomSubtitle("KEGIATAN: .......................................");
      } else if (doc.type === "tanda_terima") {
        setSelectedBidang("Semua");
        setPrintType(doc.type);
        setCustomTitle(doc.title);
        setCustomSubtitle("KEGIATAN: .......................................");
      } else if (doc.type === "duk") {
        setSelectedBidang("Semua");
        setPrintType(doc.type);
        setCustomTitle(doc.title);
        setCustomSubtitle(
          `PER ${new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }).toUpperCase()}`,
        );
        setSortOption("default_kelas");
      } else {
        setSelectedBidang("Semua");
        setPrintType(doc.type);
        setCustomTitle(doc.title);
      }
      setMobileStep(2);
    },
    [uniqueBidang],
  );

  // Persist absensi unit + sort for next visit
  useEffect(() => {
    if (printType === "absen_global" || printType === "absen_bidang") {
      writeLs(LS_LAST_UNIT, selectedBidang);
    }
  }, [selectedBidang, printType]);

  useEffect(() => {
    if (printCategory === "laporan") {
      writeLs(LS_LAST_SORT, sortOption);
    }
  }, [sortOption, printCategory]);

  // Deep-link: /print?doc=surat_cuti&id=…  ·  ?doc=absen&bidang=Sekretariat
  useEffect(() => {
    if (loading) return;
    const key = searchParams.toString();
    if (!key) return;
    if (key === lastDeepLinkKey.current) return;

    const docType = parseDocParam(searchParams.get("doc"));
    const id = searchParams.get("id") || searchParams.get("employeeId");
    const bidangQ = searchParams.get("bidang");
    if (!docType && !id && !bidangQ) {
      // Unknown / junk query — consume so URL stays clean
      lastDeepLinkKey.current = key;
      setSearchParams({}, { replace: true });
      return;
    }

    // Wait for employee list before binding id (avoids partial hydrate).
    // If load finished and list still empty (org kosong), consume the link.
    if (id && employees.length === 0) {
      if (!loading) {
        lastDeepLinkKey.current = key;
        setSearchParams({}, { replace: true });
        notify.warning(
          "Belum ada data pegawai",
          "Impor atau tambah pegawai dulu, lalu buka tautan lagi.",
        );
      }
      return;
    }

    // id without doc → assume layanan cuti (common deep-link from Pegawai)
    const catalogType: PrintType =
      docType === "absen_bidang"
        ? "absen_global"
        : docType || (id ? "surat_cuti" : "absen_global");
    const doc =
      DOCUMENTS.find((d) => d.catalogKey === catalogType || d.type === catalogType) ||
      DOCUMENTS[0]!;

    setPrintCategory(doc.category);
    setEmpQuery("");
    if (doc.type === "absen_global" || docType === "absen_bidang") {
      const rawUnit = bidangQ || readLs(LS_LAST_UNIT) || "Semua";
      const bidangOpts = [
        ...new Set(employees.map((e) => e.bidang || "Tidak Ada Bidang")),
      ];
      const canonical =
        rawUnit === "Semua" ? null : resolveBidangLabel(rawUnit, bidangOpts);
      // Unknown unit → semua (don't leave empty absensi filter)
      const unit =
        rawUnit === "Semua" ? "Semua" : canonical || "Semua";
      if (rawUnit !== "Semua" && !canonical && employees.length > 0) {
        notify.warning(
          "Unit tidak ditemukan",
          `“${rawUnit}” tidak ada di data — menampilkan semua unit.`,
        );
      }
      setSelectedBidang(unit);
      if (unit !== "Semua") {
        setPrintType("absen_bidang");
        setCustomTitle(`DAFTAR HADIR UNIT KERJA ${unit.toUpperCase()}`);
      } else {
        setPrintType("absen_global");
        setCustomTitle(doc.title);
      }
      setCustomSubtitle("KEGIATAN: .......................................");
    } else if (doc.type === "tanda_terima") {
      setPrintType("tanda_terima");
      setCustomTitle(doc.title);
      setCustomSubtitle("KEGIATAN: .......................................");
    } else if (doc.type === "duk") {
      setPrintType("duk");
      setCustomTitle(doc.title);
      setCustomSubtitle(
        `PER ${new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).toUpperCase()}`,
      );
      setSortOption("default_kelas");
    } else {
      setPrintType(doc.type);
      setCustomTitle(doc.title);
    }

    if (id) {
      if (employees.some((e) => e.id === id)) {
        setCutiEmployeeId(id);
      } else {
        setCutiEmployeeId("");
        notify.warning(
          "Pegawai tidak di daftar",
          "Tautan merujuk data yang tidak ada — pilih pegawai manual.",
        );
      }
    }
    setMobileStep(2);

    lastDeepLinkKey.current = key;
    // Strip query so refresh doesn't re-apply; keep clean URL
    setSearchParams({}, { replace: true });
  }, [loading, employees, searchParams, setSearchParams]);

  // Allow the same deep-link again after we stripped the query (back button / re-click)
  useEffect(() => {
    if (!searchParams.toString()) {
      lastDeepLinkKey.current = "";
    }
  }, [searchParams]);

  // Drop / canonicalize remembered unit against master data
  useEffect(() => {
    if (loading || uniqueBidang.length === 0) return;
    if (selectedBidang === "Semua") return;
    const canonical = resolveBidangLabel(selectedBidang, uniqueBidang);
    if (!canonical) {
      setSelectedBidang("Semua");
      if (printType === "absen_bidang") {
        setPrintType("absen_global");
        setCustomTitle("DAFTAR HADIR / ABSENSI PEGAWAI");
      }
      writeLs(LS_LAST_UNIT, "Semua");
    } else if (canonical !== selectedBidang) {
      setSelectedBidang(canonical);
      writeLs(LS_LAST_UNIT, canonical);
    }
  }, [loading, uniqueBidang, selectedBidang, printType]);

  const readiness = useMemo(() => {
    if (loading) {
      return { ready: false, reason: "Memuat data…" };
    }
    if (activeDoc?.needsEmployee && !cutiEmployeeId) {
      return { ready: false, reason: "Pilih pegawai dulu" };
    }
    if (activeDoc?.needsEmployee && empDetailLoading) {
      return { ready: false, reason: "Memuat detail pegawai…" };
    }
    if (activeDoc?.needsEmployee && empDetailError) {
      return {
        ready: false,
        reason: "Detail pegawai gagal dimuat — pilih ulang",
      };
    }
    if (printType === "surat_cuti") {
      if (!cutiMulai || !cutiAkhir) {
        return { ready: false, reason: "Lengkapi tanggal cuti" };
      }
      if (cutiMulai > cutiAkhir) {
        return { ready: false, reason: "Tanggal selesai harus ≥ tanggal mulai" };
      }
      if (cutiLamaHari <= 0) {
        return {
          ready: false,
          reason: "Tidak ada hari kerja di rentang tanggal (cek weekend/libur)",
        };
      }
      if (isCutiTahunan(cutiJenis) && !cutiAlasan.trim()) {
        return { ready: false, reason: "Isi alasan cuti" };
      }
    }
    if (printCategory === "laporan" && sortedEmployees.length === 0) {
      return { ready: false, reason: "Tidak ada data pegawai untuk dicetak" };
    }
    return { ready: true, reason: null as string | null };
  }, [
    loading,
    activeDoc,
    cutiEmployeeId,
    empDetailLoading,
    empDetailError,
    printType,
    cutiMulai,
    cutiAkhir,
    cutiLamaHari,
    cutiJenis,
    cutiAlasan,
    printCategory,
    sortedEmployees.length,
  ]);

  const employeeOptions = useMemo(() => {
    const q = empQuery.trim().toLowerCase();
    const list = [...employees].sort((a, b) =>
      (a.nama || "").localeCompare(b.nama || "", "id"),
    );
    let filtered = q
      ? list.filter(
          (e) =>
            (e.nama || "").toLowerCase().includes(q) ||
            (e.nip || "").toLowerCase().includes(q),
        )
      : list;
    // Keep selected employee visible even if outside filter / top-80
    if (cutiEmployeeId) {
      const selected = employees.find((e) => e.id === cutiEmployeeId);
      if (selected && !filtered.some((e) => e.id === cutiEmployeeId)) {
        filtered = [selected, ...filtered];
      }
    }
    // Cap list but never drop the selected row
    if (filtered.length <= 80) return filtered;
    const head = filtered.slice(0, 80);
    if (
      cutiEmployeeId &&
      !head.some((e) => e.id === cutiEmployeeId)
    ) {
      const selected = filtered.find((e) => e.id === cutiEmployeeId);
      if (selected) return [selected, ...head.slice(0, 79)];
    }
    return head;
  }, [employees, empQuery, cutiEmployeeId]);

  const toProperCase = useCallback((str: string) => {
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase(),
    );
  }, []);

  /** Parse YYYY-MM-DD as local date (avoid UTC day-shift). */
  const formatDateId = useCallback((d?: string) => {
    if (!d) return "-";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.trim());
    if (m) {
      const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  const getHierarchy = useCallback(
    (emp: Employee | undefined) => {
      if (!emp)
        return { atasan: "-", nipAtasan: "-", pejabat: "-", nipPejabat: "-" };
      const kadis = employees.find((e) =>
        /(kepala\s+dinas|kadis)/i.test(e.jabatan || ""),
      );
      const sekre = employees.find(
        (e) =>
          /sekretaris/i.test(e.jabatan || "") &&
          /sekretariat/i.test(e.bidang || ""),
      );
      const kabid = employees.find(
        (e) =>
          /kepala\s+bidang/i.test(e.jabatan || "") && e.bidang === emp.bidang,
      );

      const jab = emp.jabatan || "";
      const bid = emp.bidang || "";
      const isKadis = /(kepala\s+dinas|kadis)/i.test(jab);
      const isSekre = /sekretaris/i.test(jab) && /sekretariat/i.test(bid);
      const isKabid = /kepala\s+bidang/i.test(jab);
      const isSekretariat = /sekretariat/i.test(bid);

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
    },
    [employees, settings],
  );

  const kadisEmp = useMemo(
    () =>
      employees.find((e) => /(kepala\s+dinas|kadis)/i.test(e.jabatan || "")),
    [employees],
  );
  const kadisTitle = settings?.kopLine2
    ? `Kepala ${toProperCase(settings.kopLine2)}`
    : "Kepala Dinas";
  const ttdName =
    kadisEmp?.nama || "...........................................";
  const ttdPangkat =
    kadisEmp?.pangkatGolongan || "Pangkat Golongan ..........................";
  const ttdNip = kadisEmp?.nip || "........................................";
  const instansiNama =
    settings?.kopLine2?.trim() || "DINAS KOMUNIKASI DAN INFORMATIKA";
  const instansiAlamat =
    [settings?.kopLine3, settings?.kopLine4].filter(Boolean).join(", ") ||
    "Jl. Nusantara No. 02 (Area Balai Serbaguna)";

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
      // Snapshot BEFORE potong — form BKN menampilkan saldo saat pengajuan
      const prePrint: CutiSisaSnapshot = {
        n: String(sisaN),
        n1: String(sisaN1),
        n2: String(sisaN2),
      };
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
      setCutiSisaPrint(prePrint);
      setCutiConfirmOpen(false);
      notify.success("Sisa cuti diperbarui");
      let cleared = false;
      const clearSnapshot = () => {
        if (cleared) return;
        cleared = true;
        setCutiSisaPrint(null);
        window.removeEventListener("afterprint", clearSnapshot);
        const t = printTimersRef.current;
        if (t.fallback) clearTimeout(t.fallback);
        if (t.printDelay) clearTimeout(t.printDelay);
        t.fallback = undefined;
        t.printDelay = undefined;
        t.clearSnapshot = undefined;
      };
      printTimersRef.current.clearSnapshot = clearSnapshot;
      window.addEventListener("afterprint", clearSnapshot);
      printTimersRef.current.printDelay = setTimeout(() => {
        // Register fallback BEFORE print — afterprint can fire sync during print()
        printTimersRef.current.fallback = setTimeout(clearSnapshot, 60_000);
        try {
          window.print();
        } catch {
          clearSnapshot();
          notify.warning(
            "Cetak diblokir browser",
            "Gunakan Ctrl+P (Windows) atau Cmd+P (Mac).",
          );
        }
      }, 300);
    } catch (err) {
      console.error(err);
      setCutiSisaPrint(null);
      notify.error(
        "Gagal mengurangi sisa cuti",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setCutiBusy(false);
    }
  };

  const handlePrintClick = async () => {
    if (!readiness.ready) {
      notify.error("Belum siap dicetak", readiness.reason || undefined);
      setMobileStep(2);
      return;
    }
    if (printType === "surat_cuti" && isCutiTahunan(cutiJenis)) {
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

  const fieldLabel =
    "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

  const selectedEmpName = cutiEmployeeId
    ? employees.find((e) => e.id === cutiEmployeeId)?.nama || "Pegawai"
    : null;

  const contextLine = [
    activeDoc?.label || "Dokumen",
    printCategory === "laporan"
      ? `${sortedEmployees.length} pegawai`
      : selectedEmpName || "Belum pilih pegawai",
    printCategory === "laporan"
      ? sortOption === "abjad"
        ? "A–Z"
        : printType === "duk"
          ? "urut kepangkatan"
          : "hierarki"
      : null,
    printType === "absen_bidang" && selectedBidang !== "Semua"
      ? selectedBidang
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  /** Operator-facing summary before print (options + preview chrome). */
  const printSummaryLines = useMemo(() => {
    const lines: string[] = [];
    lines.push(activeDoc?.label || "Dokumen");
    if (printCategory === "laporan") {
      lines.push(`${sortedEmployees.length} pegawai`);
      if (printType === "absen_bidang" && selectedBidang !== "Semua") {
        lines.push(`Unit: ${selectedBidang}`);
      } else if (printType === "absen_global") {
        lines.push("Semua unit");
      }
      lines.push(
        sortOption === "abjad"
          ? "Urutan A–Z"
          : printType === "duk"
            ? "Urut gol → kelas → nama"
            : "Urut status → kelas → nama",
      );
    } else {
      lines.push(selectedEmpName || "Belum pilih pegawai");
      if (printType === "surat_cuti") {
        lines.push(cutiJenis.replace(/^\d+\.\s*/, ""));
        if (cutiMulai && cutiAkhir) {
          lines.push(`${cutiLamaHari} hari kerja`);
        }
        if (isCutiTahunan(cutiJenis)) {
          lines.push(
            canWrite
              ? "Admin: potong sisa cuti saat konfirmasi"
              : "Viewer: cetak saja (saldo tidak potong)",
          );
        }
      }
    }
    if (!settings?.logoBase64) {
      lines.push("Logo dinas belum diisi (Pengaturan)");
    }
    return lines;
  }, [
    activeDoc?.label,
    printCategory,
    sortedEmployees.length,
    printType,
    selectedBidang,
    sortOption,
    selectedEmpName,
    cutiJenis,
    cutiMulai,
    cutiAkhir,
    cutiLamaHari,
    canWrite,
    settings?.logoBase64,
  ]);

  // Soft load: keep studio chrome visible while data streams (no full-page blank)

  const documentList = (
    <div className="space-y-3">
      {(
        [
          ["laporan", "Laporan", ClipboardList],
          ["layanan", "Layanan personal", FileSignature],
        ] as const
      ).map(([cat, title, Icon]) => (
        <div key={cat}>
          <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Icon className="w-3 h-3" />
            {title}
          </p>
          <ul className="space-y-1">
            {DOCUMENTS.filter((d) => d.category === cat).map((doc) => {
              const active = activeDocKey === doc.catalogKey;
              return (
                <li key={doc.catalogKey}>
                  <button
                    type="button"
                    onClick={() => selectDocument(doc)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg transition-colors active:scale-[0.99] border",
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    <span className="block text-sm font-semibold">
                      {doc.label}
                    </span>
                    <span
                      className={cn(
                        "block text-[11px] mt-0.5 leading-snug",
                        active ? "text-slate-300" : "text-slate-500",
                      )}
                    >
                      {doc.desc}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  const optionsPanel = (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Pengaturan dokumen
        </p>
        <p className="text-sm font-semibold text-slate-900 mt-0.5">
          {activeDoc?.label || "—"}
        </p>
      </div>

      {/* Ringkasan sebelum cetak */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          Ringkasan cetak
        </p>
        <ul className="text-xs text-slate-700 space-y-0.5">
          {printSummaryLines.map((line, i) => (
            <li key={`${i}-${line}`} className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

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
            {uniqueBidang.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          {selectedBidang !== "Semua" && (
            <p className="text-[11px] text-slate-400 mt-1">
              Unit terakhir diingat untuk kunjungan berikutnya.
            </p>
          )}
        </div>
      )}

      {printType === "duk" && (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 leading-snug">
          <strong className="text-slate-800">DUK operasional</strong> — kolom
          gol/pangkat, TMT gol, jabatan, kelas, unit, status. Diurutkan
          kepangkatan (bukan lembar absensi TTD).
        </div>
      )}

      {printCategory === "laporan" && (
        <>
          <div>
            <label className={fieldLabel}>Urutan</label>
            <select
              className={select}
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortAction)}
            >
              <option value="default_kelas">
                {printType === "duk"
                  ? "Urut kepangkatan (gol → kelas → nama)"
                  : "Hierarki (status, kelas)"}
              </option>
              <option value="abjad">Alfabetis (A–Z)</option>
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Judul dokumen</label>
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
            {(printType === "absen_global" ||
              printType === "absen_bidang" ||
              printType === "tanda_terima") && (
              <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Template kegiatan">
                {KEGIATAN_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    className={cn(
                      chip(customSubtitle === t.value),
                      "px-2.5 py-1 text-[11px]",
                    )}
                    onClick={() => setCustomSubtitle(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {printCategory === "layanan" && (
        <>
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold",
              canWrite
                ? "border-slate-200 bg-slate-50 text-slate-700"
                : "border-sky-100 bg-sky-50 text-sky-900",
            )}
          >
            {canWrite ? (
              <Shield className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Eye className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {canWrite
                ? "Mode admin — cuti tahunan dapat memotong sisa cuti"
                : "Mode baca (viewer) — cetak tidak mengubah sisa cuti"}
            </span>
          </div>
          <div>
            <label className={fieldLabel}>Pegawai</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="search"
                value={empQuery}
                onChange={(e) => setEmpQuery(e.target.value)}
                placeholder="Cari nama atau NIP…"
                className={`${input} pl-9`}
              />
            </div>
            <select
              className={select}
              value={cutiEmployeeId}
              onChange={(e) => {
                setCutiEmployeeId(e.target.value);
                if (e.target.value) setEmpQuery("");
              }}
            >
              <option value="">— Pilih pegawai —</option>
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nama} — {emp.nip || "tanpa NIP"}
                </option>
              ))}
            </select>
            {empQuery.trim() &&
              !employees.some(
                (e) =>
                  (e.nama || "").toLowerCase().includes(empQuery.trim().toLowerCase()) ||
                  (e.nip || "").toLowerCase().includes(empQuery.trim().toLowerCase()),
              ) && (
                <p className="text-xs text-slate-500 mt-1">
                  Tidak ada yang cocok.
                </p>
              )}
            {employees.length > 80 && !empQuery && (
              <p className="text-[11px] text-slate-400 mt-1">
                Menampilkan 80 pertama — ketik nama/NIP untuk mencari.
              </p>
            )}
            {empDetailLoading && cutiEmployeeId && (
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Memuat detail pegawai…
              </p>
            )}
            {empDetailError && cutiEmployeeId && !empDetailLoading && (
              <button
                type="button"
                className={`${btnSecondary} mt-2 w-full text-xs`}
                onClick={() => setEmpDetailRetry((n) => n + 1)}
              >
                Coba muat ulang detail
              </button>
            )}
          </div>
          {printType === "surat_cuti" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isCutiTahunan(cutiJenis) && (
                <div className="sm:col-span-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 leading-snug space-y-1">
                  {canWrite ? (
                    <>
                      <p className="font-semibold">Cuti tahunan · potong saldo</p>
                      <p>
                        Saat Anda konfirmasi, sisa cuti dipotong dulu (N-2 →
                        N-1 → N), lalu dialog cetak dibuka.{" "}
                        <strong>
                          Membatalkan dialog cetak browser tidak mengembalikan
                          sisa cuti
                        </strong>
                        — perbaiki saldo di Pegawai bila perlu.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Mode baca · tanpa potong</p>
                      <p>
                        Anda bisa mencetak formulir, tetapi sisa cuti tidak
                        berubah. Minta admin untuk mencetak bila saldo harus
                        dipotong.
                      </p>
                    </>
                  )}
                </div>
              )}
              {cutiEmployeeId && !empDetailLoading && !empDetailError && (
                <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                  Sisa cuti: N=
                  {employees.find((e) => e.id === cutiEmployeeId)?.sisaCutiN ||
                    "0"}
                  , N-1=
                  {employees.find((e) => e.id === cutiEmployeeId)?.sisaCutiN1 ||
                    "0"}
                  , N-2=
                  {employees.find((e) => e.id === cutiEmployeeId)?.sisaCutiN2 ||
                    "0"}
                </div>
              )}
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
                  <option value="4. Cuti Melahirkan">Cuti melahirkan</option>
                  <option value="5. Cuti Karena Alasan Penting">
                    Cuti alasan penting
                  </option>
                  <option value="6. Cuti di Luar Tanggungan Negara">CLTN</option>
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
                  placeholder="Alamat yang dapat dihubungi"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Nomor HP selama cuti</label>
                <input
                  type="tel"
                  className={input}
                  value={cutiHp}
                  onChange={(e) => setCutiHp(e.target.value)}
                  placeholder="08…"
                />
              </div>
            </div>
          )}
          {printType === "model_dk" && cutiEmployeeId && !empDetailLoading && (
            <p className="text-[11px] text-slate-500 leading-snug">
              Data keluarga & gaji diambil dari biodata pegawai. Lengkapi di
              halaman Pegawai jika kosong.
            </p>
          )}
        </>
      )}

      {!readiness.ready && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{readiness.reason}</span>
        </div>
      )}
    </div>
  );

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
            description={contextLine}
            actions={
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border",
                  readiness.ready
                    ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                    : "bg-amber-50 text-amber-900 border-amber-100",
                )}
              >
                {readiness.ready ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                {readiness.ready ? "Siap dicetak" : "Lengkapi dulu"}
              </div>
            }
          />
        </motion.div>

        {/* Mobile stepper */}
        <div className="lg:hidden mt-3 flex items-center gap-1">
          {(
            [
              [1, "Dokumen"],
              [2, "Opsi"],
              [3, "Pratinjau"],
            ] as const
          ).map(([step, label], i) => (
            <React.Fragment key={step}>
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
              <button
                type="button"
                onClick={() => setMobileStep(step)}
                className={cn(
                  "flex-1 py-2 px-1 rounded-lg text-[11px] font-bold border transition-colors",
                  mobileStep === step
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200",
                )}
              >
                {step}. {label}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Desktop 2-pane studio · Mobile step panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
        {/* LEFT: catalog + config */}
        <div
          className={cn(
            "print-hidden lg:col-span-4 space-y-4 lg:sticky lg:top-4 lg:self-start",
            mobileStep === 3 ? "hidden lg:block" : "block",
          )}
        >
          <section
            className={cn(
              `${card} overflow-hidden`,
              mobileStep !== 1 && "hidden lg:block",
            )}
          >
            <div className={cardHeader}>
              <h2 className="text-sm font-semibold text-slate-800">
                1 · Pilih dokumen
              </h2>
            </div>
            <div className="p-3">{documentList}</div>
            <div className="lg:hidden p-3 border-t border-slate-100">
              <button
                type="button"
                className={`${btnPrimary} w-full`}
                onClick={() => setMobileStep(2)}
              >
                Lanjut ke opsi
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          <section
            className={cn(
              `${card} overflow-hidden`,
              mobileStep !== 2 && "hidden lg:block",
            )}
          >
            <div className={cardHeader}>
              <h2 className="text-sm font-semibold text-slate-800">
                2 · Atur opsi
              </h2>
            </div>
            <div className="p-4 sm:p-5 max-h-[min(70vh,720px)] overflow-y-auto">
              {optionsPanel}
            </div>
            <div className="lg:hidden p-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                className={`${btnSecondary} flex-1`}
                onClick={() => setMobileStep(1)}
              >
                <ChevronLeft className="w-4 h-4" />
                Dokumen
              </button>
              <button
                type="button"
                className={`${btnPrimary} flex-1`}
                onClick={() => setMobileStep(3)}
              >
                Pratinjau
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        </div>

        {/* RIGHT: preview hero */}
        <section
          className={cn(
            "lg:col-span-8 space-y-2 min-w-0",
            mobileStep !== 3 && "hidden lg:block",
          )}
        >
          <div
            className={`print-hidden ${card} px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
          >
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-800">
                3 · Pratinjau
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                A4 · yang tampil = yang dicetak · {contextLine}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block truncate">
                {printSummaryLines.join(" · ")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className={`${btnSecondary} lg:hidden`}
                onClick={() => setMobileStep(2)}
              >
                <ChevronLeft className="w-4 h-4" />
                Opsi
              </button>
              <button
                type="button"
                onClick={() => void handlePrintClick()}
                disabled={!readiness.ready || loading}
                className={btnPrimary}
                title={readiness.reason || "Cetak"}
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                Cetak
              </button>
            </div>
          </div>

          {loading ? (
            <div
              className={`print-hidden ${card} min-h-[40vh] flex flex-col items-center justify-center gap-2 text-sm text-slate-500`}
            >
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              Memuat data cetak…
            </div>
          ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-200/80 p-3 sm:p-6 overflow-auto max-h-[min(78vh,920px)] shadow-inner print:p-0 print:border-none print:bg-transparent print:max-h-none print:overflow-visible print:rounded-none print:shadow-none">
            {/* Soft coach when layanan belum pilih pegawai (not printed) */}
            {activeDoc?.needsEmployee && !cutiEmployeeId && (
              <div className="print-hidden mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Pilih pegawai di panel opsi agar pratinjau terisi. Kertas di
                  bawah masih kerangka kosong.
                </span>
              </div>
            )}
            {activeDoc?.needsEmployee && empDetailError && (
              <div className="print-hidden mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Detail pegawai gagal dimuat. Pakai tombol “Coba muat ulang
                  detail” di panel opsi, atau pilih pegawai lain.
                </span>
              </div>
            )}
            <div
              ref={printRef}
              className="bg-white border border-slate-200 print-container text-[12pt] w-[210mm] max-w-none shrink-0 p-[15mm] print:max-w-full print:w-full print:p-0 mx-auto print:border-none shadow-sm print:shadow-none"
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
          ) : printType === "duk" ? (
            <>
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

              <div className="text-center mb-6 space-y-1">
                <h2 className="text-[12pt] font-bold uppercase">
                  {customTitle}
                </h2>
                {customSubtitle && (
                  <p className="text-[11pt] font-bold">{customSubtitle}</p>
                )}
              </div>

              <table className="w-full border-collapse mb-10 text-[9pt] leading-tight">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black px-1 py-1 w-8 text-center font-bold">
                      NO
                    </th>
                    <th className="border border-black px-1 py-1 text-center font-bold">
                      NAMA
                    </th>
                    <th className="border border-black px-1 py-1 w-28 text-center font-bold">
                      NIP
                    </th>
                    <th className="border border-black px-1 py-1 w-20 text-center font-bold">
                      PANGKAT / GOL
                    </th>
                    <th className="border border-black px-1 py-1 w-20 text-center font-bold">
                      TMT GOL
                    </th>
                    <th className="border border-black px-1 py-1 text-center font-bold">
                      JABATAN
                    </th>
                    <th className="border border-black px-1 py-1 w-12 text-center font-bold">
                      KELAS
                    </th>
                    <th className="border border-black px-1 py-1 w-16 text-center font-bold">
                      MASA KERJA
                    </th>
                    <th className="border border-black px-1 py-1 w-24 text-center font-bold">
                      UNIT KERJA
                    </th>
                    <th className="border border-black px-1 py-1 w-14 text-center font-bold">
                      STATUS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEmployees.map((emp, idx) => (
                    <tr key={emp.id || idx}>
                      <td className="border border-black px-1 py-0.5 text-center align-top">
                        {idx + 1}
                      </td>
                      <td className="border border-black px-1.5 py-0.5 align-top">
                        {emp.nama}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-center align-top">
                        {emp.nip || "-"}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-center align-top">
                        {emp.pangkatGolongan ||
                          [emp.pangkat, emp.gol].filter(Boolean).join(" / ") ||
                          "-"}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-center align-top">
                        {emp.tmtGolonganRuang
                          ? formatDateId(emp.tmtGolonganRuang)
                          : "-"}
                      </td>
                      <td className="border border-black px-1.5 py-0.5 align-top">
                        {emp.jabatan || "-"}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-center align-top">
                        {emp.kelasJabatan || "-"}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-center align-top text-[8pt]">
                        {emp.masaKerja || "-"}
                      </td>
                      <td className="border border-black px-1 py-0.5 align-top">
                        {emp.bidang || "-"}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-center align-top">
                        {emp.status || "-"}
                      </td>
                    </tr>
                  ))}
                  {sortedEmployees.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="border border-black px-4 py-6 text-center italic text-gray-500"
                      >
                        Tidak ada data pegawai untuk DUK.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="flex justify-end mt-12 pr-8 page-break-inside-avoid">
                <div className="text-left min-w-[200px] max-w-[350px]">
                  <p className="text-[11pt] mb-1">
                    Jember,{" "}
                    {new Date().toLocaleDateString("id-ID", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-[11pt] mb-20 leading-snug">{kadisTitle}</p>
                  <p className="text-[11pt] font-bold underline whitespace-nowrap">
                    {ttdName}
                  </p>
                  <p className="text-[11pt] whitespace-nowrap">{ttdPangkat}</p>
                  <p className="text-[11pt] mt-0.5 whitespace-nowrap">
                    NIP. {ttdNip}
                  </p>
                </div>
              </div>
            </>
          ) : printType === "surat_cuti" ? (
            (() => {
              const emp = employees.find((e) => e.id === cutiEmployeeId);
              const hierarchy = getHierarchy(emp);

              const listJenis = [
                "1. Cuti Tahunan",
                "4. Cuti Melahirkan",
                "2. Cuti Besar",
                "5. Cuti Karena Alasan Penting",
                "3. Cuti Sakit",
                "6. Cuti di Luar Tanggungan Negara",
              ];

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
                      <p>
                        Jember,{" "}
                        {new Date().toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
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
                          {matchesCutiJenisNumber(cutiJenis, 1) ? "✓" : ""}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[1]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {matchesCutiJenisNumber(cutiJenis, 4) ? "✓" : ""}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[2]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {matchesCutiJenisNumber(cutiJenis, 2) ? "✓" : ""}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[3]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {matchesCutiJenisNumber(cutiJenis, 5) ? "✓" : ""}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[4]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {matchesCutiJenisNumber(cutiJenis, 3) ? "✓" : ""}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[5]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {matchesCutiJenisNumber(cutiJenis, 6) ? "✓" : ""}
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
                          <s>/Bulan/Tahun</s>
                        </td>
                        <td className="px-1.5 py-0.5">
                          Mulai tanggal{" "}
                          <span className="mx-2">
                            {cutiMulai ? formatDateId(cutiMulai) : "-"}
                          </span>{" "}
                          s/d{" "}
                          <span className="mx-2">
                            {cutiAkhir ? formatDateId(cutiAkhir) : "-"}
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
                          {cutiSisaPrint?.n2 ?? emp?.sisaCutiN2 ?? "-"}
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
                          {cutiSisaPrint?.n1 ?? emp?.sisaCutiN1 ?? "-"}
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
                          {cutiSisaPrint?.n ?? emp?.sisaCutiN ?? "-"}
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
              const gajiDigits = String(emp?.besaranGajiKotor || "0").replace(
                /[^0-9]/g,
                "",
              );
              const numGaji = parseInt(gajiDigits, 10) || 0;
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

              const jkLabel =
                emp?.jk === "P"
                  ? "Perempuan"
                  : emp?.jk === "L"
                    ? "Laki-laki"
                    : emp?.jk || "-";

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
                        <td className="align-top py-0.5 uppercase">
                          {instansiNama}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">Alamat</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">{instansiAlamat}</td>
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

                  <table className="w-full text-[11pt] border-none mb-4">
                    <tbody>
                      {/* Fields 1–18 as Model DK spec */}
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
                          {emp?.pangkatGolongan ||
                            [emp?.pangkat, emp?.gol].filter(Boolean).join(" / ") ||
                            "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">4.</td>
                        <td className="align-top py-0.5">TMT Golongan Ruang</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {formatDateId(emp?.tmtGolonganRuang)}
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
                          {formatDateId(emp?.tanggalLahir)}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">6.</td>
                        <td className="align-top py-0.5">Jenis Kelamin</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">{jkLabel}</td>
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
                          {formatDateId(emp?.tmtKerja)}
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
                          {emp?.digajiMenurut ||
                            "......................................"}
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
                          {emp?.masaKerjaGolonganRuang ||
                            "....... Tahun ....... Bulan"}
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
                        const emptyRowContext: {
                          name: string;
                          birthDate: string;
                          marriageDate: string;
                          occupation?: string;
                          description?: string;
                        } = {
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
                                ? formatDateId(member.birthDate)
                                : ""}
                            </td>
                            <td className="border border-black">
                              {member?.name && member.marriageDate
                                ? formatDateId(member.marriageDate)
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
                        <p>{kadisTitle}</p>
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
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-500">
                Modul cetak belum tersedia
              </h3>
              <p className="text-slate-400 max-w-md mx-auto mt-2">
                Modul untuk mencetak <strong>{customTitle}</strong> sedang
                dikembangkan.
              </p>
            </div>
          )}
            </div>
          </div>
          )}
        </section>
      </div>


      <ConfirmDialog
        open={cutiConfirmOpen}
        onClose={() => !cutiBusy && setCutiConfirmOpen(false)}
        loading={cutiBusy}
        variant="danger"
        title="Potong sisa cuti lalu cetak?"
        description={
          <div className="space-y-2">
            <p>
              <strong>{selectedEmpName || "Pegawai"}</strong> ·{" "}
              {cutiLamaHari} hari kerja akan dipotong dari sisa cuti (urutan N-2
              → N-1 → N).
            </p>
            <p className="text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs">
              Saldo dipotong <strong>saat Anda menekan konfirmasi</strong>,
              sebelum dialog cetak browser muncul. Membatalkan cetak di browser
              tidak mengembalikan sisa cuti.
            </p>
            <p className="text-xs text-slate-500">
              Formulir menampilkan sisa cuti sebelum potong (sesuai format BKN).
            </p>
          </div>
        }
        confirmLabel="Ya, potong & cetak"
        cancelLabel="Batal (saldo aman)"
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
