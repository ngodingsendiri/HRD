import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Employee, AppSettings } from "../types";
import {
  Download,
  Loader2,
  ClipboardList,
  FileSignature,
  FileText,
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
import {
  peekAllEmployeesLean,
  preloadAllEmployeesLean,
} from "../lib/bootstrap";
import {
  isCutiTahunanJenis,
  parseDocParam,
  resolveBidangLabel,
} from "../lib/printParams";
import { PrintListDocument } from "./print/PrintListDocument";
import { PrintDukDocument } from "./print/PrintDukDocument";
import {
  PrintCutiDocument,
  type CutiSisaSnapshot,
} from "./print/PrintCutiDocument";
import { PrintModelDkDocument } from "./print/PrintModelDkDocument";
import {
  PRINT_PAGE_CSS,
  densityFromRowCount,
} from "./print/printPageCss";
import { downloadElementAsA4Pdf } from "../lib/downloadA4Pdf";
import { downloadElementAsWordDoc } from "../lib/downloadPrintDoc";

type DownloadFormat = "pdf" | "doc";

type PrintType =
  | "absen_global"
  | "absen_bidang"
  | "tanda_terima"
  | "surat_cuti"
  | "model_dk"
  | "duk";
type SortAction = "default_kelas" | "abjad";
type MobileStep = 1 | 2 | 3;

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
    label: "Daftar hadir",
    title: "DAFTAR HADIR / ABSENSI PEGAWAI",
    desc: "Daftar hadir seluruh pegawai atau per unit kerja",
  },
  {
    category: "laporan",
    type: "tanda_terima",
    catalogKey: "tanda_terima",
    label: "Tanda terima",
    title: "DAFTAR TANDA TERIMA ......................",
    desc: "Lembar tanda terima atau serah terima",
  },
  {
    category: "laporan",
    type: "duk",
    catalogKey: "duk",
    label: "Daftar urut kepangkatan",
    title: "DAFTAR URUT KEPANGKATAN (DUK)",
    desc: "Diurutkan menurut golongan, jabatan, dan unit kerja",
  },
  {
    category: "layanan",
    type: "surat_cuti",
    catalogKey: "surat_cuti",
    label: "Surat cuti",
    title: "SURAT IZIN CUTI PEGAWAI",
    desc: "Formulir izin cuti per pegawai",
    needsEmployee: true,
  },
  {
    category: "layanan",
    type: "model_dk",
    catalogKey: "model_dk",
    label: "Surat tunjangan keluarga",
    title:
      "SURAT KETERANGAN UNTUK MENDAPATKAN PEMBAYARAN TUNJANGAN KELUARGA",
    desc: "Surat keterangan untuk pembayaran tunjangan keluarga",
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
    () =>
      api.peekSettings("all") ??
      api.peekSettings(["core", "logo", "kamus"]) ??
      null,
  );
  const [loading, setLoading] = useState(
    () =>
      !peekAllEmployeesLean() ||
      !(
        api.peekSettings("all") || api.peekSettings(["core", "logo", "kamus"])
      ),
  );
  const [cutiConfirmOpen, setCutiConfirmOpen] = useState(false);
  const [cutiBusy, setCutiBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  /** Format chosen when admin confirms cuti tahunan deduction. */
  const pendingDownloadFormat = useRef<DownloadFormat>("pdf");

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

  // Cleanup cuti snapshot if user leaves mid-flow
  useEffect(() => {
    return () => {
      printTimersRef.current.clearSnapshot?.();
      printTimersRef.current = {};
    };
  }, []);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Settings: prefer full cache from background warm, else fetch subset
        const warmSettings =
          api.peekSettings("all") ??
          api.peekSettings(["core", "logo", "kamus"]);
        const currentSettings =
          warmSettings ??
          (await api.getSettings(["core", "logo", "kamus"]));
        setSettings(currentSettings);

        // Roster only when Cetak opens (not at login)
        const warmList = peekAllEmployeesLean();
        const all = warmList ?? (await preloadAllEmployeesLean());
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
      // Form BKN menampilkan saldo SEBELUM potong (snapshot at confirm time)
      const prePrint: CutiSisaSnapshot = {
        n: String(sisaN),
        n1: String(sisaN1),
        n2: String(sisaN2),
      };

      // 1) Paint form with pre-deduction saldo, download first
      setCutiSisaPrint(prePrint);
      setCutiConfirmOpen(false);
      await new Promise((r) => setTimeout(r, 120));
      const downloaded = await runDownload(pendingDownloadFormat.current);
      if (!downloaded) {
        setCutiSisaPrint(null);
        return;
      }

      // 2) Network re-read balance after slow download (bypass cache — TOCTOU)
      const fresh = await api.getEmployee(cutiEmployeeId, { force: true });
      if (!fresh) {
        notify.error(
          "Berkas sudah diunduh, tetapi data pegawai tidak ditemukan",
          "Periksa sisa cuti di biodata.",
        );
        setCutiSisaPrint(null);
        return;
      }
      const fN = parseInt(String(fresh.sisaCutiN ?? "0"), 10) || 0;
      const fN1 = parseInt(String(fresh.sisaCutiN1 ?? "0"), 10) || 0;
      const fN2 = parseInt(String(fresh.sisaCutiN2 ?? "0"), 10) || 0;
      if (fN + fN1 + fN2 < cutiLamaHari) {
        notify.error(
          "Berkas sudah diunduh, tetapi sisa cuti tidak lagi mencukupi",
          "Saldo mungkin sudah dipotong di sesi lain. Periksa biodata.",
        );
        setCutiSisaPrint(null);
        return;
      }
      let toDeduct = cutiLamaHari;
      let newN = fN;
      let newN1 = fN1;
      let newN2 = fN2;
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

      try {
        await api.updateEmployee(fresh.id!, {
          sisaCutiN: String(newN),
          sisaCutiN1: String(newN1),
          sisaCutiN2: String(newN2),
        });
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === fresh.id
              ? {
                  ...e,
                  sisaCutiN: String(newN),
                  sisaCutiN1: String(newN1),
                  sisaCutiN2: String(newN2),
                }
              : e,
          ),
        );
        notify.success("Sisa cuti diperbarui");
      } catch (potongErr) {
        console.error(potongErr);
        notify.error(
          "Berkas sudah diunduh, tetapi gagal memotong sisa cuti",
          "Sesuaikan sisa cuti manual di biodata pegawai.",
        );
      }
      setCutiSisaPrint(null);
    } catch (err) {
      console.error(err);
      setCutiSisaPrint(null);
      notify.error(
        "Gagal proses cuti",
        err instanceof Error ? err.message : "Saldo cuti tidak diubah.",
      );
    } finally {
      setCutiBusy(false);
    }
  };

  const fieldLabel =
    "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

  const selectedEmpName = cutiEmployeeId
    ? employees.find((e) => e.id === cutiEmployeeId)?.nama || "Pegawai"
    : null;

  const downloadBaseName = useMemo(() => {
    const label = (activeDoc?.label || printType || "dokumen").replace(
      /\s+/g,
      "_",
    );
    const who =
      printCategory === "layanan" && selectedEmpName
        ? selectedEmpName.replace(/\s+/g, "_")
        : printType === "absen_bidang" && selectedBidang !== "Semua"
          ? selectedBidang.replace(/\s+/g, "_")
          : "HRD";
    const day = new Date().toISOString().slice(0, 10);
    return `${label}_${who}_${day}`;
  }, [
    activeDoc?.label,
    printType,
    printCategory,
    selectedEmpName,
    selectedBidang,
  ]);

  const isLandscapeDoc = printType === "duk";
  const printDensity = densityFromRowCount(sortedEmployees.length);
  const downloadBusy = pdfBusy || docBusy || cutiBusy;

  /** @returns true if file saved; false if failed (toast already shown). */
  const generatePdfDownload = async (): Promise<boolean> => {
    const el = printRef.current;
    if (!el) {
      notify.error("Pratinjau belum siap");
      return false;
    }
    setPdfBusy(true);
    try {
      const orientLabel = isLandscapeDoc ? "A4 mendatar" : "A4 tegak";
      notify.info(`Menyiapkan PDF ${orientLabel}…`);
      await downloadElementAsA4Pdf(el, `${downloadBaseName}.pdf`, {
        orientation: isLandscapeDoc ? "landscape" : "portrait",
        scale: sortedEmployees.length > 60 ? 1.5 : 2,
        marginMm: isLandscapeDoc ? 12 : 15,
      });
      notify.success("PDF diunduh", `${downloadBaseName}.pdf`);
      return true;
    } catch (err) {
      console.error(err);
      notify.error(
        "Gagal membuat PDF",
        err instanceof Error ? err.message : undefined,
      );
      return false;
    } finally {
      setPdfBusy(false);
    }
  };

  const generateDocDownload = async (): Promise<boolean> => {
    const el = printRef.current;
    if (!el) {
      notify.error("Pratinjau belum siap");
      return false;
    }
    setDocBusy(true);
    try {
      notify.info("Menyiapkan berkas Word…");
      downloadElementAsWordDoc(el, `${downloadBaseName}.doc`, {
        orientation: isLandscapeDoc ? "landscape" : "portrait",
        marginMm: isLandscapeDoc ? 12 : 15,
      });
      notify.success("Word diunduh", `${downloadBaseName}.doc`);
      return true;
    } catch (err) {
      console.error(err);
      notify.error(
        "Gagal membuat Word",
        err instanceof Error ? err.message : undefined,
      );
      return false;
    } finally {
      setDocBusy(false);
    }
  };

  const runDownload = async (format: DownloadFormat): Promise<boolean> => {
    if (format === "doc") return generateDocDownload();
    return generatePdfDownload();
  };

  const handleDownloadClick = async (format: DownloadFormat) => {
    if (!readiness.ready) {
      notify.error("Belum siap diunduh", readiness.reason || undefined);
      setMobileStep(2);
      return;
    }
    if (printType === "surat_cuti" && isCutiTahunan(cutiJenis)) {
      if (!canWrite) {
        await runDownload(format);
        return;
      }
      pendingDownloadFormat.current = format;
      setCutiConfirmOpen(true);
      return;
    }
    await runDownload(format);
  };

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
                        Saat konfirmasi, berkas diunduh dulu, lalu sisa cuti
                        dipotong (urutan N-2 → N-1 → N). Jika unduhan gagal,
                        saldo tidak diubah.
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
            description="Penyusunan dan unduh dokumen kepegawaian dalam format PDF ukuran A4."
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
                {readiness.ready ? "Siap diunduh" : "Belum lengkap"}
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
                A4 {isLandscapeDoc ? "mendatar" : "tegak"} · margin{" "}
                {isLandscapeDoc ? "12" : "15"} mm · {contextLine}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block truncate">
                {printSummaryLines.join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                onClick={() => void handleDownloadClick("doc")}
                disabled={!readiness.ready || loading || downloadBusy}
                className={btnSecondary}
                title={readiness.reason || "Unduh Word (.doc)"}
              >
                {docBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                Word
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadClick("pdf")}
                disabled={!readiness.ready || loading || downloadBusy}
                className={btnPrimary}
                title={readiness.reason || "Unduh PDF A4"}
              >
                {pdfBusy || cutiBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                PDF
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
              className={
                isLandscapeDoc
                  ? "bg-white border border-slate-200 print-container print-landscape print-sheet text-[11pt] w-[297mm] max-w-none shrink-0 print:max-w-full print:w-full mx-auto print:border-none shadow-sm print:shadow-none"
                  : "bg-white border border-slate-200 print-container print-sheet text-[12pt] w-[210mm] max-w-none shrink-0 print:max-w-full print:w-full mx-auto print:border-none shadow-sm print:shadow-none"
              }
              style={{
                minHeight: isLandscapeDoc ? "210mm" : "297mm",
                // Explicit padding = visible margin in preview & capture fallback
                padding: isLandscapeDoc ? "12mm" : "15mm",
                boxSizing: "border-box",
                fontFamily: "Arial, Helvetica, sans-serif",
                color: "#000000",
                backgroundColor: "#ffffff",
              }}
            >
          {/* MAIN DOCUMENT BODY — templates in src/pages/print/ */}
          {printType === "absen_global" ||
          printType === "absen_bidang" ||
          printType === "tanda_terima" ? (
            <PrintListDocument
              settings={settings}
              customTitle={customTitle}
              customSubtitle={customSubtitle}
              sortedEmployees={sortedEmployees}
              isTandaTerima={printType === "tanda_terima"}
              kadisTitle={kadisTitle}
              ttdName={ttdName}
              ttdPangkat={ttdPangkat}
              ttdNip={ttdNip}
              density={printDensity}
            />
          ) : printType === "duk" ? (
            <PrintDukDocument
              settings={settings}
              customTitle={customTitle}
              customSubtitle={customSubtitle}
              sortedEmployees={sortedEmployees}
              formatDateId={formatDateId}
              kadisTitle={kadisTitle}
              ttdName={ttdName}
              ttdPangkat={ttdPangkat}
              ttdNip={ttdNip}
              density={printDensity}
            />
          ) : printType === "surat_cuti" ? (
            <PrintCutiDocument
              employees={employees}
              cutiEmployeeId={cutiEmployeeId}
              cutiJenis={cutiJenis}
              cutiAlasan={cutiAlasan}
              cutiLamaHari={cutiLamaHari}
              cutiMulai={cutiMulai}
              cutiAkhir={cutiAkhir}
              cutiAlamat={cutiAlamat}
              cutiHp={cutiHp}
              cutiMasaKerja={cutiMasaKerja}
              cutiSisaPrint={cutiSisaPrint}
              getHierarchy={getHierarchy}
              formatDateId={formatDateId}
            />
          ) : printType === "model_dk" ? (
            <PrintModelDkDocument
              employees={employees}
              cutiEmployeeId={cutiEmployeeId}
              settings={settings}
              kadisTitle={kadisTitle}
              ttdName={ttdName}
              ttdNip={ttdNip}
              formatDateId={formatDateId}
              instansiNama={instansiNama}
              instansiAlamat={instansiAlamat}
            />
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
        title={
          pendingDownloadFormat.current === "doc"
            ? "Unduh Word lalu potong sisa cuti?"
            : "Unduh PDF lalu potong sisa cuti?"
        }
        description={
          <div className="space-y-2">
            <p>
              <strong>{selectedEmpName || "Pegawai"}</strong> ·{" "}
              {cutiLamaHari} hari kerja akan dipotong dari sisa cuti (urutan N-2
              → N-1 → N).
            </p>
            <p className="text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs">
              Berkas diunduh dulu, lalu sisa cuti dipotong. Jika unduhan gagal,
              saldo tidak diubah.
            </p>
            <p className="text-xs text-slate-500">
              Formulir menampilkan sisa cuti sebelum potong (sesuai format BKN).
            </p>
          </div>
        }
        confirmLabel={
          pendingDownloadFormat.current === "doc"
            ? "Ya, unduh Word & potong sisa"
            : "Ya, unduh PDF & potong sisa"
        }
        cancelLabel="Batal (saldo aman)"
        onConfirm={() => void runCutiDeductionAndPrint()}
      />

      <style dangerouslySetInnerHTML={{ __html: PRINT_PAGE_CSS }} />
    </motion.div>
  );
}
