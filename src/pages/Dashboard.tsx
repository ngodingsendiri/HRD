import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserCheck,
  Briefcase,
  Clock,
  AlertCircle,
  Award,
  TrendingUp,
  RefreshCw,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { handleApiError, OperationType } from "../lib/error";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { PageSkeleton } from "../components/Skeleton";
import { motion } from "motion/react";
import { PageHeader } from "../components/PageHeader";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  card,
  cardHeader,
  pageContainerVariants,
  pageItemVariants,
  pageShell,
  sectionTitle,
} from "../lib/ui";
import {
  formatRelativeTime,
  type TimelineItem,
} from "../lib/dashboardStats";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type TimelineTab = "kgb" | "kp" | "pensiun";
type TimeFilter = "all" | "overdue" | "d30" | "d90";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function urgencyClass(item: TimelineItem, nearDays: number) {
  if (item.isOverdue) {
    return "bg-red-50 text-red-700 border border-red-100";
  }
  if (item.diffDays <= nearDays) {
    return "bg-amber-50 text-amber-700 border border-amber-100";
  }
  return "bg-emerald-50 text-emerald-700 border border-emerald-100";
}

function filterTimeline(list: TimelineItem[], f: TimeFilter): TimelineItem[] {
  if (f === "all") return list;
  if (f === "overdue") return list.filter((x) => x.isOverdue);
  if (f === "d30") return list.filter((x) => x.isOverdue || x.diffDays <= 30);
  return list.filter((x) => x.isOverdue || x.diffDays <= 90);
}

const UNIT_COLORS = [
  "#0f172a",
  "#334155",
  "#475569",
  "#64748b",
  "#94a3b8",
  "#cbd5e1",
];

export default function Dashboard() {
  useDocumentTitle("Ringkasan");
  const [stats, setStats] = useState({
    total: 0,
    pns: 0,
    cpns: 0,
    pppk: 0,
    pppkpw: 0,
    honorer: 0,
    lainnya: 0,
  });
  const [bidangStats, setBidangStats] = useState<
    { name: string; value: number }[]
  >([]);
  const [kgbList, setKgbList] = useState<TimelineItem[]>([]);
  const [kpList, setKpList] = useState<TimelineItem[]>([]);
  const [pensiunList, setPensiunList] = useState<TimelineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Skip full skeleton when stats are still warm in session cache
  const [loading, setLoading] = useState(() => !api.peekDashboardStats());
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [timelineTab, setTimelineTab] = useState<TimelineTab>("kgb");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  const applyDash = useCallback(
    (dash: Awaited<ReturnType<typeof api.getDashboardStats>>) => {
      setStats({
        total: dash.totals.total,
        pns: dash.totals.pns,
        cpns: dash.totals.cpns,
        pppk: dash.totals.pppk,
        pppkpw: dash.totals.pppkpw,
        honorer: dash.totals.honorer ?? 0,
        lainnya: dash.totals.lainnya ?? 0,
      });
      setBidangStats(dash.byBidang);
      setKgbList(dash.kgb);
      setKpList(dash.kp);
      setPensiunList(dash.pensiun);
      setUpdatedAt(dash.generatedAt || new Date().toISOString());
      setError(null);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const warm = api.peekDashboardStats();
      if (warm) {
        applyDash(warm);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        const dash = await api.getDashboardStats();
        if (!cancelled) applyDash(dash);
      } catch (e) {
        const err = handleApiError(e, OperationType.GET, "/api/stats");
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyDash]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const dash = await api.getDashboardStats();
      applyDash(dash);
    } catch (e) {
      setError(handleApiError(e, OperationType.GET, "/api/stats").message);
    } finally {
      setRefreshing(false);
    }
  };

  const { urgentAlerts, urgentTotal } = useMemo(() => {
    const items = [
      ...kgbList
        .filter((x) => x.isOverdue || x.diffDays <= 90)
        .map((x) => ({ ...x, kind: "KGB" as const })),
      ...kpList
        .filter((x) => x.isOverdue || x.diffDays <= 90)
        .map((x) => ({ ...x, kind: "KP" as const })),
      ...pensiunList
        .filter((x) => x.isOverdue || x.diffDays <= 365)
        .map((x) => ({ ...x, kind: "Pensiun" as const })),
    ].sort((a, b) => a.diffDays - b.diffDays);
    return {
      urgentTotal: items.length,
      urgentAlerts: items.slice(0, 8),
    };
  }, [kgbList, kpList, pensiunList]);

  const activeList = useMemo(() => {
    const raw =
      timelineTab === "kgb"
        ? kgbList
        : timelineTab === "kp"
          ? kpList
          : pensiunList;
    return filterTimeline(raw, timeFilter);
  }, [timelineTab, kgbList, kpList, pensiunList, timeFilter]);

  const maxBidang = useMemo(
    () => Math.max(1, ...bidangStats.map((b) => b.value)),
    [bidangStats],
  );

  if (loading) {
    return (
      <div className={pageShell}>
        <PageSkeleton cards={4} />
      </div>
    );
  }

  const total = stats.total || 0;
  const kpi = [
    {
      name: "Total",
      value: stats.total,
      icon: Users,
      sub: "seluruh status",
    },
    {
      name: "PNS",
      value: stats.pns,
      icon: UserCheck,
      sub: pct(stats.pns, total),
    },
    {
      name: "PPPK",
      value: stats.pppk,
      icon: Briefcase,
      sub: pct(stats.pppk, total),
    },
    {
      name: "PPPKPW",
      value: stats.pppkpw,
      icon: Award,
      sub: pct(stats.pppkpw, total),
    },
  ];

  const secondaryKpi = [
    { name: "CPNS", value: stats.cpns },
    { name: "Honorer", value: stats.honorer },
    { name: "Lainnya", value: stats.lainnya },
  ].filter((x) => x.value > 0);

  const tabMeta: Record<
    TimelineTab,
    { label: string; count: number; near: number; acuan: string }
  > = {
    kgb: {
      label: "KGB",
      count: kgbList.length,
      near: 30,
      acuan: "TMT / berkala",
    },
    kp: {
      label: "KP",
      count: kpList.length,
      near: 90,
      acuan: "TMT pangkat",
    },
    pensiun: {
      label: "Pensiun",
      count: pensiunList.length,
      near: 365,
      acuan: "Tgl lahir",
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageContainerVariants}
      className={pageShell}
    >
      <motion.div variants={pageItemVariants}>
        <PageHeader
          title="Ringkasan"
          description={
            updatedAt
              ? `Angka SDM & proyeksi. Diperbarui ${new Date(updatedAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`
              : "Angka SDM dan peringatan KP / KGB / pensiun (prediksi indikatif*)."
          }
          actions={
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className={btnSecondary}
            >
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Muat ulang
            </button>
          }
        />
      </motion.div>

      {error && (
        <motion.div
          variants={pageItemVariants}
          className="p-4 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </motion.div>
      )}

      {/* Hero: perlu tindakan */}
      <motion.div
        variants={pageItemVariants}
        className={`${card} p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 ${
          urgentTotal > 0 ? "border-l-amber-500" : "border-l-emerald-500"
        }`}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Perlu tindakan
          </p>
          <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
            {urgentTotal > 0
              ? `${urgentTotal} item mendesak`
              : "Tidak ada item mendesak"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            KP/KGB H-90 atau pensiun H-365
            {urgentTotal > 8
              ? ` · daftar menampilkan 8 teratas dari ${urgentTotal}`
              : urgentTotal > 0
                ? " · daftar di panel kiri bawah"
                : ""}
            .
          </p>
        </div>
        <Link
          to="/employees?alert=any"
          className={`${urgentTotal > 0 ? btnPrimary : btnSecondary} shrink-0`}
        >
          Buka pegawai
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </motion.div>

      {/* ── Zone 1: KPI strip ─────────────────────────────────────────── */}
      <motion.div
        variants={pageItemVariants}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        {kpi.map((item) => (
          <div
            key={item.name}
            className={`${card} p-4 sm:p-5 min-h-[96px] flex flex-col justify-between`}
          >
            <div className="flex items-center gap-2 text-slate-400">
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {item.name}
              </span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight leading-none">
                {item.value || 0}
              </span>
              <span className="text-[11px] font-medium text-slate-400 tabular-nums pb-0.5">
                {item.sub}
              </span>
            </div>
          </div>
        ))}
      </motion.div>

      {secondaryKpi.length > 0 && (
        <motion.div
          variants={pageItemVariants}
          className="flex flex-wrap gap-2"
        >
          {secondaryKpi.map((s) => (
            <div
              key={s.name}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
            >
              <span className="font-semibold text-slate-500">{s.name}</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {s.value}
              </span>
              <span className="text-slate-400 tabular-nums">
                {pct(s.value, total)}
              </span>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Zone 2: dual panel (alerts ∥ units) ───────────────────────── */}
      <motion.div
        variants={pageItemVariants}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6"
      >
        {/* Alerts */}
        <div className={`${card} overflow-hidden flex flex-col min-h-[320px]`}>
          <div className={`${cardHeader} flex items-center justify-between gap-2`}>
            <h2 className="text-sm font-semibold text-slate-800">
              Perlu perhatian
            </h2>
            <Link
              to="/employees?alert=any"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 shrink-0"
            >
              Buka pegawai →
            </Link>
          </div>
          {urgentAlerts.length === 0 ? (
            <p className="p-5 text-sm text-slate-500 flex-1 flex items-center">
              Tidak ada KP/KGB (H-90) atau pensiun (H-365) mendesak.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[360px]">
              {urgentAlerts.map((a) => (
                <li key={`${a.kind}-${a.id}`}>
                  <Link
                    to={`/employees?q=${encodeURIComponent(a.nip || a.nama)}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg border shrink-0 w-14 text-center",
                        a.isOverdue
                          ? "bg-red-50 text-red-700 border-red-100"
                          : "bg-amber-50 text-amber-700 border-amber-100",
                      )}
                    >
                      {a.kind}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {a.nama}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {a.nip || "—"} · {fmtDate(a.nextDate)}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold shrink-0 tabular-nums",
                        a.isOverdue ? "text-red-600" : "text-slate-600",
                      )}
                    >
                      {formatRelativeTime(a.diffDays)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Units — horizontal bars, not pie */}
        <div className={`${card} overflow-hidden flex flex-col min-h-[320px]`}>
          <div className={`${cardHeader} flex items-center justify-between gap-2`}>
            <h2 className="text-sm font-semibold text-slate-800">Per unit</h2>
            <span className="text-[10px] font-semibold text-slate-500 border border-slate-200 bg-white px-2 py-0.5 rounded-lg tabular-nums">
              {total} pegawai
            </span>
          </div>
          {bidangStats.length === 0 ? (
            <p className="p-5 text-sm text-slate-500 flex-1 flex items-center">
              Belum ada data unit kerja.
            </p>
          ) : (
            <ul className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[360px]">
              {bidangStats.map((b, i) => {
                const width = Math.max(4, Math.round((b.value / maxBidang) * 100));
                const color = UNIT_COLORS[i % UNIT_COLORS.length];
                return (
                  <li key={b.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-slate-700 truncate min-w-0">
                        {b.name}
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums shrink-0">
                        {b.value}
                        <span className="ml-1.5 text-[11px] font-medium text-slate-400">
                          {pct(b.value, total)}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bar-grow"
                        style={{
                          width: `${width}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </motion.div>

      {/* ── Zone 3: single timeline + tabs ─────────────────────────────── */}
      <motion.div variants={pageItemVariants} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className={sectionTitle}>
              <Clock className="w-4 h-4 text-slate-500" />
              Proyeksi
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 pl-3">
              Satu daftar — ganti tab KGB, KP, atau pensiun.
            </p>
          </div>
        </div>

        <div className={`${card} overflow-hidden`}>
          {/* Tabs + filters */}
          <div className="px-4 sm:px-5 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(tabMeta) as TimelineTab[]).map((key) => {
                const meta = tabMeta[key];
                const active = timelineTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTimelineTab(key);
                      setTimeFilter("all");
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors active:scale-[0.98]",
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    {meta.label}
                    <span
                      className={cn(
                        "ml-1.5 tabular-nums",
                        active ? "text-slate-300" : "text-slate-400",
                      )}
                    >
                      {meta.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "Semua"],
                  ["overdue", "Lewat"],
                  ["d30", "≤30h"],
                  ["d90", "≤90h"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTimeFilter(k)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors",
                    timeFilter === k
                      ? "bg-slate-50 text-slate-900 border-slate-300"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-bold">Pegawai</th>
                  <th className="px-4 py-3 font-bold hidden sm:table-cell">
                    Status
                  </th>
                  <th className="px-4 py-3 font-bold text-center hidden md:table-cell">
                    {tabMeta[timelineTab].acuan}
                  </th>
                  <th className="px-4 py-3 font-bold text-center">Jadwal</th>
                  <th className="px-4 py-3 font-bold text-right">Sisa waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeList.map((row) => {
                  const near = tabMeta[timelineTab].near;
                  const acuan =
                    timelineTab === "pensiun"
                      ? row.tanggalLahir
                        ? fmtDate(row.tanggalLahir)
                        : "—"
                      : row.baselineDate
                        ? fmtDate(row.baselineDate)
                        : "—";
                  return (
                    <tr
                      key={`${timelineTab}-${row.id}`}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-3 max-w-[200px]">
                        <div className="font-semibold text-slate-900 truncate">
                          {row.nama}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate tabular-nums">
                          {row.nip || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          {row.status || "—"}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {row.golongan || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className="text-slate-700 font-medium tabular-nums text-[13px]">
                          {acuan}
                        </span>
                        {timelineTab === "kgb" && row.isFirst != null && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {row.isFirst ? "TMT kerja" : "SK terakhir"}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "font-semibold tabular-nums text-[13px]",
                            row.isOverdue ? "text-red-600" : "text-slate-900",
                          )}
                        >
                          {fmtDate(row.nextDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap",
                            urgencyClass(row, near),
                          )}
                        >
                          {row.isOverdue ? (
                            <AlertCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {formatRelativeTime(row.diffDays)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {activeList.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm text-slate-400"
                    >
                      Tidak ada data untuk filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {activeList.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400 tabular-nums">
                {activeList.length} baris
                {timeFilter !== "all" ? " (terfilter)" : ""}
              </p>
              <Link
                to={
                  timelineTab === "kgb"
                    ? "/employees?alert=kgb"
                    : timelineTab === "kp"
                      ? "/employees?alert=kp"
                      : "/employees"
                }
                className={`${btnGhost} text-[11px]`}
              >
                {timelineTab === "kgb" && (
                  <>
                    <TrendingUp className="w-3.5 h-3.5" />
                    Filter KGB di pegawai
                  </>
                )}
                {timelineTab === "kp" && (
                  <>
                    <Award className="w-3.5 h-3.5" />
                    Filter KP di pegawai
                  </>
                )}
                {timelineTab === "pensiun" && (
                  <>
                    <Users className="w-3.5 h-3.5" />
                    Direktori pegawai
                  </>
                )}
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
