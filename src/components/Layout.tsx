import { Link, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Settings,
  Printer,
} from "lucide-react";
import { useEffect } from "react";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/auth";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { prefetchAllRoutes, prefetchRoute } from "../lib/routePrefetch";

const TITLE_BY_PATH: Record<string, string> = {
  "/": "Dashboard",
  "/employees": "Pegawai",
  "/print": "Cetak",
  "/settings": "Pengaturan",
};

export default function Layout() {
  const location = useLocation();
  const { user, canWrite, signOut } = useAuth();

  // Exact shell routes only — null skips so EmployeeFormPage owns its title
  const pageTitle = TITLE_BY_PATH[location.pathname] ?? null;
  useDocumentTitle(pageTitle);

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, short: "Beranda" },
    { name: "Pegawai", href: "/employees", icon: Users, short: "Pegawai" },
    { name: "Cetak", href: "/print", icon: Printer, short: "Cetak" },
    { name: "Pengaturan", href: "/settings", icon: Settings, short: "Atur" },
  ];

  // Warm JS chunks in the background so menu switches skip "Memuat halaman…"
  useEffect(() => {
    const run = () => prefetchAllRoutes();
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 800);
    return () => clearTimeout(t);
  }, []);

  const isNavActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const initial =
    user?.name?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "A";
  const displayName = user?.name || user?.email?.split("@")[0] || "User";

  return (
    <div className="h-screen w-full bg-transparent flex overflow-hidden font-sans antialiased text-slate-900 print:block print:h-auto print:overflow-visible">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex-col h-full w-60 print:hidden lg:static">
        <div className="flex items-center h-14 shrink-0 px-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold text-white tracking-tight">
              HA
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              HRD ASN
            </span>
          </div>
        </div>

        <div className="flex-1 px-3 py-4 overflow-y-auto">
          <nav className="space-y-0.5" aria-label="Navigasi utama">
            {navigation.map((item) => {
              const isActive = isNavActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onMouseEnter={() => prefetchRoute(item.href)}
                  onFocus={() => prefetchRoute(item.href)}
                  className={cn(
                    "relative flex items-center rounded-lg transition-colors px-3 py-2 text-[13px] font-medium active:scale-[0.98]",
                    isActive
                      ? "bg-slate-50 text-slate-900"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                  )}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-slate-900"
                      aria-hidden
                    />
                  )}
                  <item.icon
                    className={cn(
                      "w-4 h-4 mr-3 shrink-0",
                      isActive ? "text-slate-900" : "text-slate-400",
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User + logout langsung (tanpa popup/menu) */}
        <div className="p-3 border-t border-slate-100 flex items-center gap-2">
          <div
            className="flex items-center gap-2.5 min-w-0 flex-1 px-1"
            title={user?.email || displayName}
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold shrink-0">
              {initial}
            </div>
            <div className="overflow-hidden min-w-0">
              <div className="text-[12px] font-semibold text-slate-900 truncate">
                {displayName}
              </div>
              <div className="text-[10px] font-medium text-slate-400 truncate">
                {canWrite ? "Admin" : "Viewer · baca saja"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] transition-colors"
            aria-label="Keluar"
            title="Keluar"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:block print:overflow-visible">
        <header className="lg:hidden bg-white border-b border-slate-200 h-12 px-3 flex items-center justify-between shrink-0 sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
              HA
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight truncate">
              HRD ASN
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600"
              title={displayName}
            >
              {initial}
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50"
              aria-label="Keluar"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 lg:pb-8 p-0 sm:p-4 md:p-8 lg:p-10 print:block print:overflow-visible print:p-0">
          <div className="h-full min-h-0">
            <Outlet />
          </div>
        </main>

        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-1 pt-1 safe-bottom z-30 grid grid-cols-4 gap-0.5 print:hidden"
          aria-label="Navigasi bawah"
        >
          {navigation.map((item) => {
            const isActive = isNavActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                aria-label={item.name}
                aria-current={isActive ? "page" : undefined}
                onMouseEnter={() => prefetchRoute(item.href)}
                onFocus={() => prefetchRoute(item.href)}
                onTouchStart={() => prefetchRoute(item.href)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-h-[48px] py-1.5 rounded-lg transition-all active:scale-95",
                  isActive
                    ? "text-slate-900 bg-slate-50"
                    : "text-slate-400 hover:text-slate-600",
                )}
              >
                <item.icon
                  className={cn("w-5 h-5", isActive && "stroke-[2.5]")}
                />
                <span className="text-[10px] font-semibold tracking-tight">
                  {item.short}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
