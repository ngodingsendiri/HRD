import { Link, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Settings,
  Printer,
  ChevronDown,
  LogOut as LogOutIcon,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/auth";
import { AnimatePresence, motion } from "motion/react";
import { easeOut, routeFade } from "../lib/ui";
import { ConfirmDialog } from "./ConfirmDialog";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const TITLE_BY_PATH: Record<string, string> = {
  "/": "Ringkasan",
  "/employees": "Pegawai",
  "/print": "Cetak",
  "/settings": "Pengaturan",
};

export default function Layout() {
  const location = useLocation();
  const { user, canWrite, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Exact shell routes only — null skips so EmployeeFormPage owns its title
  const pageTitle = TITLE_BY_PATH[location.pathname] ?? null;
  useDocumentTitle(pageTitle);

  const navigation = [
    { name: "Ringkasan", href: "/", icon: LayoutDashboard, short: "Ringkas" },
    { name: "Pegawai", href: "/employees", icon: Users, short: "Pegawai" },
    { name: "Cetak", href: "/print", icon: Printer, short: "Cetak" },
    { name: "Pengaturan", href: "/settings", icon: Settings, short: "Setelan" },
  ];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const isNavActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

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

        <div className="p-3 border-t border-slate-100" ref={menuRef}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold shrink-0">
                {user?.name?.[0]?.toUpperCase() ||
                  user?.email?.[0]?.toUpperCase() ||
                  "A"}
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-slate-900 truncate">
                  {user?.name || user?.email?.split("@")[0]}
                </div>
                <div className="text-[10px] font-medium text-slate-400 truncate">
                  {canWrite ? "Admin" : "Viewer · baca saja"}
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-slate-400 transition-transform",
                  menuOpen && "rotate-180",
                )}
              />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={easeOut}
                  role="menu"
                  className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-xl p-1 z-50"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg"
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                  >
                    <LogOut className="w-4 h-4 text-slate-400" />
                    Keluar
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg"
                    onClick={() => {
                      setMenuOpen(false);
                      setLogoutAllOpen(true);
                    }}
                  >
                    <LogOutIcon className="w-4 h-4 text-slate-400" />
                    Keluar semua perangkat
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:block print:overflow-visible">
        <header className="lg:hidden bg-white border-b border-slate-200 h-12 px-4 flex items-center justify-between shrink-0 sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-[9px] font-bold text-white">
              HA
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">
              HRD ASN
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1.5 rounded-lg hover:bg-slate-50"
            aria-label="Akun"
          >
            <User className="w-4 h-4" />
            Akun
          </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 lg:pb-8 p-0 sm:p-4 md:p-8 lg:p-10 print:block print:overflow-visible print:p-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              {...routeFade}
              className="h-full min-h-0"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
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

      {/* Mobile account sheet */}
      <AnimatePresence>
        {accountOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Tutup"
              className="lg:hidden fixed inset-0 z-40 bg-slate-900/40 print:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={easeOut}
              onClick={() => setAccountOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-label="Akun"
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 rounded-t-xl p-4 safe-bottom print:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={easeOut}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                    {user?.name?.[0]?.toUpperCase() ||
                      user?.email?.[0]?.toUpperCase() ||
                      "A"}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {user?.name || user?.email}
                    </div>
                    <div className="text-xs text-slate-500">
                      {canWrite ? "Admin" : "Viewer · baca saja"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50"
                  onClick={() => setAccountOpen(false)}
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50"
                  onClick={() => {
                    setAccountOpen(false);
                    signOut();
                  }}
                >
                  <LogOut className="w-4 h-4 text-slate-400" />
                  Keluar
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-700 rounded-lg hover:bg-red-50"
                  onClick={() => {
                    setAccountOpen(false);
                    setLogoutAllOpen(true);
                  }}
                >
                  <LogOutIcon className="w-4 h-4" />
                  Keluar semua perangkat
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={logoutAllOpen}
        onClose={() => setLogoutAllOpen(false)}
        title="Keluar semua perangkat?"
        description="Sesi login di perangkat lain juga akan diakhiri. Anda perlu masuk lagi di mana saja."
        confirmLabel="Keluar semua"
        variant="danger"
        onConfirm={async () => {
          setLogoutAllOpen(false);
          await signOut({ allDevices: true });
        }}
      />
    </div>
  );
}
