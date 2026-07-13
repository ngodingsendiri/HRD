import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Employee, AppSettings } from "../types";
import { Modal } from "../components/Modal";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Download,
} from "lucide-react";
import { handleApiError, OperationType } from "../lib/error";
import { api, type BulkImportError } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  chip,
  easeOut,
  pageContainerVariants,
  pageItemVariants,
  pageShellWide,
  statusBadge,
} from "../lib/ui";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import {
  calculateBUP,
  checkKGBandKP,
  formatKPLabel,
  type KPStatus,
} from "../lib/employeeUtils";
import {
  buildDerivedReportRows,
  buildImportGuideAoa,
  buildImportTemplateAoa,
  buildReimportExportRows,
  parseEmployeeImportGrid,
} from "../lib/employeeImport";
import { useAuth } from "../lib/auth";
import { notify } from "../lib/notify";
import { ImportResultDialog } from "../components/ImportResultDialog";
import { TableSkeleton } from "../components/Skeleton";
import { cn } from "../lib/utils";

type AlertFilter = "all" | "any" | "kp" | "kgb" | "pensiun" | "nonip";

const STATUS_OPTIONS = [
  "all",
  "PNS",
  "CPNS",
  "PPPK",
  "PPPKPW",
  "Honorer",
  "Lainnya",
] as const;

const ALERT_CHIPS: { value: AlertFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "any", label: "Mendesak" },
  { value: "kp", label: "KP" },
  { value: "kgb", label: "KGB" },
  { value: "pensiun", label: "Pensiun" },
  { value: "nonip", label: "Tanpa NIP" },
];

function parseAlertParam(raw: string | null): AlertFilter {
  if (
    raw === "any" ||
    raw === "kp" ||
    raw === "kgb" ||
    raw === "pensiun" ||
    raw === "nonip"
  ) {
    return raw;
  }
  return "all";
}

function parseStatusParam(raw: string | null): string {
  if (!raw || raw === "all") return "all";
  return (STATUS_OPTIONS as readonly string[]).includes(raw) ? raw : "all";
}

function parsePageParam(raw: string | null): number {
  const p = parseInt(raw || "1", 10);
  return Number.isFinite(p) && p > 1 ? p - 1 : 0;
}

function golLabel(emp: Employee): string {
  return (
    (emp.pangkatGolongan || "").trim() ||
    [emp.pangkat, emp.gol].filter(Boolean).join(" / ") ||
    emp.gol ||
    "—"
  );
}

function KPBadge({ kind, status }: { kind: "KP" | "KGB"; status: KPStatus }) {
  if (!status.due && !status.overdue) return null;
  return (
    <span
      title={status.targetDate || kind}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-lg border whitespace-nowrap",
        status.overdue
          ? "bg-red-50 text-red-700 border-red-100"
          : "bg-amber-50 text-amber-700 border-amber-100",
      )}
    >
      <AlertTriangle className="w-2.5 h-2.5" />
      {formatKPLabel(kind, status)}
    </span>
  );
}

function PensiunBadge({ emp }: { emp: Employee }) {
  const bup = calculateBUP(
    emp.tanggalLahir || "",
    emp.jabatan || "",
    emp.bupTanggal,
  );
  if (!bup) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(bup);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days > 365) return null;
  const overdue = days < 0;
  return (
    <span
      title={bup}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-lg border whitespace-nowrap",
        overdue
          ? "bg-red-50 text-red-700 border-red-100"
          : "bg-amber-50 text-amber-700 border-amber-100",
      )}
    >
      <AlertTriangle className="w-2.5 h-2.5" />
      {overdue
        ? "Pensiun lewat*"
        : days === 0
          ? "Pensiun hari ini*"
          : `Pensiun H-${days}*`}
    </span>
  );
}

function isPensiunInWindow(emp: Employee): boolean {
  const bup = calculateBUP(
    emp.tanggalLahir || "",
    emp.jabatan || "",
    emp.bupTanggal,
  );
  if (!bup) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(bup);
  if (isNaN(d.getTime())) return false;
  d.setHours(0, 0, 0, 0);
  const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return days <= 365;
}

function AlertBadges({ emp }: { emp: Employee }) {
  const { kp, kgb } = checkKGBandKP(
    emp.tmtGolonganRuang,
    emp.tanggalBerkalaTerakhir,
    {
      tmtKerja: emp.tmtKerja,
      status: emp.status,
      gol: emp.gol,
      pangkatGolongan: emp.pangkatGolongan,
      tmtKp: emp.tmtKp,
    },
  );
  const hasKp = kp.due || kp.overdue;
  const hasKgb = kgb.due || kgb.overdue;
  const hasPens = isPensiunInWindow(emp);
  if (!hasKp && !hasKgb && !hasPens) return null;
  return (
    <div className="flex flex-wrap items-center gap-1" title="* Prediksi indikatif">
      <KPBadge kind="KP" status={kp} />
      <KPBadge kind="KGB" status={kgb} />
      <PensiunBadge emp={emp} />
    </div>
  );
}

export default function Employees() {
  useDocumentTitle("Pegawai");
  const { canWrite } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const moreRef = useRef<HTMLDivElement>(null);
  const [rawEmployees, setRawEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [bidangOptions, setBidangOptions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState(() =>
    parseStatusParam(searchParams.get("status")),
  );
  const [alertFilter, setAlertFilter] = useState<AlertFilter>(() =>
    parseAlertParam(searchParams.get("alert")),
  );
  const [bidangFilter, setBidangFilter] = useState(
    () => searchParams.get("bidang") || "all",
  );
  const [loading, setLoading] = useState(true); // flipped false when list cache is warm
  /** Soft refresh after first paint (filter/page change) — keep chrome, dim table. */
  const [listRefreshing, setListRefreshing] = useState(false);
  /** True after at least one list response — gates page clamp (avoid wiping ?page=N). */
  const [listSettled, setListSettled] = useState(false);
  const listSettledRef = useRef(false);
  const [listError, setListError] = useState<string | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [page, setPage] = useState(() =>
    parsePageParam(searchParams.get("page")),
  );
  const [total, setTotal] = useState(0);
  const [debouncedQ, setDebouncedQ] = useState(searchTerm);
  const [moreOpen, setMoreOpen] = useState(false);
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isExportingSelected, setIsExportingSelected] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    errors: number;
    skipped: number;
    errorDetails: BulkImportError[];
    warnings?: { row: number; nip?: string; nama?: string; message: string }[];
    dryRun?: boolean;
    mode?: "patch" | "replace";
  } | null>(null);
  const [importMode, setImportMode] = useState<"patch" | "replace">("patch");
  const [pendingImportRows, setPendingImportRows] = useState<
    Record<string, unknown>[] | null
  >(null);
  const [importApplying, setImportApplying] = useState(false);

  const employees = rawEmployees;
  /**
   * Track last filter key so we only reset page when filters *change*.
   * Safer than a boolean flag under React Strict Mode (effects run twice).
   */
  const prevFilterKeyRef = useRef<string | null>(null);
  /** After inbound URL hydrate, don't wipe page that came with the new query. */
  const skipNextFilterPageReset = useRef(false);
  /** Ignore our own URL writes when hydrating from searchParams. */
  const suppressUrlHydrate = useRef(false);

  const filterKey = `${debouncedQ}\0${statusFilter}\0${alertFilter}\0${bidangFilter}\0${rowsPerPage}`;

  const listParams = useMemo(
    () => ({
      q: debouncedQ || undefined,
      status: statusFilter,
      bidang: bidangFilter === "all" ? undefined : bidangFilter,
      alert: (alertFilter === "all" ? undefined : alertFilter) as
        | "any"
        | "kp"
        | "kgb"
        | "pensiun"
        | "nonip"
        | undefined,
      limit: rowsPerPage,
      offset: page * rowsPerPage,
      lean: true as const,
    }),
    [debouncedQ, statusFilter, bidangFilter, alertFilter, rowsPerPage, page],
  );

  const desiredSearch = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ) sp.set("q", debouncedQ);
    if (statusFilter !== "all") sp.set("status", statusFilter);
    if (alertFilter !== "all") sp.set("alert", alertFilter);
    if (bidangFilter !== "all") sp.set("bidang", bidangFilter);
    if (page > 0) sp.set("page", String(page + 1));
    return sp.toString();
  }, [debouncedQ, statusFilter, alertFilter, bidangFilter, page]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchTerm), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset page + selection when filters change — not on first mount / URL hydrate
  useEffect(() => {
    if (prevFilterKeyRef.current === null) {
      prevFilterKeyRef.current = filterKey;
      return;
    }
    if (prevFilterKeyRef.current === filterKey) return;
    prevFilterKeyRef.current = filterKey;
    if (skipNextFilterPageReset.current) {
      skipNextFilterPageReset.current = false;
      setSelectedIds(new Set());
      return;
    }
    setPage(0);
    setSelectedIds(new Set());
  }, [filterKey]);

  // Page-scoped selection: changing page clears picks (matches “halaman ini”)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  // After delete / filter shrink: don't stay on an empty page.
  // Wait until listSettled — initial total=0 must not wipe ?page=N before fetch.
  useEffect(() => {
    if (!listSettled) return;
    if (total <= 0) {
      if (page !== 0) setPage(0);
      return;
    }
    const maxPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [listSettled, total, rowsPerPage, page]);

  // State → URL only when *our* filters change (do NOT depend on searchParams,
  // or back/forward would be immediately overwritten by stale state).
  useEffect(() => {
    const current = searchParams.toString();
    if (desiredSearch === current) return;
    suppressUrlHydrate.current = true;
    setSearchParams(new URLSearchParams(desiredSearch), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only push when desiredSearch changes
  }, [desiredSearch, setSearchParams]);

  // Inbound URL → state (back/forward, Dashboard Link while already on /employees)
  useEffect(() => {
    // Skip the searchParams update that we just wrote ourselves
    if (suppressUrlHydrate.current) {
      suppressUrlHydrate.current = false;
      return;
    }
    const q = searchParams.get("q") || "";
    const status = parseStatusParam(searchParams.get("status"));
    const alert = parseAlertParam(searchParams.get("alert"));
    const bidang = searchParams.get("bidang") || "all";
    const nextPage = parsePageParam(searchParams.get("page"));

    const filterChanging =
      q !== debouncedQ ||
      status !== statusFilter ||
      alert !== alertFilter ||
      bidang !== bidangFilter;

    if (filterChanging) {
      // Preserve page from this URL (don't let filter-reset effect force page 0)
      skipNextFilterPageReset.current = true;
    }

    if (q !== searchTerm) setSearchTerm(q);
    if (q !== debouncedQ) setDebouncedQ(q);
    if (status !== statusFilter) setStatusFilter(status);
    if (alert !== alertFilter) setAlertFilter(alert);
    if (bidang !== bidangFilter) setBidangFilter(bidang);
    if (nextPage !== page) setPage(nextPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate: hydrate from searchParams only
  }, [searchParams]);

  const refreshList = async () => {
    const res = await api.getEmployeesPage(listParams);
    setRawEmployees(res.data);
    setTotal(res.total);
  };

  /** Never edit/detail from lean list rows — would wipe empty fields on save. */
  const openDetail = async (id: string) => {
    try {
      const full = await api.getEmployee(id);
      if (!full) {
        notify.error("Data tidak ditemukan");
        return;
      }
      setDetailEmp(full);
    } catch (e) {
      notify.error(
        "Gagal memuat detail",
        handleApiError(e, OperationType.GET, `/api/employees/${id}`).message,
      );
    }
  };

  const openEdit = (id?: string) => {
    if (!id) {
      navigate("/employees/new");
      return;
    }
    navigate(`/employees/${id}/edit`);
  };

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    let cancelled = false;
    // kamus for form lookup + peta for bezetting export
    api.getSettings(["peta", "kamus"]).then((d) => {
      if (!cancelled) setSettings(d);
    });
    api.getEmployeeBidangOptions().then((list) => {
      if (!cancelled) setBidangOptions(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setListError(null);
        const warm = api.peekEmployeesPage(listParams);
        if (warm) {
          setRawEmployees(warm.data);
          setTotal(warm.total);
          listSettledRef.current = true;
          setListSettled(true);
          setLoading(false);
          setListRefreshing(false);
        } else if (!listSettledRef.current) {
          // Full-page skeleton only before first successful paint
          setLoading(true);
        } else {
          // Keep filters/chips visible; dim table until network returns
          setListRefreshing(true);
        }
        const res = await api.getEmployeesPage(listParams);
        if (cancelled) return;
        setRawEmployees(res.data);
        setTotal(res.total);
        listSettledRef.current = true;
        setListSettled(true);
      } catch (e) {
        const err = handleApiError(e, OperationType.LIST, "/api/employees");
        if (!cancelled) {
          setListError(err.message);
          listSettledRef.current = true;
          setListSettled(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setListRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listParams]);

  const displayedEmployees = employees;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteEmployee(employeeToDelete);
      setIsDeleteModalOpen(false);
      setEmployeeToDelete(null);
      await refreshList();
      notify.success("Data dihapus");
    } catch (e) {
      notify.error("Gagal menghapus");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsDeletingBulk(true);
    try {
      await api.deleteEmployees(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
      await refreshList();
      notify.success("Data terpilih dihapus");
    } catch {
      notify.error("Gagal hapus massal");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const writeEmployeeWorkbook = async (
    rows: Employee[],
    filename: string,
  ) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(buildReimportExportRows(rows)),
      "Data_Pegawai",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(buildDerivedReportRows(rows)),
      "Dihitung_Sistem",
    );
    XLSX.writeFile(wb, filename);
  };

  const handleExport = async (scope: "all" | "filtered" = "all") => {
    try {
      notify.info(
        scope === "filtered"
          ? "Menyiapkan ekspor (filter aktif)…"
          : "Menyiapkan ekspor…",
      );
      // API max 500 — loop pages
      const all: Employee[] = [];
      let offset = 0;
      const pageSize = 500;
      const base =
        scope === "filtered"
          ? {
              q: debouncedQ || undefined,
              status: statusFilter,
              bidang: bidangFilter === "all" ? undefined : bidangFilter,
              alert:
                alertFilter === "all"
                  ? undefined
                  : (alertFilter as
                      | "any"
                      | "kp"
                      | "kgb"
                      | "pensiun"
                      | "nonip"),
            }
          : {};
      for (;;) {
        const res = await api.getEmployeesPage({
          ...base,
          limit: pageSize,
          offset,
          lean: false,
        });
        all.push(...res.data);
        offset += res.data.length;
        if (offset >= res.total || res.data.length === 0) break;
      }
      const name =
        scope === "filtered"
          ? "Data_Pegawai_Filter.xlsx"
          : "Data_Pegawai_HRD_ASN.xlsx";
      await writeEmployeeWorkbook(all, name);
      notify.success(
        scope === "filtered" ? "Ekspor filter selesai" : "Ekspor selesai",
        `${all.length} baris`,
      );
    } catch {
      notify.error("Ekspor gagal");
    }
    setMoreOpen(false);
  };

  const handleExportSelected = async () => {
    if (!selectedIds.size) return;
    setIsExportingSelected(true);
    try {
      notify.info("Menyiapkan ekspor terpilih…");
      const ids = Array.from(selectedIds);
      // Full records (not lean) so re-import columns are complete
      const results = await Promise.all(ids.map((id) => api.getEmployee(id)));
      const full = results.filter((e): e is Employee => !!e);
      if (!full.length) {
        notify.error("Tidak ada data terpilih yang bisa diekspor");
        return;
      }
      await writeEmployeeWorkbook(
        full,
        `Data_Pegawai_Terpilih_${full.length}.xlsx`,
      );
      notify.success("Ekspor terpilih selesai", `${full.length} baris`);
    } catch {
      notify.error("Ekspor terpilih gagal");
    } finally {
      setIsExportingSelected(false);
    }
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setAlertFilter("all");
    setBidangFilter("all");
    setSearchTerm("");
  };

  const hasActiveFilters =
    statusFilter !== "all" ||
    alertFilter !== "all" ||
    bidangFilter !== "all" ||
    !!debouncedQ;

  const handleExportBezetting = async () => {
    const XLSX = await import("xlsx");
    type G = {
      bidang: string;
      jabatan: string;
      kelasJabatan: string;
      kebutuhan: number;
      pns: number;
      cpns: number;
      pppk: number;
      pppkpw: number;
    };
    const petaMap: {
      bidang: string;
      jabatan: string;
      kelas: string;
      kebutuhan: number;
    }[] = [];
    const csvData = settings?.petaJabatanCsv || "";
    if (csvData) {
      let first = true;
      for (const row of csvData.split("\n")) {
        if (!row?.trim()) continue;
        const cols = row.split(/;|\t/);
        if (first && cols[1]?.toLowerCase().includes("bidang")) {
          first = false;
          continue;
        }
        first = false;
        if (cols.length >= 2) {
          petaMap.push({
            bidang: cols[1]?.trim() || "",
            jabatan: cols[2]?.trim() || "",
            kelas: cols[3]?.trim() || "",
            kebutuhan: Number(cols[4]?.trim()) || 0,
          });
        }
      }
    }
    const grouped = new Map<string, G>();
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
    // Load all pages for bezetting aggregate
    const all: Employee[] = [];
    let offset = 0;
    for (;;) {
      const res = await api.getEmployeesPage({
        limit: 500,
        offset,
        lean: true,
      });
      all.push(...res.data);
      offset += res.data.length;
      if (offset >= res.total || res.data.length === 0) break;
    }
    all.forEach((emp) => {
      if (!emp.bidang || !emp.jabatan) return;
      const key = `${emp.bidang.trim().toLowerCase()}|${emp.jabatan.trim().toLowerCase()}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          bidang: emp.bidang,
          jabatan: emp.jabatan,
          kelasJabatan: emp.kelasJabatan || "",
          kebutuhan: 0,
          pns: 0,
          cpns: 0,
          pppk: 0,
          pppkpw: 0,
        });
      }
      const g = grouped.get(key)!;
      if (emp.status === "PNS") g.pns++;
      else if (emp.status === "CPNS") g.cpns++;
      else if (emp.status === "PPPK") g.pppk++;
      else if (emp.status === "PPPKPW") g.pppkpw++;
    });
    const exportData = Array.from(grouped.values())
      .sort((a, b) => a.bidang.localeCompare(b.bidang))
      .map((g, i) => ({
        No: i + 1,
        Bidang: g.bidang,
        Jabatan: g.jabatan,
        "Kelas Jabatan": g.kelasJabatan,
        Kebutuhan: g.kebutuhan,
        PNS: g.pns || "",
        CPNS: g.cpns || "",
        PPPK: g.pppk || "",
        "PPPK PW": g.pppkpw || "",
        Selisih: g.pns + g.cpns + g.pppk + g.pppkpw - g.kebutuhan,
      }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(exportData),
      "Bezetting",
    );
    XLSX.writeFile(wb, "Data_Bezetting_Pegawai.xlsx");
    notify.success("Ekspor bezetting selesai");
    setMoreOpen(false);
  };

  const handleDownloadTemplate = async (variant: "core" | "full" = "full") => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const aoa = buildImportTemplateAoa(variant);
    const dataSheet = XLSX.utils.aoa_to_sheet(aoa);
    dataSheet["!cols"] = aoa[0]!.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, dataSheet, "Data_Import");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(buildImportGuideAoa(variant)),
      "Petunjuk",
    );
    const name =
      variant === "core"
        ? "Template_Import_Pegawai_RINGKAS.xlsx"
        : "Template_Import_Pegawai_LENGKAP.xlsx";
    XLSX.writeFile(wb, name);
    notify.success(
      variant === "core" ? "Template ringkas diunduh" : "Template lengkap diunduh",
    );
    setMoreOpen(false);
  };

  const runBulkImport = async (
    payload: Record<string, unknown>[],
    opts: { dryRun: boolean; mode: "patch" | "replace"; skipped: number },
  ) => {
    let created = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: BulkImportError[] = [];
    const warnings: {
      row: number;
      nip?: string;
      nama?: string;
      message: string;
    }[] = [];
    const CHUNK = 100;
    for (let i = 0; i < payload.length; i += CHUNK) {
      const slice = payload.slice(i, i + CHUNK);
      const result = await api.bulkUpsert(slice, {
        mode: opts.mode,
        dryRun: opts.dryRun,
      });
      created += result.created;
      updated += result.updated;
      errors += result.errors;
      if (result.errorDetails) {
        errorDetails.push(
          ...result.errorDetails.map((e) => ({
            ...e,
            row: e.row + i,
          })),
        );
      }
      if (result.warnings) {
        warnings.push(
          ...result.warnings.map((w) => ({
            ...w,
            row: w.row + i,
          })),
        );
      }
    }
    setImportResult({
      created,
      updated,
      errors,
      skipped: opts.skipped,
      errorDetails: errorDetails.slice(0, 50),
      warnings: warnings.slice(0, 50),
      dryRun: opts.dryRun,
      mode: opts.mode,
    });
    if (!opts.dryRun) {
      setPendingImportRows(null);
      await refreshList();
      if (errors > 0) {
        notify.warning(
          "Impor selesai dengan penolakan",
          `${created} baru, ${updated} diperbarui, ${errors} ditolak`,
        );
      } else {
        notify.success(
          "Impor selesai",
          `${created} baru, ${updated} diperbarui`,
        );
      }
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        notify.info("Memeriksa file impor…");
        const XLSX = await import("xlsx");
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const preferred =
          wb.SheetNames.find((n) => /data[_\s-]?(import|pegawai)/i.test(n)) ||
          wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[preferred!], {
          header: 1,
        }) as unknown[][];
        if (!rows.length) throw new Error("File Excel kosong.");
        const { payload, skipped } = parseEmployeeImportGrid(rows);
        if (!payload.length) {
          throw new Error(
            "Tidak ada baris valid. Cek sheet Petunjuk di template.",
          );
        }
        setPendingImportRows(payload);
        // Dry-run first — operator confirms before write
        await runBulkImport(payload, {
          dryRun: true,
          mode: importMode,
          skipped,
        });
      } catch (err) {
        notify.error(
          "Impor gagal",
          err instanceof Error ? err.message : "Format file tidak dikenali.",
        );
        setPendingImportRows(null);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (!pendingImportRows?.length || !importResult) return;
    setImportApplying(true);
    try {
      await runBulkImport(pendingImportRows, {
        dryRun: false,
        mode: importResult.mode || importMode,
        skipped: importResult.skipped,
      });
    } catch (err) {
      notify.error(
        "Gagal menerapkan impor",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setImportApplying(false);
    }
  };

  const statusOptions = STATUS_OPTIONS;

  if (loading) {
    return (
      <div className={pageShellWide}>
        <PageSkeletonHeader />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageContainerVariants}
      className={pageShellWide}
    >
      <motion.div variants={pageItemVariants}>
        <PageHeader
          title="Pegawai"
          description="Cari, kelola, dan impor data kepegawaian."
          actions={
            <>
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  className={btnSecondary}
                  aria-expanded={moreOpen}
                >
                  <MoreHorizontal className="w-4 h-4" />
                  Lainnya
                </button>
                <AnimatePresence>
                  {moreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={easeOut}
                      className="absolute right-0 mt-1 z-40 w-52 bg-white border border-slate-200 rounded-xl p-1 shadow-sm"
                      role="menu"
                    >
                      {canWrite && (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50"
                            onClick={() => {
                              setMoreOpen(false);
                              void handleDownloadTemplate("core");
                            }}
                          >
                            Template ringkas
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50"
                            onClick={() => {
                              setMoreOpen(false);
                              void handleDownloadTemplate("full");
                            }}
                          >
                            Template lengkap
                          </button>
                          <div className="px-3 py-2 border-t border-slate-100 mt-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                              Mode impor
                            </p>
                            <select
                              className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5 bg-white"
                              value={importMode}
                              onChange={(e) =>
                                setImportMode(
                                  e.target.value === "replace"
                                    ? "replace"
                                    : "patch",
                                )
                              }
                            >
                              <option value="patch">
                                Patch — sel kosong aman
                              </option>
                              <option value="replace">
                                Ganti penuh — sel kosong menghapus
                              </option>
                            </select>
                          </div>
                          <label className="w-full block px-3 py-2 text-sm rounded-lg hover:bg-slate-50 cursor-pointer">
                            Impor Excel (pratinjau dulu)
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              className="hidden"
                              onChange={(e) => {
                                setMoreOpen(false);
                                void handleImport(e);
                              }}
                            />
                          </label>
                        </>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50"
                        onClick={() => {
                          setMoreOpen(false);
                          void handleExport("all");
                        }}
                      >
                        Ekspor semua
                      </button>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50"
                          onClick={() => {
                            setMoreOpen(false);
                            void handleExport("filtered");
                          }}
                        >
                          Ekspor hasil filter
                        </button>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50"
                        onClick={() => {
                          setMoreOpen(false);
                          void handleExportBezetting();
                        }}
                      >
                        Ekspor bezetting
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {canWrite && (
                <Link
                  to="/employees/new"
                  className={`${btnPrimary} w-full sm:w-auto`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah
                </Link>
              )}
            </>
          }
        />
      </motion.div>

      {listError && (
        <div className="p-4 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {listError}
          </span>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setLoading(true);
              refreshList()
                .then(() => setListError(null))
                .catch(() => {})
                .finally(() => setLoading(false));
            }}
          >
            Coba lagi
          </button>
        </div>
      )}

      {canWrite && importMode === "replace" && (
        <motion.div
          variants={pageItemVariants}
          className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start gap-2"
          role="status"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Mode impor: ganti penuh</p>
            <p className="mt-0.5 text-amber-800/90">
              Sel kosong di Excel akan mengosongkan data di sistem. Ganti ke
              mode Patch di menu Lainnya bila hanya ingin mengisi celah.
            </p>
          </div>
        </motion.div>
      )}

      <motion.div variants={pageItemVariants} className="space-y-3">
        {/* Alert chips — shareable via URL (Dashboard deep-link) */}
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter peringatan"
        >
          {ALERT_CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={chip(alertFilter === c.value)}
              onClick={() => setAlertFilter(c.value)}
              aria-pressed={alertFilter === c.value}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Compact toolbar */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama, NIP, NIK, jabatan…"
              className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 max-w-[140px]"
              aria-label="Filter status"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "Semua status" : s}
                </option>
              ))}
            </select>
            <select
              value={bidangFilter}
              onChange={(e) => setBidangFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 max-w-[180px]"
              aria-label="Filter bidang"
            >
              <option value="all">Semua bidang</option>
              {bidangFilter !== "all" &&
                !bidangOptions.includes(bidangFilter) && (
                  <option value={bidangFilter}>{bidangFilter}</option>
                )}
              {bidangOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700"
              aria-label="Baris per halaman"
            >
              {[25, 50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>
                  {n}/hal
                </option>
              ))}
            </select>
          </div>
        </div>

        {alertFilter !== "all" && (
          <p className="text-[11px] text-slate-400">
            {alertFilter === "any"
              ? "Mendesak = KP/KGB ≤90 hari + pensiun ≤365 hari · diurutkan terdekat dulu*."
              : alertFilter === "kp" ||
                  alertFilter === "kgb" ||
                  alertFilter === "pensiun"
                ? "Diurutkan mendesak dulu (prediksi indikatif)."
                : "Pegawai tanpa NIP (digit kosong)."}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <p>
            Menampilkan {displayedEmployees.length ? page * rowsPerPage + 1 : 0}
            –
            {page * rowsPerPage + displayedEmployees.length} dari {total} data
            {listRefreshing && (
              <span className="ml-2 inline-flex items-center gap-1 text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Memuat…
              </span>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                className="ml-2 text-slate-700 font-semibold underline-offset-2 hover:underline"
                onClick={resetFilters}
              >
                Reset filter
              </button>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={page <= 0 || loading || listRefreshing}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Sebelumnya
            </button>
            <span className="tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              className={btnSecondary}
              disabled={page + 1 >= totalPages || loading || listRefreshing}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya
            </button>
          </div>
        </div>

        {!loading && total === 0 && !hasActiveFilters ? (
          <div className={`${card} py-6`}>
            <EmptyState
              title="Belum ada data pegawai"
              description="Mulai dengan mengunduh template, mengisi data, lalu impor — atau tambah manual."
            />
            {canWrite && (
              <div className="flex flex-wrap justify-center gap-2 pb-6">
                <button
                  type="button"
                  onClick={() => void handleDownloadTemplate("core")}
                  className={btnSecondary}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Template ringkas
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadTemplate("full")}
                  className={btnSecondary}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Template lengkap
                </button>
                <label className={`${btnSecondary} cursor-pointer`}>
                  <Upload className="w-4 h-4" />
                  Impor Excel (pratinjau)
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleImport}
                  />
                </label>
                <Link to="/employees/new" className={btnPrimary}>
                  <Plus className="w-4 h-4" />
                  Tambah manual
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div
            className={cn(
              `${card} overflow-hidden flex flex-col max-h-[min(640px,70vh)] transition-opacity`,
              listRefreshing && "opacity-60",
            )}
            aria-busy={listRefreshing}
          >
            {/* Desktop lean table */}
            <div className="hidden md:block flex-1 overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
                  <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-3 py-3 w-10 sticky left-0 z-[12] bg-slate-50">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        title="Pilih semua di halaman ini"
                        aria-label="Pilih semua di halaman ini"
                        checked={
                          displayedEmployees.length > 0 &&
                          displayedEmployees.every(
                            (e) => e.id && selectedIds.has(e.id),
                          )
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(
                              new Set(
                                displayedEmployees
                                  .map((x) => x.id)
                                  .filter(Boolean) as string[],
                              ),
                            );
                          } else setSelectedIds(new Set());
                        }}
                      />
                    </th>
                    <th className="px-3 py-3 sticky left-10 z-[11] bg-slate-50 min-w-[140px]">
                      Nama
                    </th>
                    <th className="px-3 py-3">NIP</th>
                    <th className="px-3 py-3">Gol</th>
                    <th className="px-3 py-3">Kelas</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Jabatan</th>
                    <th className="px-3 py-3">Bidang</th>
                    <th className="px-3 py-3">Peringatan</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="group border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => emp.id && void openDetail(emp.id)}
                    >
                      <td
                        className="px-3 py-2.5 sticky left-0 z-[2] bg-white group-hover:bg-slate-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={!!emp.id && selectedIds.has(emp.id)}
                          onChange={() => {
                            if (!emp.id) return;
                            const n = new Set(selectedIds);
                            if (n.has(emp.id)) n.delete(emp.id);
                            else n.add(emp.id);
                            setSelectedIds(n);
                          }}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900 sticky left-10 z-[1] bg-white group-hover:bg-slate-50">
                        <button
                          type="button"
                          className="text-left hover:underline focus:underline focus:outline-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (emp.id) void openDetail(emp.id);
                          }}
                        >
                          {emp.nama || "—"}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 tabular-nums text-xs">
                        {emp.nip || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 text-xs max-w-[100px] truncate">
                        {golLabel(emp)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 tabular-nums text-xs">
                        {emp.kelasJabatan || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={statusBadge(emp.status)}>
                          {emp.status || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 max-w-[160px] truncate">
                        {emp.jabatan || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[110px] truncate">
                        {emp.bidang || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <AlertBadges emp={emp} />
                      </td>
                      <td
                        className="px-3 py-2.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                            title="Detail"
                            onClick={() => void openDetail(emp.id!)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canWrite && (
                            <>
                              <button
                                type="button"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                                title="Edit"
                                onClick={() => void openEdit(emp.id)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                                title="Hapus"
                                onClick={() => {
                                  setEmployeeToDelete(emp.id!);
                                  setIsDeleteModalOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {displayedEmployees.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8">
                        <EmptyState
                          title="Tidak ada yang cocok"
                          description="Ubah kata kunci atau filter status/bidang/peringatan."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50">
              {displayedEmployees.length > 0 && (
                <p className="text-[11px] text-slate-400 px-0.5">
                  Centang = pilih di halaman ini saja (bukan seluruh filter).
                </p>
              )}
              {displayedEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className={`${card} overflow-hidden cursor-pointer`}
                  onClick={() => emp.id && void openDetail(emp.id)}
                >
                  <div className="p-3 border-b border-slate-100">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0 flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 mt-1 shrink-0"
                          checked={!!emp.id && selectedIds.has(emp.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => {
                            if (!emp.id) return;
                            const n = new Set(selectedIds);
                            if (n.has(emp.id)) n.delete(emp.id);
                            else n.add(emp.id);
                            setSelectedIds(n);
                          }}
                          aria-label={`Pilih ${emp.nama || "pegawai"}`}
                        />
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {emp.nama || "—"}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {emp.nip ? `NIP ${emp.nip}` : "Tanpa NIP"}
                            {emp.kelasJabatan
                              ? ` · Kelas ${emp.kelasJabatan}`
                              : ""}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {golLabel(emp)}
                          </p>
                          <div className="mt-1">
                            <AlertBadges emp={emp} />
                          </div>
                        </div>
                      </div>
                      <span className={`${statusBadge(emp.status)} shrink-0`}>
                        {emp.status || "—"}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-slate-400 font-semibold mb-0.5">
                        Jabatan
                      </div>
                      <div className="text-slate-800 font-medium">
                        {emp.jabatan || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold mb-0.5">
                        Bidang
                      </div>
                      <div className="text-slate-800 font-medium">
                        {emp.bidang || "—"}
                      </div>
                    </div>
                  </div>
                  <div
                    className="p-2 border-t border-slate-100 flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={`${btnSecondary} flex-1`}
                      onClick={() => void openDetail(emp.id!)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Detail
                    </button>
                    {canWrite && (
                      <>
                        <button
                          type="button"
                          className={`${btnSecondary} flex-1`}
                          onClick={() => void openEdit(emp.id)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="flex-1 inline-flex justify-center items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg"
                          onClick={() => {
                            setEmployeeToDelete(emp.id!);
                            setIsDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {displayedEmployees.length === 0 && (
                <EmptyState
                  title="Tidak ada yang cocok"
                  description="Ubah kata kunci atau filter."
                />
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Bottom pagination */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pb-16 lg:pb-0">
          <p className="tabular-nums">
            Halaman {page + 1} / {totalPages} · {total} data
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={page <= 0 || loading || listRefreshing}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Sebelumnya
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={page + 1 >= totalPages || loading || listRefreshing}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}

      {/* Bulk selection bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={easeOut}
            className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm max-w-[min(96vw,36rem)]"
          >
            <span className="text-sm font-semibold text-slate-800 tabular-nums">
              {selectedIds.size} dipilih
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              (halaman ini)
            </span>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setSelectedIds(new Set())}
            >
              Batal
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={isExportingSelected}
              onClick={() => void handleExportSelected()}
            >
              {isExportingSelected ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Ekspor
            </button>
            {canWrite && (
              <button
                type="button"
                className={btnDanger}
                onClick={() => setIsBulkDeleteModalOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        isOpen={!!detailEmp}
        onClose={() => setDetailEmp(null)}
        title="Detail pegawai"
        size="lg"
      >
        {detailEmp && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={statusBadge(detailEmp.status)}>
                {detailEmp.status}
              </span>
              <AlertBadges emp={detailEmp} />
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(() => {
                const { kp, kgb } = checkKGBandKP(
                  detailEmp.tmtGolonganRuang,
                  detailEmp.tanggalBerkalaTerakhir,
                  {
                    tmtKerja: detailEmp.tmtKerja,
                    status: detailEmp.status,
                    gol: detailEmp.gol,
                    pangkatGolongan: detailEmp.pangkatGolongan,
                    tmtKp: detailEmp.tmtKp,
                  },
                );
                const bup =
                  calculateBUP(
                    detailEmp.tanggalLahir || "",
                    detailEmp.jabatan || "",
                    detailEmp.bupTanggal,
                  ) || "";
                return (
                  [
                    ["Nama", detailEmp.nama],
                    ["NIP", detailEmp.nip],
                    ["NIK", detailEmp.nik],
                    ["Jabatan", detailEmp.jabatan],
                    ["Bidang", detailEmp.bidang],
                    ["Pangkat/Gol", detailEmp.pangkatGolongan || detailEmp.gol],
                    ["TMT Kerja", detailEmp.tmtKerja],
                    ["TMT Golongan", detailEmp.tmtGolonganRuang],
                    ["Berkala terakhir", detailEmp.tanggalBerkalaTerakhir],
                    ["TMT KP manual", detailEmp.tmtKp],
                    ["BUP manual", detailEmp.bupTanggal],
                    ["Pensiun (indikatif)*", bup],
                    ["Prediksi KP (indikatif)*", kp.targetDate || ""],
                    ["Prediksi KGB (indikatif)*", kgb.targetDate || ""],
                    ["No. HP", detailEmp.nomorHp],
                    ["Masa kerja", detailEmp.masaKerja],
                    ["Kelas jabatan", detailEmp.kelasJabatan],
                  ] as [string, string | undefined][]
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="border border-slate-100 rounded-lg p-3"
                  >
                    <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      {k}
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {v || "—"}
                    </dd>
                  </div>
                ));
              })()}
            </dl>
            <p className="text-[11px] text-slate-400">
              * Prediksi indikatif (bukan penetapan legal), kecuali tanggal
              manual diisi.
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {detailEmp.id && (
                <>
                  <Link
                    to={`/print?doc=surat_cuti&id=${encodeURIComponent(detailEmp.id)}`}
                    className={btnSecondary}
                    onClick={() => setDetailEmp(null)}
                  >
                    Cetak cuti
                  </Link>
                  <Link
                    to={`/print?doc=model_dk&id=${encodeURIComponent(detailEmp.id)}`}
                    className={btnSecondary}
                    onClick={() => setDetailEmp(null)}
                  >
                    Cetak Model DK
                  </Link>
                </>
              )}
              {canWrite && (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    const id = detailEmp.id;
                    setDetailEmp(null);
                    if (id) void openEdit(id);
                  }}
                >
                  <Edit2 className="w-4 h-4" />
                  Edit data
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Hapus pegawai?"
        size="md"
      >
        <p className="text-sm text-slate-600 mb-6">
          Data akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className={btnSecondary}
            disabled={isDeleting}
            onClick={() => setIsDeleteModalOpen(false)}
          >
            Batal
          </button>
          <button
            type="button"
            className={btnDanger}
            disabled={isDeleting}
            onClick={confirmDelete}
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Ya, hapus
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title="Hapus data terpilih?"
        size="md"
      >
        <p className="text-sm text-slate-600 mb-6">
          {selectedIds.size} data akan dihapus permanen.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className={btnSecondary}
            disabled={isDeletingBulk}
            onClick={() => setIsBulkDeleteModalOpen(false)}
          >
            Batal
          </button>
          <button
            type="button"
            className={btnDanger}
            disabled={isDeletingBulk}
            onClick={handleBulkDelete}
          >
            {isDeletingBulk ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            Hapus {selectedIds.size} data
          </button>
        </div>
      </Modal>

      <ImportResultDialog
        open={!!importResult}
        onClose={() => {
          if (importApplying) return;
          setImportResult(null);
          setPendingImportRows(null);
        }}
        created={importResult?.created ?? 0}
        updated={importResult?.updated ?? 0}
        errors={importResult?.errors ?? 0}
        skipped={importResult?.skipped}
        errorDetails={importResult?.errorDetails}
        warnings={importResult?.warnings}
        dryRun={importResult?.dryRun}
        mode={importResult?.mode || importMode}
        applying={importApplying}
        onConfirmApply={() => void handleConfirmImport()}
      />
    </motion.div>
  );
}

function PageSkeletonHeader() {
  return (
    <div className="space-y-2 border-b border-slate-200 pb-6 mb-6">
      <div className="h-7 w-40 bg-slate-100 rounded-lg animate-pulse" />
      <div className="h-4 w-72 max-w-full bg-slate-100 rounded-lg animate-pulse" />
    </div>
  );
}
