import { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  UserMinus,
  Briefcase,
  PieChart as PieChartIcon,
  Clock,
  AlertCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Award,
} from "lucide-react";
import { handleApiError, OperationType } from "../lib/error";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Employee } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface KgbInfo {
  id: string;
  nama: string;
  nip: string;
  status: string;
  golongan: string;
  nextDate: Date;
  diffDays: number;
  isOverdue: boolean;
  baselineDate: Date;
  isFirst: boolean;
}

interface KpInfo {
  id: string;
  nama: string;
  nip: string;
  status: string;
  golongan: string;
  nextDate: Date;
  diffDays: number;
  isOverdue: boolean;
  baselineDate: Date;
}

interface PensiunInfo {
  id: string;
  nama: string;
  nip: string;
  status: string;
  golongan: string;
  nextDate: Date; // Usia pensiun (misal 58 tahun dari tanggal lahir)
  diffDays: number;
  isOverdue: boolean;
  tanggalLahir: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    pns: 0,
    cpns: 0,
    pppk: 0,
    pppkpw: 0,
  });
  const [bidangStats, setBidangStats] = useState<
    { name: string; value: number }[]
  >([]);
  const [kgbList, setKgbList] = useState<KgbInfo[]>([]);
  const [showAllKgb, setShowAllKgb] = useState(false);
  const [kpList, setKpList] = useState<KpInfo[]>([]);
  const [showAllKp, setShowAllKp] = useState(false);
  const [pensiunList, setPensiunList] = useState<PensiunInfo[]>([]);
  const [showAllPensiun, setShowAllPensiun] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const calculateKgbList = (employees: Employee[]): KgbInfo[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const list: KgbInfo[] = [];

    employees.forEach((emp) => {
      let baselineDate: Date | null = null;
      let isFirst = false;

      if (emp.tanggalBerkalaTerakhir) {
        baselineDate = new Date(emp.tanggalBerkalaTerakhir);
      } else {
        const rawDate = emp.tmtKerja || emp.tmtGolonganRuang;
        if (rawDate) {
          baselineDate = new Date(rawDate);
          isFirst = true;
        }
      }

      if (!baselineDate || isNaN(baselineDate.getTime())) return;

      const nextDate = new Date(baselineDate);
      const status = emp.status || "";
      const golRaw = (emp.gol || emp.pangkatGolongan || "")
        .toUpperCase()
        .replace(/\s/g, "");

      // Rule: PNS Gol II/a first time is 1 year
      const isPnsIIa =
        status === "PNS" &&
        (golRaw.includes("II/A") ||
          golRaw.includes("II.A") ||
          golRaw === "IIA");
      // Rule: PPPK Gol 5 first time is 1 year
      const isPppk5 =
        status === "PPPK" &&
        (golRaw === "V" ||
          golRaw === "5" ||
          golRaw.includes("/V") ||
          golRaw.includes(".V"));

      if (isFirst && (isPnsIIa || isPppk5)) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      } else {
        nextDate.setFullYear(nextDate.getFullYear() + 2);
      }

      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      list.push({
        id: emp.id || emp.nik,
        nama: emp.nama,
        nip: emp.nip,
        status: status,
        golongan: emp.pangkatGolongan || emp.gol || "-",
        nextDate,
        diffDays,
        isOverdue: diffDays < 0,
        baselineDate,
        isFirst,
      });
    });

    list.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
    return list;
  };

  const formatRelativeTime = (diffDays: number) => {
    if (diffDays === 0) return "Hari ini";
    if (diffDays < 0) {
      const abs = Math.abs(diffDays);
      if (abs > 365) return `Lewat ${Math.floor(abs / 365)} tahun`;
      if (abs > 30) return `Lewat ${Math.floor(abs / 30)} bulan`;
      return `Lewat ${abs} hari`;
    }
    if (diffDays > 365)
      return `Dalam ${Math.floor(diffDays / 365)} tahun, ${Math.floor((diffDays % 365) / 30)} bln`;
    if (diffDays > 30)
      return `Dalam ${Math.floor(diffDays / 30)} bulan, ${diffDays % 30} hr`;
    return `Dalam ${diffDays} hari`;
  };

  const calculateKpList = (employees: Employee[]): KpInfo[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const list: KpInfo[] = [];

    employees.forEach((emp) => {
      // Hanya menghitung bagi yang berstatus PNS atau CPNS pada umumnya,
      // tetapi untuk lebih aman kita hitung jika memiliki tmtGolonganRuang.
      if (!emp.tmtGolonganRuang) return;

      const baselineDate = new Date(emp.tmtGolonganRuang);
      if (isNaN(baselineDate.getTime())) return;

      const nextDate = new Date(baselineDate);
      nextDate.setFullYear(nextDate.getFullYear() + 4); // 4 tahun kenaikan pangkat

      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      list.push({
        id: emp.id || emp.nik,
        nama: emp.nama,
        nip: emp.nip,
        status: emp.status || "",
        golongan: emp.pangkatGolongan || emp.gol || "-",
        nextDate,
        diffDays,
        isOverdue: diffDays < 0,
        baselineDate,
      });
    });

    list.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
    return list;
  };

  const calculatePensiunList = (employees: Employee[]): PensiunInfo[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const list: PensiunInfo[] = [];

    employees.forEach((emp) => {
      if (!emp.tanggalLahir) return;

      const baselineDate = new Date(emp.tanggalLahir);
      if (isNaN(baselineDate.getTime())) return;

      const nextDate = new Date(baselineDate);
      // Asumsi BUP (Batas Usia Pensiun) standar 58 tahun
      nextDate.setFullYear(nextDate.getFullYear() + 58);

      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      list.push({
        id: emp.id || emp.nik,
        nama: emp.nama,
        nip: emp.nip,
        status: emp.status || "",
        golongan: emp.pangkatGolongan || emp.gol || "-",
        nextDate,
        diffDays,
        isOverdue: diffDays < 0,
        tanggalLahir: emp.tanggalLahir,
      });
    });

    list.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
    return list;
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const employeesData = await api.getEmployees();
        if (cancelled) return;

        let pns = 0;
        let cpns = 0;
        let pppk = 0;
        let pppkpw = 0;
        const bidangMap: Record<string, number> = {};

        employeesData.forEach((data) => {
          if (data.status === "PNS") pns++;
          else if (data.status === "CPNS") cpns++;
          else if (data.status === "PPPK") pppk++;
          else if (data.status === "PPPKPW") pppkpw++;

          let bidang = data.bidang || "Lainnya";
          const bidangLower = bidang.toLowerCase();
          if (bidangLower.includes("sekretariat")) bidang = "Sekretariat";
          else if (bidangLower.includes("infrastruktur"))
            bidang = "Infrastruktur";
          else if (bidangLower.includes("aspirasi")) bidang = "Aspirasi";
          else if (
            bidangLower.includes("smart") ||
            bidangLower.includes("city")
          )
            bidang = "Smartcity";
          else if (bidangLower.includes("media")) bidang = "Media";

          bidangMap[bidang] = (bidangMap[bidang] || 0) + 1;
        });

        setStats({
          total: employeesData.length,
          pns,
          cpns,
          pppk,
          pppkpw,
        });

        const bidangData = Object.entries(bidangMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);
        setBidangStats(bidangData);

        setKgbList(calculateKgbList(employeesData));
        setKpList(calculateKpList(employeesData));
        setPensiunList(calculatePensiunList(employeesData));
      } catch (e) {
        const err = handleApiError(e, OperationType.GET, "/api/employees");
        if (!cancelled) setError(err);
      }
    }

    load();
    // Refresh every 60s as a lightweight realtime replacement.
    const interval = setInterval(load, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error) {
    throw error;
  }

  const statCards = [
    { name: "Total Aparatur", value: stats.total, icon: Users },
    { name: "PNS Aktif", value: stats.pns, icon: UserCheck },
    { name: "PPPK Aktif", value: stats.pppk, icon: Briefcase },
    { name: "PPPKPW Aktif", value: stats.pppkpw, icon: UserCheck },
  ];

  const COLORS = [
    "#0f172a",
    "#334155",
    "#475569",
    "#64748b",
    "#94a3b8",
    "#cbd5e1",
    "#e2e8f0",
  ];
  const displayedKgb = showAllKgb ? kgbList : kgbList.slice(0, 5);
  const displayedKp = showAllKp ? kpList : kpList.slice(0, 5);
  const displayedPensiun = showAllPensiun
    ? pensiunList
    : pensiunList.slice(0, 5);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-4 md:space-y-10 max-w-[1200px] mx-auto p-2 sm:p-0 pb-12"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4 md:pb-8"
      >
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Dasbor Kepegawaian
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ringkasan statistik kepegawaian dan alokasi penempatan secara
            seketika.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-9 px-4 bg-slate-900 text-white rounded-lg text-[12px] font-semibold flex items-center justify-center cursor-default transition-all hover:bg-slate-800">
            {new Date().toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </motion.div>

      {/* Basic Stats Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6"
      >
        {statCards.map((item) => (
          <div
            key={item.name}
            className="bg-white border border-slate-100 p-3 sm:p-6 rounded-xl hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-3 text-slate-400">
              <item.icon className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">
                {item.name}
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
              {item.value || 0}
            </div>
          </div>
        ))}
      </motion.div>

                  {/* Main Content Area */}
      <div className="space-y-4 pt-4 sm:pt-6">
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">
          Komposisi & Distribusi SDM per Unit Kerja
        </h2>
        
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Chart Card */}
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden flex flex-col xl:col-span-1">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-800">Visualisasi Komposisi</h3>
            </div>
            <div className="p-6 flex flex-col items-center justify-center flex-1">
              <div className="h-[240px] w-full max-w-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bidangStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={105}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {bidangStats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                        fontSize: "12px",
                        color: "#1e293b",
                        padding: "8px 12px"
                      }}
                      itemStyle={{ padding: "0px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* List Card */}
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden flex flex-col xl:col-span-2">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-800">Rincian Alokasi per Unit Kerja</h3>
              <span className="text-[10px] font-medium text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded-md">
                Total: {stats.total} Pegawai
              </span>
            </div>
            
            <div className="flex flex-col flex-1">
              <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-50 font-bold text-slate-400 uppercase text-[10px] tracking-wider">
                <div className="col-span-1 hidden sm:block">No</div>
                <div className="col-span-9 sm:col-span-8">Unit Kerja</div>
                <div className="col-span-3 text-right">Jumlah SDM</div>
              </div>
              
              <div className="divide-y divide-slate-50 flex-1 overflow-y-auto" style={{ maxHeight: "400px" }}>
                {bidangStats.map((bidang, index) => (
                  <motion.div
                    variants={itemVariants}
                    key={bidang.name}
                    className="grid grid-cols-12 gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors group items-center"
                  >
                    <div className="col-span-1 text-slate-300 font-mono text-[11px] hidden sm:block">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="col-span-9 sm:col-span-8 font-medium text-slate-700 group-hover:text-slate-900 truncate text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-1.5 h-1.5 rounded-full hidden sm:block"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="truncate">{bidang.name}</span>
                      </div>
                    </div>
                    <div className="col-span-3 text-right font-bold text-slate-900 tabular-nums text-sm">
                      {bidang.value}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

{/* KGB Countdown Section */}
      <div className="space-y-6 pt-10 sm:pt-14 mt-8 sm:mt-12 border-t-2 border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm border-l-2 pl-3 border-sky-500 font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-500" />
              Proyeksi Kenaikan Gaji Berkala (KGB)
            </h2>
            <p className="text-xs text-slate-500 mt-1 pl-3">
              Daftar aparatur dengan estimasi jadwal KGB berdasarkan riwayat
              masa kerja.
            </p>
          </div>
          {kgbList.length > 5 && (
            <button
              onClick={() => setShowAllKgb(!showAllKgb)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {showAllKgb ? (
                <>
                  <ChevronUp className="w-4 h-4" /> Tutup Daftar Lengkap
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" /> Lihat Semua (
                  {kgbList.length})
                </>
              )}
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-slate-50/50 border-b border-slate-100 uppercase text-[9px] sm:text-[10px] tracking-widest font-bold text-slate-500">
                <tr>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 max-w-[150px] sm:max-w-none truncate">
                    Identitas Pegawai
                  </th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 hidden sm:table-cell">
                    Status & Pangkat
                  </th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 text-center hidden md:table-cell">
                    Tanggal Keputusan (TMT)
                  </th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 text-center">
                    Estimasi Pelaksanaan KGB
                  </th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 text-right">
                    Durasi Menuju KGB
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence>
                  {displayedKgb.map((kgb) => (
                    <motion.tr
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      key={kgb.id}
                      className="hover:bg-sky-50/30 transition-colors"
                    >
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 max-w-[150px] sm:max-w-none truncate">
                        <div className="font-bold text-slate-800 truncate">
                          {kgb.nama}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                          {kgb.nip || "-"}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 hidden sm:table-cell">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600">
                          {kgb.status}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-500 mt-1">
                          {kgb.golongan}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 text-center hidden md:table-cell">
                        <div className="text-slate-700 font-medium whitespace-nowrap">
                          {kgb.baselineDate.toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 inline-flex items-center gap-1 whitespace-nowrap">
                          {kgb.isFirst ? "(TMT Kerja)" : "(SK Terakhir)"}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 text-center">
                        <div
                          className={cn(
                            "font-bold text-[11px] sm:text-[13px] whitespace-nowrap",
                            kgb.isOverdue ? "text-rose-600" : "text-slate-900",
                          )}
                        >
                          {kgb.nextDate.toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 text-right">
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap",
                            kgb.isOverdue
                              ? "bg-rose-50 text-rose-700 border border-rose-100/50"
                              : kgb.diffDays <= 30
                                ? "bg-amber-50 text-amber-700 border border-amber-100/50"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100/50",
                          )}
                        >
                          {kgb.isOverdue ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {formatRelativeTime(kgb.diffDays)}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {displayedKgb.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-slate-400 text-sm"
                    >
                      Belum terdapat data aparatur yang memenuhi kriteria KGB
                      pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Kenaikan Pangkat (KP) Countdown Section */}
      <div className="space-y-6 pt-10 sm:pt-14 mt-8 sm:mt-12 border-t-2 border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm border-l-2 pl-3 border-emerald-500 font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-500" />
              Proyeksi Kenaikan Pangkat (KP) Reguler
            </h2>
            <p className="text-xs text-slate-500 mt-1 pl-3">
              Daftar aparatur yang diproyeksikan memenuhi kriteria batas waktu
              kenaikan pangkat.
            </p>
          </div>
          {kpList.length > 5 && (
            <button
              onClick={() => setShowAllKp(!showAllKp)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {showAllKp ? (
                <>
                  <ChevronUp className="w-4 h-4" /> Tutup Daftar Lengkap
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" /> Lihat Semua (
                  {kpList.length})
                </>
              )}
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-slate-50/50 border-b border-slate-100 uppercase text-[9px] sm:text-[10px] tracking-widest font-bold text-slate-500">
                <tr>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 max-w-[150px] sm:max-w-none truncate">
                    Identitas Pegawai
                  </th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 hidden sm:table-cell">
                    Status & Pangkat
                  </th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 text-center hidden md:table-cell">
                    TMT Kepangkatan Terakhir
                  </th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 text-center">
                    Estimasi Pelaksanaan KP
                  </th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 text-right">
                    Durasi Menuju KP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence>
                  {displayedKp.map((kp) => (
                    <motion.tr
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      key={kp.id}
                      className="hover:bg-emerald-50/30 transition-colors"
                    >
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 max-w-[150px] sm:max-w-none truncate">
                        <div className="font-bold text-slate-800 truncate">
                          {kp.nama}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                          {kp.nip || "-"}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 hidden sm:table-cell">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600">
                          {kp.status}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-500 mt-1">
                          {kp.golongan}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 text-center hidden md:table-cell">
                        <div className="text-slate-700 font-medium whitespace-nowrap">
                          {kp.baselineDate.toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 text-center">
                        <div
                          className={cn(
                            "font-bold text-[11px] sm:text-[13px] whitespace-nowrap",
                            kp.isOverdue ? "text-rose-600" : "text-slate-900",
                          )}
                        >
                          {kp.nextDate.toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 text-right">
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap",
                            kp.isOverdue
                              ? "bg-rose-50 text-rose-700 border border-rose-100/50"
                              : kp.diffDays <= 90
                                ? "bg-amber-50 text-amber-700 border border-amber-100/50" // Kuning kalau sisa < 3 bln
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100/50",
                          )}
                        >
                          {kp.isOverdue ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {formatRelativeTime(kp.diffDays)}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {displayedKp.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-slate-400 text-sm"
                    >
                      Belum terdapat data aparatur yang memenuhi syarat Kenaikan
                      Pangkat (KP) pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pensiun List */}
        <div className="space-y-6 pt-10 sm:pt-14 mt-8 sm:mt-12 border-t-2 border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 px-1">
            <div>
              <h2 className="text-sm border-l-2 pl-3 border-amber-500 font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Proyeksi Purna Tugas (Batas Usia Pensiun)
              </h2>
              <p className="text-xs text-slate-500 mt-1 pl-3">
                Daftar aparatur yang mendekati batas usia pensiun (estimasi 58
                tahun berdasarkan tanggal lahir).
              </p>
            </div>
            {pensiunList.length > 5 && (
              <button
                onClick={() => setShowAllPensiun(!showAllPensiun)}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 transition-all active:scale-95 flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-lg"
              >
                {showAllPensiun ? (
                  <>
                    <ChevronUp className="w-4 h-4" /> Tutup Sebagian
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" /> Lihat Semua (
                    {pensiunList.length})
                  </>
                )}
              </button>
            )}
          </div>
          <div className="bg-white border border-slate-100 rounded-xl overflow-x-auto ">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-slate-50/50 border-b border-slate-100 uppercase text-[9px] sm:text-[10px] tracking-widest font-bold text-slate-500">
                <tr>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 max-w-[150px] sm:max-w-none truncate">
                    Identitas Pegawai
                  </th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 hidden sm:table-cell">
                    Status & Pangkat
                  </th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 text-center hidden md:table-cell">
                    Tanggal Lahir
                  </th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 text-center">
                    Estimasi Masa Pensiun
                  </th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-4 text-right">
                    Durasi Purna Tugas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence>
                  {displayedPensiun.map((pensiun) => (
                    <motion.tr
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      key={`pensiun-${pensiun.id}`}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="font-bold text-slate-800 text-xs sm:text-[13px] truncate">
                          {pensiun.nama}
                        </div>
                        <div className="text-[10px] sm:text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">
                          {pensiun.nip || "-"}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                        <div className="inline-flex px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold tracking-wider">
                          {pensiun.status || "ASN"}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-500 mt-1">
                          {pensiun.golongan}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 text-center hidden md:table-cell">
                        <div className="text-slate-700 font-medium whitespace-nowrap">
                          {new Date(pensiun.tanggalLahir).toLocaleDateString(
                            "id-ID",
                            { year: "numeric", month: "short", day: "numeric" },
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 text-center">
                        <div
                          className={cn(
                            "font-bold text-[11px] sm:text-[13px] whitespace-nowrap",
                            pensiun.isOverdue
                              ? "text-rose-600"
                              : "text-slate-900",
                          )}
                        >
                          {pensiun.nextDate.toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-4 text-right">
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap",
                            pensiun.isOverdue
                              ? "bg-rose-50 text-rose-700 border border-rose-100/50"
                              : pensiun.diffDays <= 365
                                ? "bg-amber-50 text-amber-700 border border-amber-100/50" // Kuning jika < 1 tahun
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100/50",
                          )}
                        >
                          {pensiun.isOverdue ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {formatRelativeTime(pensiun.diffDays)}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {displayedPensiun.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-slate-400 text-sm"
                    >
                      Belum terdapat data aparatur yang mendekati batas usia
                      pensiun.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
