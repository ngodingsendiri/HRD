import React, { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { useBlocker } from "react-router-dom";
import { AppSettings } from "../types";
import {
  Save,
  Loader2,
  ShieldCheck,
  Image as ImageIcon,
  X,
  Database,
  User,
  Printer,
  FileSpreadsheet,
  KeyRound,
} from "lucide-react";
import { DEFAULT_KAMUS } from "../constants";
import { motion } from "motion/react";
import { api } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import {
  btnPrimary,
  card,
  input,
  navTab,
  pageContainerVariants,
  pageItemVariants,
  pageShell,
} from "../lib/ui";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/auth";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { notify } from "../lib/notify";

/**
 * Heavy managers (pull in xlsx) — only load when user opens those tabs.
 * This was a major cause of "spinning" when entering Settings: the whole
 * Settings route was parsing xlsx + rendering managers before first paint.
 */
const KamusManager = lazy(() =>
  import("../components/KamusManager").then((m) => ({ default: m.KamusManager })),
);
const PetaManager = lazy(() =>
  import("../components/PetaManager").then((m) => ({ default: m.PetaManager })),
);
const ApiKeysManager = lazy(() =>
  import("../components/ApiKeysManager").then((m) => ({
    default: m.ApiKeysManager,
  })),
);

const EMPTY_SETTINGS: AppSettings = {
  sekdaNama: "",
  sekdaNip: "",
  bupatiNama: "",
  kopLine1: "",
  kopLine2: "",
  kopLine3: "",
  kopLine4: "",
  logoBase64: "",
  jabatanKamusCsv: "",
  petaJabatanCsv: "",
};

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" />
      Memuat editor…
    </div>
  );
}

export default function Settings() {
  const { canWrite } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "identitas" | "cetak" | "kamus" | "peta" | "api"
  >("identitas");

  // Track which heavy tabs have been visited so Suspense only hits once.
  const [kamusMounted, setKamusMounted] = useState(false);
  const [petaMounted, setPetaMounted] = useState(false);
  const [apiMounted, setApiMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchSettingsData() {
      try {
        const data = await api.getSettings("all");
        if (cancelled) return;
        setSettings({
          ...EMPTY_SETTINGS,
          ...data,
          // Keep stored CSV as-is; only fall back to default when truly empty
          // and user opens kamus tab (avoids rewriting huge default on every load).
          jabatanKamusCsv: data.jabatanKamusCsv ?? "",
          petaJabatanCsv: data.petaJabatanCsv ?? "",
        });
        setIsDirty(false);
      } catch (error) {
        console.error("Error fetching settings:", error);
        if (!cancelled) {
          notify.error("Gagal memuat pengaturan", "Coba muat ulang halaman.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSettingsData();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      notify.error("Logo terlalu besar", "Maksimal 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      patchSettings({ logoBase64: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    patchSettings({ logoBase64: "" });
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload: AppSettings = {
        ...settings,
        jabatanKamusCsv: settings.jabatanKamusCsv || DEFAULT_KAMUS,
      };
      await api.upsertSettings(payload);
      setSettings(payload);
      setIsDirty(false);
      notify.success("Pengaturan disimpan");
    } catch (error) {
      console.error("Error saving settings:", error);
      notify.error("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const selectTab = (tab: typeof activeTab) => {
    if (tab === "kamus") setKamusMounted(true);
    if (tab === "peta") setPetaMounted(true);
    if (tab === "api") setApiMounted(true);
    setActiveTab(tab);
  };

  const isApiTab = activeTab === "api";

  const kamusCsvForEditor = settings.jabatanKamusCsv || DEFAULT_KAMUS;

  // Block navigation when there are unsaved changes (React Router v7)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      canWrite &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && canWrite) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, canWrite]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageContainerVariants}
      className={pageShell}
    >
      <motion.div variants={pageItemVariants}>
        <PageHeader
          title="Pengaturan"
          description="Identitas instansi, data master, dan API."
          actions={
            isApiTab ? (
              <span className="text-xs font-medium text-slate-500 border border-slate-200 rounded-lg px-3 py-2">
                Kelola key di panel
              </span>
            ) : canWrite ? (
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving || loading || !isDirty}
                aria-label="Simpan pengaturan"
                className={`${btnPrimary} w-full sm:w-auto shrink-0`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving
                  ? "Menyimpan…"
                  : isDirty
                    ? "Simpan semua"
                    : "Tersimpan"}
              </button>
            ) : (
              <span className="text-xs font-medium text-slate-500 border border-slate-200 rounded-lg px-3 py-2">
                Mode baca saja
              </span>
            )
          }
        />
      </motion.div>

      <motion.div
        variants={pageItemVariants}
        className="flex flex-col md:flex-row gap-6 md:gap-8"
      >
        <div className="w-full md:w-56 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide snap-x">
            <p className="hidden md:block px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Instansi
            </p>
            <button
              type="button"
              onClick={() => selectTab("identitas")}
              className={navTab(activeTab === "identitas")}
            >
              <User
                className={cn(
                  "w-4 h-4",
                  activeTab === "identitas" ? "text-slate-900" : "text-slate-400",
                )}
              />
              Penandatangan
            </button>
            <button
              type="button"
              onClick={() => selectTab("cetak")}
              className={navTab(activeTab === "cetak")}
            >
              <Printer
                className={cn(
                  "w-4 h-4",
                  activeTab === "cetak" ? "text-slate-900" : "text-slate-400",
                )}
              />
              Identitas
            </button>
            <p className="hidden md:block px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Data master
            </p>
            <button
              type="button"
              onClick={() => selectTab("kamus")}
              className={navTab(activeTab === "kamus")}
            >
              <Database
                className={cn(
                  "w-4 h-4",
                  activeTab === "kamus" ? "text-slate-900" : "text-slate-400",
                )}
              />
              Kamus
            </button>
            <button
              type="button"
              onClick={() => selectTab("peta")}
              className={navTab(activeTab === "peta")}
            >
              <FileSpreadsheet
                className={cn(
                  "w-4 h-4",
                  activeTab === "peta" ? "text-slate-900" : "text-slate-400",
                )}
              />
              Peta jabatan
            </button>
            <p className="hidden md:block px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Integrasi
            </p>
            <button
              type="button"
              onClick={() => selectTab("api")}
              className={navTab(activeTab === "api")}
            >
              <KeyRound
                className={cn(
                  "w-4 h-4",
                  activeTab === "api" ? "text-slate-900" : "text-slate-400",
                )}
              />
              API
            </button>
          </nav>
        </div>

        <div className={`flex-1 ${card} min-h-[500px] relative`}>
          {/* Soft loading overlay — UI shell stays visible (no full-page spinner) */}
          {loading && !isApiTab && (
            <div className="absolute inset-0 z-10 bg-white/70 flex items-center justify-center rounded-xl">
              <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                Memuat pengaturan…
              </div>
            </div>
          )}

          {apiMounted && (
            <div
              className={cn(
                "p-4 sm:p-6 md:p-8",
                activeTab === "api" ? "block" : "hidden",
              )}
            >
              <Suspense fallback={<TabFallback />}>
                <ApiKeysManager canWrite={canWrite} />
              </Suspense>
            </div>
          )}

          <form
            onSubmit={handleSave}
            className={cn(
              "p-4 sm:p-6 md:p-8",
              isApiTab && "hidden",
              loading && "pointer-events-none opacity-60",
              !canWrite && "[&_input]:bg-slate-50 [&_input]:text-slate-600 [&_textarea]:bg-slate-50",
            )}
          >
            {activeTab === "identitas" && (
              <div className="space-y-8">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                    Penandatangan
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Nama pejabat untuk dokumen resmi (kop / TTD).
                  </p>
                </div>

                <div className="space-y-8">
                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5" /> Sekretaris Daerah
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Nama
                        </label>
                        <input
                          type="text"
                          className={input}
                          value={settings.sekdaNama}
                          disabled={!canWrite}
                          readOnly={!canWrite}
                          onChange={(e) =>
                            patchSettings({ sekdaNama: e.target.value })
                          }
                          placeholder="Nama lengkap"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          NIP
                        </label>
                        <input
                          type="text"
                          className={`${input} font-mono`}
                          value={settings.sekdaNip}
                          disabled={!canWrite}
                          readOnly={!canWrite}
                          onChange={(e) =>
                            patchSettings({ sekdaNip: e.target.value })
                          }
                          placeholder="18 digit"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4 pt-2 border-t border-slate-100">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5" /> Kepala daerah
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Nama
                        </label>
                        <input
                          type="text"
                          className={input}
                          value={settings.bupatiNama}
                          disabled={!canWrite}
                          readOnly={!canWrite}
                          onChange={(e) =>
                            patchSettings({ bupatiNama: e.target.value })
                          }
                          placeholder="Bupati / pejabat"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeTab === "cetak" && (
              <div className="space-y-8">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                    Identitas dokumen
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Baris kop surat dan logo instansi.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Baris 1 (Pemerintah)
                      </label>
                      <input
                        type="text"
                        className={`${input} font-bold text-center`}
                        value={settings.kopLine1 || ""}
                        onChange={(e) =>
                          patchSettings({ kopLine1: e.target.value })
                        }
                        placeholder="PEMERINTAH KOTA BANDUNG"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Baris 2 (Dinas)
                      </label>
                      <input
                        type="text"
                        className={`${input} font-bold text-center text-lg`}
                        value={settings.kopLine2 || ""}
                        onChange={(e) =>
                          patchSettings({ kopLine2: e.target.value })
                        }
                        placeholder="DINAS KOMUNIKASI DAN INFORMATIKA"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Baris 3 (Alamat)
                      </label>
                      <input
                        type="text"
                        className={`${input} text-center`}
                        value={settings.kopLine3 || ""}
                        onChange={(e) =>
                          patchSettings({ kopLine3: e.target.value })
                        }
                        placeholder="Jl. ..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Baris 4 (Kontak)
                      </label>
                      <input
                        type="text"
                        className={`${input} text-center`}
                        value={settings.kopLine4 || ""}
                        onChange={(e) =>
                          patchSettings({ kopLine4: e.target.value })
                        }
                        placeholder="Telp / Email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Logo Instansi
                    </label>
                    <div className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden relative group h-[290px] flex flex-col items-center justify-center p-6 border-dashed">
                      {settings.logoBase64 ? (
                        <>
                          <img
                            src={settings.logoBase64}
                            alt="Logo"
                            className="max-h-[200px] max-w-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="absolute top-4 right-4 p-2 bg-white text-red-600 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all opacity-0 group-hover:opacity-100"
                            aria-label="Hapus logo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : null}
                      {!settings.logoBase64 && (
                        <label className="flex flex-col items-center gap-3 cursor-pointer text-slate-500 hover:text-slate-800 transition-colors">
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-medium">
                            Unggah logo (maks 1MB)
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Keep mounted after first visit so re-opening tab is instant */}
            {kamusMounted && (
              <div className={activeTab === "kamus" ? "block" : "hidden"}>
                <div className="border-b border-slate-100 pb-4 mb-6">
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                    Kamus jabatan
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Referensi kelas & beban kerja per jabatan.
                  </p>
                </div>
                <Suspense fallback={<TabFallback />}>
                  <KamusManager
                    csvData={kamusCsvForEditor}
                    onChange={(newCsv) =>
                      patchSettings({ jabatanKamusCsv: newCsv })
                    }
                  />
                </Suspense>
              </div>
            )}

            {petaMounted && (
              <div className={activeTab === "peta" ? "block" : "hidden"}>
                <div className="border-b border-slate-100 pb-4 mb-6">
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                    Peta jabatan
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Kebutuhan & bezetting per unit.
                  </p>
                </div>
                <Suspense fallback={<TabFallback />}>
                  <PetaManager
                    csvData={settings.petaJabatanCsv || ""}
                    onChange={(newCsv) =>
                      patchSettings({ petaJabatanCsv: newCsv })
                    }
                  />
                </Suspense>
              </div>
            )}
          </form>
        </div>
      </motion.div>

      <ConfirmDialog
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        title="Buang perubahan?"
        description="Ada perubahan yang belum disimpan. Tinggalkan halaman ini?"
        confirmLabel="Buang & keluar"
        cancelLabel="Tetap di sini"
        variant="danger"
        onConfirm={() => blocker.proceed?.()}
      />
    </motion.div>
  );
}
