import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { KamusManager } from "../components/KamusManager";
import { PetaManager } from "../components/PetaManager";
import { FileSpreadsheet } from "lucide-react";
import { DEFAULT_KAMUS } from "../constants";
import { motion } from "motion/react";
import { api } from "../lib/api";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    sekdaNama: "",
    sekdaNip: "",
    bupatiNama: "",
    kopLine1: "",
    kopLine2: "",
    kopLine3: "",
    kopLine4: "",
    logoBase64: "",
    jabatanKamusCsv: DEFAULT_KAMUS,
    petaJabatanCsv: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const initialSettingsRef = useRef<string | null>(null);
  
  // Track initial settings (snapshot at load — used to detect unsaved changes).
  useEffect(() => {
    if (!loading && initialSettingsRef.current === null) {
      initialSettingsRef.current = JSON.stringify(settings);
    }
  }, [loading, settings]);

  // Auto-save DISABLED intentionally. Settings include official document
  // headers (kop surat, pejabat names) — silent auto-save risked persisting
  // mistakes with no audit trail. Save now goes through the explicit Save
  // button (handleSave) which calls api.upsertSettings.

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"identitas" | "cetak" | "kamus" | "peta">(
    "identitas",
  );

  useEffect(() => {
    async function fetchSettingsData() {
      try {
        const data = await api.getSettings();
        setSettings((prev) => ({
          ...prev,
          ...data,
          jabatanKamusCsv: data.jabatanKamusCsv || DEFAULT_KAMUS,
          petaJabatanCsv: data.petaJabatanCsv || "",
        }));
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettingsData();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      // 1MB limit check
      setMessage({
        type: "error",
        text: "Ukuran logo tidak boleh lebih dari 1MB",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings((prev) => ({ ...prev, logoBase64: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setSettings((prev) => ({ ...prev, logoBase64: "" }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.upsertSettings(settings);
      setMessage({ type: "success", text: "Pengaturan berhasil disimpan" });
      // clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: "error", text: "Gagal menyimpan pengaturan" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="max-w-5xl mx-auto space-y-6 md:space-y-8 p-4 sm:p-0 sm:py-8 pb-12 antialiased"
    >
      <motion.div
        variants={itemVariants}
        className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 py-4 sm:py-6 gap-4 -mx-4 px-4 sm:-mx-0 sm:px-0"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Pengaturan Sistem
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Konfigurasi identitas instansi, atribut tata naskah, otoritas
            penandatangan, dan manajemen kamus data.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          aria-label="Simpan pengaturan"
          className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 text-[13px] font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 shrink-0"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving
            ? "Menyimpan..."
            : initialSettingsRef.current !== null &&
              JSON.stringify(settings) !== initialSettingsRef.current
              ? "Simpan Perubahan"
              : "Tersimpan"}
        </button>
      </motion.div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"}`}
        >
          <div
            className={`w-2 h-2 rounded-full ${message.type === "success" ? "bg-emerald-500" : "bg-red-500"}`}
          />
          {message.text}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 shrink-0">
          <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 scrollbar-hide snap-x">
            <button
              onClick={() => setActiveTab("identitas")}
              className={`snap-center flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${
                activeTab === "identitas"
                  ? "bg-slate-100 text-slate-900 ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <User
                className={`w-4 h-4 ${activeTab === "identitas" ? "text-slate-900" : "text-slate-400"}`}
              />
              Otoritas Penandatangan
            </button>
            <button
              onClick={() => setActiveTab("cetak")}
              className={`snap-center flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${
                activeTab === "cetak"
                  ? "bg-slate-100 text-slate-900 ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Printer
                className={`w-4 h-4 ${activeTab === "cetak" ? "text-slate-900" : "text-slate-400"}`}
              />
              Tata Naskah & Identitas
            </button>
            <button
              onClick={() => setActiveTab("kamus")}
              className={`snap-center flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${
                activeTab === "kamus"
                  ? "bg-slate-100 text-slate-900 ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Database
                className={`w-4 h-4 ${activeTab === "kamus" ? "text-slate-900" : "text-slate-400"}`}
              />
              Kamus Jabatan
            </button>
            <button
              onClick={() => setActiveTab("peta")}
              className={`snap-center flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${
                activeTab === "peta"
                  ? "bg-slate-100 text-slate-900 ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet
                className={`w-4 h-4 ${activeTab === "peta" ? "text-slate-900" : "text-slate-400"}`}
              />
              Master Peta Jabatan
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-xl border border-slate-100 min-h-[500px]">
          <form onSubmit={handleSave} className="p-4 sm:p-6 md:p-8">
            {/* TAB IDENTITAS */}
            {activeTab === "identitas" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                  {/* Sekda Section */}
                  <div className="p-4 sm:p-5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-5">
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
                          className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                          value={settings.sekdaNama}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              sekdaNama: e.target.value,
                            })
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
                          className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-mono"
                          value={settings.sekdaNip}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              sekdaNip: e.target.value,
                            })
                          }
                          placeholder="19xxxxxxxxxxxxxx"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bupati Section */}
                  <div className="p-4 sm:p-5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-5">
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
                          className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                          value={settings.bupatiNama}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              bupatiNama: e.target.value,
                            })
                          }
                          placeholder="Masukkan nama jabatan tertinggi..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CETAK & KOP */}
            {activeTab === "cetak" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                  {/* Kop Text Inputs */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Baris 1 (Pemerintah)
                      </label>
                      <input
                        type="text"
                        className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-bold text-center"
                        value={settings.kopLine1 || ""}
                        onChange={(e) =>
                          setSettings({ ...settings, kopLine1: e.target.value })
                        }
                        placeholder="PEMERINTAH KOTA BANDUNG"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Baris 2 (Instansi/Dinas)
                      </label>
                      <input
                        type="text"
                        className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-bold text-center text-lg"
                        value={settings.kopLine2 || ""}
                        onChange={(e) =>
                          setSettings({ ...settings, kopLine2: e.target.value })
                        }
                        placeholder="DINAS KESEHATAN"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Baris 3 (Jalan)
                      </label>
                      <input
                        type="text"
                        className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all text-center"
                        value={settings.kopLine3 || ""}
                        onChange={(e) =>
                          setSettings({ ...settings, kopLine3: e.target.value })
                        }
                        placeholder="Jalan Sukajadi No. 123"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Baris 4 (Kontak/Web)
                      </label>
                      <input
                        type="text"
                        className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all text-center"
                        value={settings.kopLine4 || ""}
                        onChange={(e) =>
                          setSettings({ ...settings, kopLine4: e.target.value })
                        }
                        placeholder="Telp (022) 123456 Kode Pos 40162"
                      />
                    </div>
                  </div>

                  {/* Logo Upload Box */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Logo Instansi
                    </label>
                    <div className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden relative group h-[290px] flex flex-col items-center justify-center p-6 border-dashed">
                      {settings.logoBase64 ? (
                        <>
                          <img
                            src={settings.logoBase64}
                            alt="Logo Instansi"
                            className="max-h-full max-w-full object-contain drop-"
                          />
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="absolute top-4 right-4 p-2 bg-white text-red-600 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center text-slate-400 flex flex-col items-center">
                          <ImageIcon className="w-12 h-12 mb-3 text-slate-300" />
                          <span className="text-sm font-semibold text-slate-600">
                            Pilih Logo Berkas
                          </span>
                          <span className="text-xs mt-1">
                            Format PNG/JPG/SVG, max 1MB
                          </span>
                        </div>
                      )}

                      {!settings.logoBase64 && (
                        <label className="absolute inset-0 cursor-pointer flex items-center justify-center">
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

            {/* TAB KAMUS JABATAN */}
            {activeTab === "kamus" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-slate-100 pb-4 mb-6">
                  <h2 className="text-lg font-bold text-slate-800">
                    Data Kamus Jabatan
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Data master referensi jabatan untuk menghitung kelas & beban
                    kerja secara otomatis di seluruh sistem.
                  </p>
                </div>

                <KamusManager
                  csvData={settings.jabatanKamusCsv || DEFAULT_KAMUS}
                  onChange={(newCsv) =>
                    setSettings({ ...settings, jabatanKamusCsv: newCsv })
                  }
                  
                />
              </div>
            )}
            
            {/* TAB PETA JABATAN */}
            {activeTab === "peta" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-slate-100 pb-4 mb-6">
                  <h2 className="text-lg font-bold text-slate-800">
                    Master Peta Jabatan (Kebutuhan & Bezetting)
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Data referensi master untuk perhitungan kebutuhan pegawai dan analisis selisih/bezetting per Bidang/Unit Kerja.
                  </p>
                </div>

                <PetaManager
                  csvData={settings.petaJabatanCsv || ""}
                  onChange={(newCsv) =>
                    setSettings({ ...settings, petaJabatanCsv: newCsv })
                  }
                  
                />
              </div>
            )}
          </form>
        </div>
      </div>
    </motion.div>
  );
}
