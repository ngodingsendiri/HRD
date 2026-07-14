import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserCheck,
  Briefcase,
  Clock,
  AlertCircle,
  Award,
  UserPlus,
  FileWarning,
} from "lucide-react";
import { handleApiError, OperationType } from "../lib/error";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { PageSkeleton } from "../components/Skeleton";
import { motion } from "motion/react";
import { PageHeader } from "../components/PageHeader";
import {
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
  type DataHealth,
  type TimelineItem,
  EMPTY_DATA_HEALTH,
} from "../lib/dashboardStats";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useAuth } from "../lib/auth";

type TimelineTab = "kgb" | "kp" | "pensiun";

/** Jendela mendesak (daftar ringkas) dan warna badge di tabel proyeksi. */
const TAB_URGENCY: Record<
  TimelineTab,
  { label: string; nearDays: number; badgeDays: number; acuan: string }
> = {
  kgb: {
    label: "Kenaikan gaji berkala",
    nearDays: 90,
    badgeDays: 30,
    acuan: "Dasar perhitungan",
  },
  kp: {
    label: "Kenaikan pangkat",
    nearDays: 90,
    badgeDays: 90,
    acuan: "Terhitung mulai tanggal pangkat",
  },
  pensiun: {
    label: "Pensiun",
    nearDays: 365,
    badgeDays: 90,
    acuan: "Tanggal lahir",
  },
};

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

function isUrgentItem(item: TimelineItem, kind: TimelineTab): boolean {
  const near = TAB_URGENCY[kind].nearDays;
  return item.isOverdue || item.diffDays <= near;
}

/** Buka direktori pegawai terfokus ke satu orang. */
function employeeLink(item: { nip?: string; nama?: string }) {
  const sp = new URLSearchParams();
  const q = (item.nip || item.nama || "").trim();
  if (q) sp.set("q", q);
  const qs = sp.toString();
  return qs ? `/employees?${qs}` : "/employees";
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
  useDocumentTitle("Dashboard");
  const { canWrite } = useAuth();
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
  const [health, setHealth] = useState<DataHealth>(EMPTY_DATA_HEALTH);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !api.peekDashboardStats());
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [timelineTab, setTimelineTab] = useState<TimelineTab>("kgb");
  const [truncated, setTruncated] = useState(false);

  const applyDash = useCallback(
    (dash: Awaited<ReturnType<typeof api.getDashboardStats>>) => {
      const t = dash.totals ?? {
        total: 0,
        pns: 0,
        cpns: 0,
        pppk: 0,
        pppkpw: 0,
        honorer: 0,
        lainnya: 0,
      };
      setStats({
        total: t.total ?? 0,
        pns: t.pns ?? 0,
        cpns: t.cpns ?? 0,
        pppk: t.pppk ?? 0,
        pppkpw: t.pppkpw ?? 0,
        honorer: t.honorer ?? 0,
        lainnya: t.lainnya ?? 0,
      });
      setBidangStats(Array.isArray(dash.byBidang) ? dash.byBidang : []);
      setKgbList(Array.isArray(dash.kgb) ? dash.kgb : []);
      setKpList(Array.isArray(dash.kp) ? dash.kp : []);
      setPensiunList(Array.isArray(dash.pensiun) ? dash.pensiun : []);
      setHealth(dash.health ?? EMPTY_DATA_HEALTH);
      setTruncated(Boolean((dash as { truncated?: boolean }).truncated));
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

  /** Ringkasan item mendesak (hero). */
  const urgentAlerts = useMemo(() => {
    const items = [
      ...kgbList
        .filter((x) => isUrgentItem(x, "kgb"))
        .map((x) => ({ ...x, kind: "KGB" as const })),
      ...kpList
        .filter((x) => isUrgentItem(x, "kp"))
        .map((x) => ({ ...x, kind: "KP" as const })),
      ...pensiunList
        .filter((x) => isUrgentItem(x, "pensiun"))
        .map((x) => ({ ...x, kind: "Pensiun" as const })),
    ].sort((a, b) => a.diffDays - b.diffDays);
    return items;
  }, [kgbList, kpList, pensiunList]);

  const urgentTotal = urgentAlerts.length;
  const urgentPreview = urgentAlerts.slice(0, 12);

  /** Proyeksi: seluruh jadwal tab aktif, diurut dari paling mendesak. */
  const activeList = useMemo(() => {
    const raw =
      timelineTab === "kgb"
        ? kgbList
        : timelineTab === "kp"
          ? kpList
          : pensiunList;
    return [...raw].sort((a, b) => a.diffDays - b.diffDays);
  }, [timelineTab, kgbList, kpList, pensiunList]);

  const tabCounts = useMemo(
    () => ({
      kgb: kgbList.length,
      kp: kpList.length,
      pensiun: pensiunList.length,
    }),
    [kgbList, kpList, pensiunList],
  );

  const maxBidang = useMemo(
    () => Math.max(1, ...bidangStats.map((b) => b.value)),
    [bidangStats],
  );

  const healthTotal =
    health.withoutNip +
    health.withoutTmtGol +
    health.jabatanOffKamus +
    health.withoutHp;

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
      to: "/employees",
    },
    {
      name: "PNS",
      value: stats.pns,
      icon: UserCheck,
      sub: pct(stats.pns, total),
      to: "/employees?status=PNS",
    },
    {
      name: "PPPK",
      value: stats.pppk,
      icon: Briefcase,
      sub: pct(stats.pppk, total),
      to: "/employees?status=PPPK",
    },
    {
      name: "PPPKPW",
      value: stats.pppkpw,
      icon: Award,
      sub: pct(stats.pppkpw, total),
      to: "/employees?status=PPPKPW",
    },
  ];

  const secondaryKpi = [
    { name: "CPNS", value: stats.cpns, to: "/employees?status=CPNS" },
    { name: "Honorer", value: stats.honorer, to: "/employees?status=Honorer" },
    { name: "Lainnya", value: stats.lainnya, to: "/employees?status=Lainnya" },
  ].filter((x) => x.value > 0);

  if (!error && total === 0) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={pageContainerVariants}
        className={pageShell}
      >
        <motion.div variants={pageItemVariants}>
          <PageHeader
            title="Dashboard"
            description="Ringkasan data kepegawaian dan prediksi jadwal kepegawaian."
          />
        </motion.div>
        <motion.div
          variants={pageItemVariants}
          className={`${card} p-8 text-center space-y-4`}
        >
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Belum ada data pegawai. Impor dari templat atau tambah pegawai
            secara manual. Prediksi kenaikan gaji berkala, pangkat, dan pensiun
            akan tampil di sini setelah data terisi.
          </p>
          {canWrite && (
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/employees/new" className={btnSecondary}>
                <UserPlus className="w-3.5 h-3.5" />
                Tambah pegawai
              </Link>
            </div>
          )}
        </motion.div>
      </motion.div>
    );
  }

  const headerDescription = updatedAt
    ? `Data per ${new Date(updatedAt).toLocaleString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "Ringkasan data kepegawaian dan prediksi jadwal kepegawaian.";

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageContainerVariants}
      className={pageShell}
    >
      <motion.div variants={pageItemVariants}>
        <PageHeader title="Dashboard" description={headerDescription} />
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

      {truncated && (
        <motion.div
          variants={pageItemVariants}
          className="p-3 rounded-xl border border-amber-100 bg-amber-50 text-amber-900 text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Data proyeksi terpotong karena batas pemindaian. Angka mendesak
          mungkin tidak lengkap untuk organisasi berukuran sangat besar.
        </motion.div>
      )}

      <motion.div
        variants={pageItemVariants}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6"
      >
        <div
          id="mendesak"
          className={`${card} overflow-hidden flex flex-col min-h-[280px] scroll-mt-20`}
        >
          <div
            className={`${cardHeader} flex items-center justify-between gap-2`}
          >
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-800">
                Perlu penanganan
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Kenaikan gaji berkala dan pangkat dalam 90 hari; pensiun dalam
                365 hari
                {urgentTotal > 12 ? ` · menampilkan 12 dari ${urgentTotal}` : ""}
              </p>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 border border-slate-200 bg-white px-2 py-0.5 rounded-lg tabular-nums shrink-0">
              {urgentPreview.length}
              {urgentTotal > urgentPreview.length ? `/${urgentTotal}` : ""}
            </span>
          </div>
          {urgentPreview.length === 0 ? (
            <p className="p-5 text-sm text-slate-500 flex-1 flex items-center">
              Tidak ada jadwal dalam jendela penanganan mendesak.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[360px]">
              {urgentPreview.map((a) => (
                <li key={`${a.kind}-${a.id}`}>
                  <Link
                    to={employeeLink(a)}
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
                        {a.nip || "—"} · {fmtDate(a.nextDate)}*
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

        <div className="space-y-4 flex flex-col min-h-0">
          <div className="grid grid-cols-2 gap-3">
            {kpi.map((item) => (
              <Link
                key={item.name}
                to={item.to}
                className={`${card} p-3.5 min-h-[88px] flex flex-col justify-between hover:border-slate-300 transition-colors`}
              >
                <div className="flex items-center gap-1.5 text-slate-400">
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {item.name}
                  </span>
                </div>
                <div className="mt-1.5 flex items-end justify-between gap-1">
                  <span className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight leading-none">
                    {item.value || 0}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 tabular-nums pb-0.5">
                    {item.sub}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {secondaryKpi.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {secondaryKpi.map((s) => (
                <Link
                  key={s.name}
                  to={s.to}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-500">{s.name}</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {s.value}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <div className={`${card} overflow-hidden flex-1 flex flex-col min-h-[160px]`}>
            <div
              className={`${cardHeader} flex items-center justify-between gap-2`}
            >
              <h2 className="text-sm font-semibold text-slate-800">
                Per unit kerja
              </h2>
              <span className="text-[10px] font-semibold text-slate-500 border border-slate-200 bg-white px-2 py-0.5 rounded-lg tabular-nums">
                {total} pegawai
              </span>
            </div>
            {bidangStats.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Belum ada unit kerja.</p>
            ) : (
              <ul className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[220px]">
                {bidangStats.map((b, i) => {
                  const width = Math.max(
                    4,
                    Math.round((b.value / maxBidang) * 100),
                  );
                  const color = UNIT_COLORS[i % UNIT_COLORS.length];
                  return (
                    <li key={b.name} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-700 truncate min-w-0">
                          {b.name}
                        </span>
                        <span className="font-bold text-slate-900 tabular-nums shrink-0">
                          {b.value}
                          <span className="ml-1 text-[10px] font-medium text-slate-400">
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
        </div>
      </motion.div>

      <motion.div variants={pageItemVariants} className={`${card} overflow-hidden`}>
        <div
          className={`${cardHeader} flex flex-col sm:flex-row sm:items-center justify-between gap-2`}
        >
          <div className="flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">
              Kelengkapan data
            </h2>
          </div>
          <p className="text-[11px] text-slate-500">
            {healthTotal === 0
              ? "Data master terlihat lengkap."
              : `${healthTotal} catatan kelengkapan (satu pegawai dapat memiliki beberapa catatan).`}
          </p>
        </div>
        <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(
            [
              {
                label: "Tanpa NIP",
                value: health.withoutNip,
                hint: "Mempengaruhi impor dan cetak",
                to: health.withoutNip > 0 ? "/employees" : null,
              },
              {
                label: "ASN tanpa TMT golongan",
                value: health.withoutTmtGol,
                hint: "Prediksi pangkat kurang akurat",
                to: null as string | null,
              },
              {
                label: "Jabatan di luar kamus",
                value: health.jabatanOffKamus,
                hint: "Kelas dan beban kerja kosong",
                to: null as string | null,
              },
              {
                label: "Tanpa nomor telepon",
                value: health.withoutHp,
                hint: "Untuk keperluan administrasi",
                to: null as string | null,
              },
            ] as const
          ).map((h) => {
            const body = (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {h.label}
                </p>
                <p
                  className={cn(
                    "text-xl font-bold tabular-nums mt-0.5",
                    h.value > 0 ? "text-amber-900" : "text-slate-900",
                  )}
                >
                  {h.value}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{h.hint}</p>
              </>
            );
            const cls = cn(
              "rounded-lg border px-3 py-2.5 block text-left w-full",
              h.value > 0
                ? "border-amber-100 bg-amber-50/50"
                : "border-slate-100 bg-slate-50/50",
              h.to && "hover:border-amber-200 transition-colors",
            );
            return h.to ? (
              <Link key={h.label} to={h.to} className={cls}>
                {body}
              </Link>
            ) : (
              <div key={h.label} className={cls}>
                {body}
              </div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        id="proyeksi"
        variants={pageItemVariants}
        className="space-y-3 scroll-mt-20"
      >
        <div>
          <h2 className={sectionTitle}>
            <Clock className="w-4 h-4 text-slate-500" />
            Proyeksi jadwal
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 pl-3">
            Prediksi diurutkan dari yang paling mendesak. Bukan penetapan resmi.
          </p>
        </div>

        <div className={`${card} overflow-hidden`}>
          <div className="px-4 sm:px-5 pt-4 flex flex-wrap gap-1.5 border-b border-slate-100 pb-3">
            {(Object.keys(TAB_URGENCY) as TimelineTab[]).map((key) => {
              const meta = TAB_URGENCY[key];
              const active = timelineTab === key;
              const count = tabCounts[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTimelineTab(key)}
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
                    {count}
                  </span>
                </button>
              );
            })}
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
                    {TAB_URGENCY[timelineTab].acuan}
                  </th>
                  <th className="px-4 py-3 font-bold text-center">
                    Jadwal prediksi
                  </th>
                  <th className="px-4 py-3 font-bold text-right">Sisa waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeList.map((row) => {
                  const badgeNear = TAB_URGENCY[timelineTab].badgeDays;
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
                        <Link
                          to={employeeLink(row)}
                          className="block group"
                        >
                          <div className="font-semibold text-slate-900 truncate group-hover:underline">
                            {row.nama}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate tabular-nums">
                            {row.nip || "—"}
                          </div>
                        </Link>
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
                            {row.isFirst
                              ? "Terhitung mulai tanggal kerja"
                              : "Surat keputusan terakhir"}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={employeeLink(row)}
                          className={cn(
                            "font-semibold tabular-nums text-[13px] hover:underline",
                            row.isOverdue ? "text-red-600" : "text-slate-900",
                          )}
                        >
                          {fmtDate(row.nextDate)}*
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap",
                            urgencyClass(row, badgeNear),
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
                      Belum ada data proyeksi untuk jenis ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {activeList.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 tabular-nums">
                {activeList.length} baris · diurutkan dari paling mendesak
              </p>
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-400 pl-1">
          * Jadwal bersifat prediksi (bukan penetapan resmi), kecuali tanggal
          manual diisi pada biodata pegawai.
        </p>
      </motion.div>
    </motion.div>
  );
}
