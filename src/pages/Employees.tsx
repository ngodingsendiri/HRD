import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
  X,
  AlertCircle,
  AlertTriangle,
  MoreHorizontal,
  Eye,
} from "lucide-react";
import { handleApiError, OperationType } from "../lib/error";
import { api, type BulkImportError } from "../lib/api";
import { motion } from "motion/react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  pageContainerVariants,
  pageItemVariants,
  pageShellWide,
  statusBadge,
  chip,
} from "../lib/ui";
import {
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
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TableSkeleton } from "../components/Skeleton";
import { cn } from "../lib/utils";

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

function KPKGBBadges({ emp }: { emp: Employee }) {
  const { kp, kgb, clear } = checkKGBandKP(
    emp.tmtGolonganRuang,
    emp.tanggalBerkalaTerakhir,
    {
      tmtKerja: emp.tmtKerja,
      status: emp.status,
      gol: emp.gol,
      pangkatGolongan: emp.pangkatGolongan,
    },
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
  const { canWrite } = useAuth();
  const [searchParams] = useSearchParams();
  const [rawEmployees, setRawEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [alertFilter, setAlertFilter] = useState<"all" | "any" | "kp" | "kgb">(
    () => {
      const a = searchParams.get("alert");
      return a === "kp" || a === "kgb" || a === "any" ? a : "all";
    },
  );
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [debouncedQ, setDebouncedQ] = useState(searchTerm);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>();
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    errors: number;
    skipped: number;
    errorDetails: BulkImportError[];
  } | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [discardFormOpen, setDiscardFormOpen] = useState(false);

  const employees = rawEmployees;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchTerm), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [debouncedQ, statusFilter, alertFilter, rowsPerPage]);

  const refreshList = async () => {
    const res = await api.getEmployeesPage({
      q: debouncedQ || undefined,
      status: statusFilter,
      alert: alertFilter === "all" ? undefined : alertFilter,
      limit: rowsPerPage,
      offset: page * rowsPerPage,
      lean: true,
    });
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

  const openEdit = async (id?: string) => {
    if (!id) {
      setEditingEmployee(undefined);
      setIsModalOpen(true);
      return;
    }
    try {
      notify.info("Memuat data lengkap…");
      const full = await api.getEmployee(id);
      if (!full) {
        notify.error("Data tidak ditemukan");
        return;
      }
      setEditingEmployee(full);
      setIsModalOpen(true);
    } catch (e) {
      notify.error(
        "Gagal memuat data edit",
        handleApiError(e, OperationType.GET, `/api/employees/${id}`).message,
      );
    }
  };

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearchTerm(q);
    const alert = searchParams.get("alert");
    if (alert === "kp" || alert === "kgb" || alert === "any") {
      setAlertFilter(alert);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    // kamus for form lookup + peta for bezetting export
    api.getSettings(["peta", "kamus"]).then((d) => {
      if (!cancelled) setSettings(d);
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
        if (page === 0) setLoading(true);
        const res = await api.getEmployeesPage({
          q: debouncedQ || undefined,
          status: statusFilter,
          alert: alertFilter === "all" ? undefined : alertFilter,
          limit: rowsPerPage,
          offset: page * rowsPerPage,
          lean: true,
        });
        if (cancelled) return;
        setRawEmployees(res.data);
        setTotal(res.total);
      } catch (e) {
        const err = handleApiError(e, OperationType.LIST, "/api/employees");
        if (!cancelled) setListError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, statusFilter, alertFilter, rowsPerPage, page]);

  const displayedEmployees = employees;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

  const handleSave = async (data: Employee) => {
    try {
      if (editingEmployee?.id) {
        await api.updateEmployee(editingEmployee.id, data);
        notify.success("Perubahan disimpan");
      } else {
        await api.createEmployee(data);
        notify.success("Pegawai ditambahkan");
      }
      await refreshList();
      setIsModalOpen(false);
      setEditingEmployee(undefined);
    } catch (e) {
      notify.error(
        "Gagal menyimpan",
        handleApiError(e, OperationType.WRITE, "/api/employees").message,
      );
    }
  };

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

  const handleExport = async () => {
    try {
      notify.info("Menyiapkan ekspor…");
      const XLSX = await import("xlsx");
      // Full dump for export only (capped by API max 500 — loop pages)
      const all: Employee[] = [];
      let offset = 0;
      const pageSize = 500;
      for (;;) {
        const res = await api.getEmployeesPage({
          limit: pageSize,
          offset,
          lean: false,
        });
        all.push(...res.data);
        offset += res.data.length;
        if (offset >= res.total || res.data.length === 0) break;
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(buildReimportExportRows(all)),
        "Data_Pegawai",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(buildDerivedReportRows(all)),
        "Dihitung_Sistem",
      );
      XLSX.writeFile(wb, "Data_Pegawai_HRD_ASN.xlsx");
      notify.success("Ekspor selesai", `${all.length} baris`);
    } catch {
      notify.error("Ekspor gagal");
    }
    setMoreOpen(false);
  };

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

  const handleDownloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.aoa_to_sheet(buildImportTemplateAoa());
    dataSheet["!cols"] = buildImportTemplateAoa()[0]!.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, dataSheet, "Data_Import");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(buildImportGuideAoa()),
      "Petunjuk",
    );
    XLSX.writeFile(wb, "Template_Import_Pegawai_HRD_ASN.xlsx");
    notify.success("Template diunduh");
    setMoreOpen(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
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
        // Chunk bulk to stay under body/timeout limits
        let created = 0;
        let updated = 0;
        let errors = 0;
        const errorDetails: BulkImportError[] = [];
        const CHUNK = 100;
        for (let i = 0; i < payload.length; i += CHUNK) {
          const slice = payload.slice(i, i + CHUNK);
          const result = await api.bulkUpsert(slice);
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
        }
        setImportResult({
          created,
          updated,
          errors,
          skipped,
          errorDetails: errorDetails.slice(0, 50),
        });
        await refreshList();
      } catch (err) {
        notify.error(
          "Impor gagal",
          err instanceof Error ? err.message : "Format file tidak dikenali.",
        );
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const statusOptions = ["all", "PNS", "CPNS", "PPPK", "PPPKPW", "Honorer", "Lainnya"];

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
              {canWrite && selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className={`${btnDanger} w-full sm:w-auto`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus {selectedIds.size}
                </button>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  className={btnSecondary}
                >
                  <MoreHorizontal className="w-4 h-4" />
                  Lainnya
                </button>
                {moreOpen && (
                  <div className="absolute right-0 mt-1 z-40 w-48 bg-white border border-slate-200 rounded-xl p-1">
                    {canWrite && (
                      <>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50"
                          onClick={handleDownloadTemplate}
                        >
                          Unduh template
                        </button>
                        <label className="w-full block px-3 py-2 text-sm rounded-lg hover:bg-slate-50 cursor-pointer">
                          Impor Excel
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleImport}
                          />
                        </label>
                      </>
                    )}
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50"
                      onClick={handleExport}
                    >
                      Ekspor data
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50"
                      onClick={handleExportBezetting}
                    >
                      Ekspor bezetting
                    </button>
                  </div>
                )}
              </div>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => void openEdit()}
                  className={`${btnPrimary} w-full sm:w-auto`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah
                </button>
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

      <motion.div variants={pageItemVariants} className="space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama, NIP, NIK, jabatan…"
              className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>
          <select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700"
          >
            {[25, 50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>
                {n} / halaman
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {statusOptions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={chip(statusFilter === s)}
            >
              {s === "all" ? "Semua status" : s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Semua peringatan"],
              ["any", "Ada peringatan"],
              ["kp", "KP"],
              ["kgb", "KGB"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setAlertFilter(k)}
              className={chip(alertFilter === k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <p>
            Menampilkan {displayedEmployees.length ? page * rowsPerPage + 1 : 0}
            –
            {page * rowsPerPage + displayedEmployees.length} dari {total} data
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={page <= 0 || loading}
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
              disabled={page + 1 >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya
            </button>
          </div>
        </div>

        {!loading && total === 0 && !debouncedQ && statusFilter === "all" && alertFilter === "all" ? (
          <div className={`${card} py-6`}>
            <EmptyState
              title="Belum ada data pegawai"
              description="Mulai dengan mengunduh template, mengisi data, lalu impor — atau tambah manual."
            />
            {canWrite && (
              <div className="flex flex-wrap justify-center gap-2 pb-6">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className={btnSecondary}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Unduh template
                </button>
                <label className={`${btnSecondary} cursor-pointer`}>
                  <Upload className="w-4 h-4" />
                  Impor Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleImport}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setEditingEmployee(undefined);
                    setIsModalOpen(true);
                  }}
                  className={btnPrimary}
                >
                  <Plus className="w-4 h-4" />
                  Tambah manual
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={`${card} overflow-hidden flex flex-col max-h-[min(640px,70vh)]`}>
            {/* Desktop lean table */}
            <div className="hidden md:block flex-1 overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
                  <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    {canWrite && (
                      <th className="px-3 py-3 w-10">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
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
                    )}
                    <th className="px-3 py-3">Nama</th>
                    <th className="px-3 py-3">NIP</th>
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
                      className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors"
                    >
                      {canWrite && (
                        <td className="px-3 py-2.5">
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
                      )}
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {emp.nama || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 tabular-nums text-xs">
                        {emp.nip || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={statusBadge(emp.status)}>
                          {emp.status || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 max-w-[180px] truncate">
                        {emp.jabatan || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[120px] truncate">
                        {emp.bidang || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <KPKGBBadges emp={emp} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
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
                      <td colSpan={8} className="py-8">
                        <EmptyState
                          title="Tidak ada yang cocok"
                          description="Ubah kata kunci atau filter status/peringatan."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50">
              {displayedEmployees.map((emp) => (
                <div key={emp.id} className={`${card} overflow-hidden`}>
                  <div className="p-3 border-b border-slate-100">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {emp.nama || "—"}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {emp.nip ? `NIP ${emp.nip}` : "Tanpa NIP"}
                        </p>
                        <div className="mt-1">
                          <KPKGBBadges emp={emp} />
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
                  <div className="p-2 border-t border-slate-100 flex gap-2">
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

      {/* Edit / create — full-width modal, clearer form chrome */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (formDirty) setDiscardFormOpen(true);
          else {
            setIsModalOpen(false);
            setFormDirty(false);
          }
        }}
        title={editingEmployee ? "Edit pegawai" : "Tambah pegawai"}
        size="xl"
      >
        <EmployeeForm
          initialData={editingEmployee}
          settings={settings}
          onSubmit={handleSave}
          onCancel={() => {
            setIsModalOpen(false);
            setFormDirty(false);
          }}
          onDirtyChange={setFormDirty}
        />
      </Modal>

      <ConfirmDialog
        open={discardFormOpen}
        onClose={() => setDiscardFormOpen(false)}
        title="Buang perubahan?"
        description="Ada perubahan yang belum disimpan. Tutup formulir ini?"
        confirmLabel="Buang & tutup"
        cancelLabel="Tetap mengisi"
        variant="danger"
        onConfirm={() => {
          setDiscardFormOpen(false);
          setIsModalOpen(false);
          setFormDirty(false);
        }}
      />

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
              <KPKGBBadges emp={detailEmp} />
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["Nama", detailEmp.nama],
                ["NIP", detailEmp.nip],
                ["NIK", detailEmp.nik],
                ["Jabatan", detailEmp.jabatan],
                ["Bidang", detailEmp.bidang],
                ["Pangkat/Gol", detailEmp.pangkatGolongan],
                ["TMT Kerja", detailEmp.tmtKerja],
                ["TMT Golongan", detailEmp.tmtGolonganRuang],
                ["Berkala terakhir", detailEmp.tanggalBerkalaTerakhir],
                ["No. HP", detailEmp.nomorHp],
                ["Masa kerja", detailEmp.masaKerja],
                ["Kelas jabatan", detailEmp.kelasJabatan],
              ].map(([k, v]) => (
                <div key={k as string} className="border border-slate-100 rounded-lg p-3">
                  <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    {k}
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {(v as string) || "—"}
                  </dd>
                </div>
              ))}
            </dl>
            {canWrite && (
              <div className="flex justify-end gap-2 pt-2">
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
              </div>
            )}
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
        onClose={() => setImportResult(null)}
        created={importResult?.created ?? 0}
        updated={importResult?.updated ?? 0}
        errors={importResult?.errors ?? 0}
        skipped={importResult?.skipped}
        errorDetails={importResult?.errorDetails}
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
