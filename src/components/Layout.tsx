import { Link, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Menu,
  LogOut,
  Settings,
  Printer,
} from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/auth";
import { AnimatePresence, motion } from "motion/react";
import { easeOut } from "../lib/ui";

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();

  const navigation = [
    { name: "Dasbor", href: "/", icon: LayoutDashboard, short: "Dasbor" },
    { name: "Direktori Pegawai", href: "/employees", icon: Users, short: "Pegawai" },
    { name: "Pencetakan Dokumen", href: "/print", icon: Printer, short: "Cetak" },
    { name: "Pengaturan Sistem", href: "/settings", icon: Settings, short: "Sistem" },
  ];

  return (
    <div className="h-screen w-full bg-transparent flex overflow-hidden font-sans antialiased text-slate-900 print:block print:h-auto print:overflow-visible">
      {/* Mobile sidebar backdrop — flat, no blur */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={easeOut}
            className="fixed inset-0 z-40 bg-slate-900/20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200",
          "transform transition-transform duration-200 ease-out lg:translate-x-0 lg:static lg:inset-0",
          "flex flex-col h-full w-64 print:hidden",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center h-16 shrink-0 px-6 border-b border-slate-100">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              HRCube
            </span>
          </div>
        </div>

        <div className="flex-1 px-3 py-4 flex flex-col overflow-y-auto">
          <nav className="space-y-0.5" aria-label="Navigasi utama">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center rounded-lg transition-colors px-3 py-2 text-[13px] font-medium active:scale-[0.98]",
                    isActive
                      ? "bg-slate-50 text-slate-900 border border-slate-100"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent",
                  )}
                >
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

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2">
            <div className="relative shrink-0">
              {user?.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="w-8 h-8 rounded-full border border-slate-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold">
                  {user?.name?.[0]?.toUpperCase() ||
                    user?.email?.[0]?.toUpperCase() ||
                    "A"}
                </div>
              )}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-slate-900 truncate">
                {user?.name || user?.email?.split("@")[0]}
              </div>
              <div className="text-[10px] font-medium text-slate-400 truncate">
                Administrator
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label="Keluar"
              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors active:scale-95"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:block print:overflow-visible">
        <header className="lg:hidden bg-white border-b border-slate-200 h-14 px-4 flex items-center justify-between shrink-0 sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">
              HRCube
            </span>
          </div>
          <button
            type="button"
            className="p-2 -mr-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg active:scale-95 transition-all"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Buka menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 lg:pb-8 p-0 sm:p-4 md:p-8 lg:p-10 print:block print:overflow-visible print:p-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={easeOut}
              className="h-full min-h-0"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 safe-bottom z-30 grid grid-cols-4 gap-1 print:hidden"
          aria-label="Navigasi bawah"
        >
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                aria-label={item.name}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all active:scale-95",
                  isActive
                    ? "text-slate-900 bg-slate-50"
                    : "text-slate-400 hover:text-slate-600",
                )}
              >
                <item.icon
                  className={cn("w-5 h-5", isActive && "stroke-[2.5]")}
                />
                <span className="text-[9px] font-bold uppercase tracking-wider">
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
