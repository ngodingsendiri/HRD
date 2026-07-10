import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
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
} from "lucide-react";
import { DEFAULT_KAMUS } from "../constants";
import { AnimatePresence, motion } from "motion/react";
import { api } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import {
  alertError,
  alertSuccess,
  btnPrimary,
  card,
  easeOut,
  input,
  navTab,
  pageContainerVariants,
  pageItemVariants,
  pageShell,
} from "../lib/ui";
import { cn } from "../lib/utils";

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
  const [settings, setSettings] = useState<AppSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    "identitas" | "cetak" | "kamus" | "peta"
  >("identitas");

  // Track which heavy tabs have been visited so Suspense only hits once.
  const [kamusMounted, setKamusMounted] = useState(false);
  const [petaMounted, setPetaMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchSettingsData() {
      try {
        const data = await api.getSettings();
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
          setMessage({
            type: "error",
            text: "Gagal memuat pengaturan. Coba muat ulang.",
          });
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
      setMessage({
        type: "error",
        text: "Ukuran logo tidak boleh lebih dari 1MB",
      });
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
    setMessage(null);
    try {
      // Ensure kamus has a usable default if still empty when saving from other tabs
      const payload: AppSettings = {
        ...settings,
        jabatanKamusCsv: settings.jabatanKamusCsv || DEFAULT_KAMUS,
      };
      await api.upsertSettings(payload);
      setSettings(payload);
      setIsDirty(false);
      setMessage({ type: "success", text: "Pengaturan berhasil disimpan" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: "error", text: "Gagal menyimpan pengaturan" });
    } finally {
      setSaving(false);
    }
  };

  const selectTab = (tab: typeof activeTab) => {
    if (tab === "kamus") setKamusMounted(true);
    if (tab === "peta") setPetaMounted(true);
    setActiveTab(tab);
  };

  const kamusCsvForEditor = settings.jabatanKamusCsv || DEFAULT_KAMUS;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageContainerVariants}
      className={pageShell}
    >
      <motion.div variants={pageItemVariants}>
        <PageHeader
          title="Pengaturan Sistem"
          description="Konfigurasi identitas instansi, atribut tata naskah, otoritas penandatangan, dan manajemen kamus data."
          actions={
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || loading}
              aria-label="Simpan pengaturan"
              className={`${btnPrimary} w-full sm:w-auto shrink-0`}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving
                ? "Menyimpan..."
                : isDirty
                  ? "Simpan Perubahan"
                  : "Tersimpan"}
            </button>
          }
        />
      </motion.div>

      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message.text}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={easeOut}
            className={message.type === "success" ? alertSuccess : alertError}
            role="status"
          >
            <div
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                message.type === "success" ? "bg-emerald-500" : "bg-red-500",
              )}
            />
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        variants={pageItemVariants}
        className="flex flex-col md:flex-row gap-6 md:gap-8"
      >
        <div className="w-full md:w-64 shrink-0">
          <nav className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide snap-x">
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
              Otoritas Penandatangan
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
              Tata Naskah & Identitas
            </button>
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
              Kamus Jabatan
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
              Master Peta Jabatan
            </button>
          </nav>
        </div>

        <div className={`flex-1 ${card} min-h-[500px] relative`}>
          {/* Soft loading overlay — UI shell stays visible (no full-page spinner) */}
          {loading && (
            <div className="absolute inset-0 z-10 bg-white/70 flex items-center justify-center rounded-xl">
              <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                Memuat pengaturan…
              </div>
            </div>
          )}

          <form
            onSubmit={handleSave}
            className={cn("p-4 sm:p-6 md:p-8", loading && "pointer-events-none opacity-60")}
          >
            {activeTab === "identitas" && (
              <div className="space-y-8">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-800">
                    Otoritas Pengesahan Teratas
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Delegasi penandatangan untuk validasi dan pengesahan dokumen
                    serta laporan kepegawaian resmi.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-5">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5" /> Sekretaris Daerah
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Nama Lengkap
                        </label>
                        <input
                          type="text"
                          className={input}
                          value={settings.sekdaNama}
                          onChange={(e) =>
                            patchSettings({ sekdaNama: e.target.value })
                          }
                          placeholder="Masukkan nama lengkap..."
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
                          onChange={(e) =>
                            patchSettings({ sekdaNip: e.target.value })
                          }
                          placeholder="19xxxxxxxxxxxxxx"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-5">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5" /> Kepala Daerah
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Nama Bupati / Pejabat
                        </label>
                        <input
                          type="text"
                          className={input}
                          value={settings.bupatiNama}
                          onChange={(e) =>
                            patchSettings({ bupatiNama: e.target.value })
                          }
                          placeholder="Masukkan nama jabatan tertinggi..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "cetak" && (
              <div className="space-y-8">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-800">
                    Tata Naskah Dinas & Identitas Visual
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Konfigurasi atribut tipografi dan elemen visual KOP instansi
                    guna standarisasi dokumen operasional.
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
                  <h2 className="text-lg font-bold text-slate-800">
                    Data Kamus Jabatan
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Data master referensi jabatan untuk menghitung kelas & beban
                    kerja secara otomatis di seluruh sistem.
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
                  <h2 className="text-lg font-bold text-slate-800">
                    Master Peta Jabatan (Kebutuhan & Bezetting)
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Data referensi master untuk perhitungan kebutuhan pegawai dan
                    analisis selisih/bezetting per Bidang/Unit Kerja.
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
    </motion.div>
  );
}
