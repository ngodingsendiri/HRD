import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Employee, AppSettings } from "../types";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  validateAndExtractNIP,
  calculateBUP,
  calculateMasaKerja,
  formatGolonganDisplay,
} from "../lib/employeeUtils";
import { EmployeeFormSchema } from "../lib/schemas";
import { ConfirmDialog } from "./ConfirmDialog";
import { btnPrimary, btnSecondary, input, label } from "../lib/ui";

interface EmployeeFormProps {
  initialData?: Employee;
  settings?: AppSettings | null;
  onSubmit: (data: Employee) => void | Promise<void>;
  onCancel: () => void;
  /** Parent can block Modal close when form is dirty */
  onDirtyChange?: (dirty: boolean) => void;
  /** External save-in-progress (disables Simpan / Batal). */
  submitting?: boolean;
}

export function EmployeeForm({
  initialData,
  settings,
  onSubmit,
  onCancel,
  onDirtyChange,
  submitting = false,
}: EmployeeFormProps) {
  const [activeTab, setActiveTab] = useState(1);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const busy = submitting || localBusy;
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<Employee>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(EmployeeFormSchema) as any,
    defaultValues: initialData || {
      nik: "",
      nama: "",
      nip: "",
      jk: "L",
      tempatLahir: "",
      tanggalLahir: "",
      jalanDusun: "",
      rt: "",
      rw: "",
      desaKelurahan: "",
      kecamatan: "",
      kabupaten: "",
      kelasJabatan: "",
      bebanKerja: "",
      tmtKerja: "",
      masaKerja: "",
      pensiun: "",
      tmtGolonganRuang: "",
      masaKerjaGolonganRuang: "",
      bupTanggal: "",
      tmtKp: "",
      noRekeningBank: "",
      npwp: "",
      pangkat: "",
      gol: "",
      pangkatGolongan: "",
      tanggalBerkalaTerakhir: "",
      gajiPokok: "",
      besaranGajiKotor: "",
      digajiMenurut: "",
      jabatan: "",
      bidang: "",
      status: "PNS",
      nomorKarpeg: "",
      pendidikan: "",
      jurusan: "",
      diklatJenjang: "",
      tahunDiklat: "",
      statusKawin: "",
      agama: "",
      nomorHp: "",
      sisaCutiN: "",
      sisaCutiN1: "",
      sisaCutiN2: "",
      skTerakhir: "",
      jumlahTertanggung: 0,
      dataKeluarga: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "dataKeluarga",
  });

  const jabatan = watch("jabatan");
  const nip = watch("nip");
  const status = watch("status");
  const tanggalLahir = watch("tanggalLahir");
  const tmtKerja = watch("tmtKerja");
  const tmtGolonganRuang = watch("tmtGolonganRuang");

  const kamusJabatanList = useMemo(() => {
    if (!settings?.jabatanKamusCsv) return [];
    const rows = settings.jabatanKamusCsv.split("\n");
    const jabatans: string[] = [];
    for (const row of rows) {
      if (!row || row.trim() === "") continue;
      const cols = row.split(/;|\t/);
      if (cols.length >= 4) {
        const jab = cols[1]?.trim();
        if (jab && jab.toLowerCase() !== "jabatan" && !jabatans.includes(jab)) {
          jabatans.push(jab);
        }
      }
    }
    return jabatans.sort();
  }, [settings?.jabatanKamusCsv]);

  useEffect(() => {
    if (!settings?.jabatanKamusCsv || !jabatan || !dirtyFields.jabatan) return;

    // Parse kamus
    const rows = settings.jabatanKamusCsv.split("\n");
    let matchedKelas = "";
    let matchedBeban = "";

    for (const row of rows) {
      if (!row || row.trim() === "") continue;
      const cols = row.split(/;|\t/);
      if (cols.length >= 4) {
        const kamusJabatan = cols[1]?.trim().toLowerCase() || "";
        if (kamusJabatan === jabatan.trim().toLowerCase()) {
          matchedKelas = cols[2]?.trim() || "";
          matchedBeban = cols[3]?.trim() || "";
          break;
        }
      }
    }

    if (matchedKelas || matchedBeban) {
      // Display-only derived fields — don't mark form dirty by themselves
      if (matchedKelas)
        setValue("kelasJabatan", matchedKelas, { shouldDirty: false });
      if (matchedBeban)
        setValue("bebanKerja", matchedBeban, { shouldDirty: false });
    }
  }, [jabatan, settings?.jabatanKamusCsv, setValue, dirtyFields.jabatan]);

  useEffect(() => {
    if (!nip || !dirtyFields.nip) return;
    
    const currentStatus = getValues("status");
    const extractResult = validateAndExtractNIP(nip, currentStatus);
    
    if (extractResult.jk) {
      setValue("jk", extractResult.jk, { shouldDirty: true });
    }
    if (extractResult.tanggalLahir) {
      setValue("tanggalLahir", extractResult.tanggalLahir, { shouldDirty: true });
    }
    if (extractResult.tmtKerja) {
      setValue("tmtKerja", extractResult.tmtKerja, { shouldDirty: true });
    }
  }, [nip, setValue, getValues, dirtyFields.nip]);

  const bupTanggalWatch = watch("bupTanggal");

  // Always refresh display field (read-only) from manual override or formula
  useEffect(() => {
    const calculatedPensiun = calculateBUP(
      tanggalLahir || "",
      jabatan || "",
      bupTanggalWatch,
    );
    if (calculatedPensiun) {
      setValue("pensiun", calculatedPensiun, { shouldDirty: false });
    } else {
      setValue("pensiun", "", { shouldDirty: false });
    }
  }, [tanggalLahir, jabatan, bupTanggalWatch, setValue]);

  useEffect(() => {
    if (tmtKerja && dirtyFields.tmtKerja) {
      const calculatedMasaKerja = calculateMasaKerja(tmtKerja);
      if (calculatedMasaKerja) {
        setValue("masaKerja", calculatedMasaKerja, { shouldDirty: false });
      }
    }
  }, [tmtKerja, setValue, dirtyFields.tmtKerja]);

  useEffect(() => {
    if (tmtGolonganRuang && dirtyFields.tmtGolonganRuang) {
      const calculatedMKG = calculateMasaKerja(tmtGolonganRuang);
      if (calculatedMKG) {
        // MKG is stored — user edited TMT gol, so this is intentional update
        setValue("masaKerjaGolonganRuang", calculatedMKG, { shouldDirty: true });
      }
    }
  }, [tmtGolonganRuang, setValue, dirtyFields.tmtGolonganRuang]);

  const tabErrorCount = useMemo(() => {
    const keys = Object.keys(errors) as string[];
    const tab1 = new Set([
      "nip",
      "nik",
      "nama",
      "jk",
      "tempatLahir",
      "tanggalLahir",
      "agama",
      "statusKawin",
      "nomorHp",
      "jalanDusun",
      "rt",
      "rw",
      "desaKelurahan",
      "kecamatan",
      "kabupaten",
    ]);
    const tab2 = new Set([
      "status",
      "jabatan",
      "bidang",
      "skTerakhir",
      "pendidikan",
      "jurusan",
      "diklatJenjang",
      "tahunDiklat",
    ]);
    const tab3 = new Set([
      "pangkat",
      "gol",
      "tmtGolonganRuang",
      "tmtKerja",
      "tanggalBerkalaTerakhir",
      "gajiPokok",
      "besaranGajiKotor",
      "noRekeningBank",
      "npwp",
      "nomorKarpeg",
    ]);
    const tab4Keys = new Set([
      "dataKeluarga",
      "sisaCutiN",
      "sisaCutiN1",
      "sisaCutiN2",
      "jumlahTertanggung",
    ]);
    return {
      1: keys.filter((k) => tab1.has(k)).length,
      2: keys.filter((k) => tab2.has(k)).length,
      3: keys.filter((k) => tab3.has(k)).length,
      4: keys.filter(
        (k) => tab4Keys.has(k) || k.startsWith("dataKeluarga."),
      ).length,
    };
  }, [errors]);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      if (tabErrorCount[1] > 0) setActiveTab(1);
      else if (tabErrorCount[2] > 0) setActiveTab(2);
      else if (tabErrorCount[3] > 0) setActiveTab(3);
      else if (tabErrorCount[4] > 0) setActiveTab(4);
    }
  }, [errors, tabErrorCount]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const requestCancel = () => {
    if (isDirty) setDiscardOpen(true);
    else onCancel();
  };

  const tabs = [
    { id: 1 as const, label: "Identitas", short: "1" },
    { id: 2 as const, label: "Jabatan", short: "2" },
    { id: 3 as const, label: "Pangkat & gaji", short: "3" },
    { id: 4 as const, label: "Keluarga", short: "4" },
  ];

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        if (busy) return;
        const gol = formatGolonganDisplay(data.gol || "");
        data.gol = gol;
        let combined = `${data.pangkat || ""} / ${gol}`.trim();
        if (combined === "/" || combined === "/ ") combined = "";
        // Avoid " / III/c" when pangkat empty
        if (!(data.pangkat || "").trim() && gol) combined = gol;
        else if ((data.pangkat || "").trim() && !gol)
          combined = (data.pangkat || "").trim();
        else if ((data.pangkat || "").trim() && gol)
          combined = `${(data.pangkat || "").trim()} / ${gol}`;
        data.pangkatGolongan = combined;
        // Derived display-only — never persist
        delete (data as { pensiun?: string }).pensiun;
        delete (data as { masaKerja?: string }).masaKerja;
        delete (data as { kelasJabatan?: string }).kelasJabatan;
        delete (data as { bebanKerja?: string }).bebanKerja;
        data.bupTanggal = data.bupTanggal || "";
        data.tmtKp = data.tmtKp || "";
        setLocalBusy(true);
        try {
          await onSubmit(data);
        } finally {
          setLocalBusy(false);
        }
      })}
      className="space-y-6"
    >
      
      {/* Stepper tabs + error badges */}
      <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto whitespace-nowrap scrollbar-hide pb-px">
        {tabs.map((tab) => {
          const errN = tabErrorCount[tab.id] || 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-all active:scale-95 ${
                activeTab === tab.id
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-600">
                {tab.short}
              </span>
              <span className="hidden sm:inline">{tab.label}</span>
              {errN > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.1rem] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold">
                  {errN}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400 -mt-3">
        Langkah {activeTab} dari 4
        {isDirty ? " · Ada perubahan belum disimpan" : ""}
      </p>

      <div className="h-[min(60vh,520px)] sm:h-[65vh] overflow-y-auto pr-2 pb-4 space-y-6">
        {/* Tab 1: Identitas Pribadi */}
        <div className={activeTab === 1 ? "space-y-6 block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className={label}>NIP</label>
                <input {...register("nip")} className={input} />
                {errors.nip && (
                  <p className="text-xs text-red-600">{String(errors.nip.message)}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className={label}>NIK</label>
                <input {...register("nik")} className={input} />
                {errors.nik && (
                  <p className="text-xs text-red-600">{String(errors.nik.message)}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className={label}>Nama Lengkap (Sesuai KTP) *</label>
                <input {...register("nama")} className={input} />
                {errors.nama && (
                  <p className="text-xs text-red-600">{String(errors.nama.message)}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className={label}>Jenis Kelamin</label>
                <select
                  {...register("jk")}
                  className={`${input} cursor-pointer`}
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={label}>Kota / Kab. Kelahiran</label>
                <input
                  {...register("tempatLahir")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Tanggal Lahir</label>
                <input
                  type="date"
                  {...register("tanggalLahir")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Agama</label>
                <input
                  {...register("agama")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Status Kawin</label>
                <input
                  {...register("statusKawin")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Nomor HP</label>
                <input
                  {...register("nomorHp")}
                  className={input}
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-4">Informasi Alamat & Domisili</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5 md:col-span-2">
                  <label className={label}>Alamat Lengkap (Jalan/Dusun)</label>
                  <input
                    {...register("jalanDusun")}
                    className={input}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={label}>RT</label>
                    <input
                      {...register("rt")}
                      className={input}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={label}>RW</label>
                    <input
                      {...register("rw")}
                      className={input}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Desa / Kelurahan</label>
                  <input
                    {...register("desaKelurahan")}
                    className={input}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Kecamatan</label>
                  <input
                    {...register("kecamatan")}
                    className={input}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Kabupaten</label>
                  <input
                    {...register("kabupaten")}
                    className={input}
                  />
                </div>
              </div>
            </div>
          </div>

        {/* Tab 2: Jabatan & Penempatan */}
        <div className={activeTab === 2 ? "space-y-6 block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className={label}>Status Hubungan Kerja</label>
                <select
                  {...register("status")}
                  className={`${input} cursor-pointer`}
                >
                  <option value="PNS">PNS</option>
                  <option value="CPNS">CPNS</option>
                  <option value="PPPK">PPPK</option>
                  <option value="PPPKPW">PPPKPW</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={label}>Jabatan</label>
                <select
                  {...register("jabatan")}
                  className={`${input} cursor-pointer`}
                >
                  <option value="">Pilih Jabatan...</option>
                  {kamusJabatanList.map((jab) => (
                    <option key={jab} value={jab}>
                      {jab}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={label}>Unit Kerja / Bidang</label>
                <select
                  {...register("bidang")}
                  className={`${input} cursor-pointer`}
                >
                  <option value="">Pilih Unit Kerja / Bidang...</option>
                  <option value="Sekretariat">Sekretariat</option>
                  <option value="Infrastruktur Teknologi Informasi Komunikasi">Infrastruktur Teknologi Informasi Komunikasi</option>
                  <option value="Pengembangan Smart City dan Statistik">Pengembangan Smart City dan Statistik</option>
                  <option value="Aspirasi dan Layanan Informasi Publik">Aspirasi dan Layanan Informasi Publik</option>
                  <option value="Layanan Media Komunikasi Publik">Layanan Media Komunikasi Publik</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={label}>Kelas Jabatan</label>
                <input
                  {...register("kelasJabatan")}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all cursor-not-allowed text-slate-500"
                  placeholder="Otomatis dari Kamus"
                  readOnly
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Beban Kerja</label>
                <input
                  {...register("bebanKerja")}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all cursor-not-allowed text-slate-500"
                  placeholder="Otomatis dari Kamus"
                  readOnly
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>SK Terakhir</label>
                <input
                  {...register("skTerakhir")}
                  className={input}
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-4">Riwayat Pendidikan & Pelatihan</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className={label}>Pendidikan Terakhir</label>
                  <input
                    {...register("pendidikan")}
                    className={input}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Jurusan</label>
                  <input
                    {...register("jurusan")}
                    className={input}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Diklat Jenjang</label>
                  <input
                    {...register("diklatJenjang")}
                    className={input}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Tahun Diklat</label>
                  <input
                    {...register("tahunDiklat")}
                    className={input}
                  />
                </div>
              </div>
            </div>
          </div>

        {/* Tab 3: Kepangkatan & Gaji */}
        <div className={activeTab === 3 ? "space-y-6 block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className={label}>Pangkat</label>
                <input
                  {...register("pangkat")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Golongan</label>
                <input
                  {...register("gol", {
                    setValueAs: (v) =>
                      formatGolonganDisplay(String(v ?? "")),
                  })}
                  className={input}
                  placeholder="III/c"
                  onBlur={(e) => {
                    const n = formatGolonganDisplay(e.target.value);
                    if (n !== e.target.value) {
                      setValue("gol", n, { shouldDirty: true });
                    }
                    const pangkat = getValues("pangkat") || "";
                    const pg = pangkat.trim()
                      ? n
                        ? `${pangkat.trim()} / ${n}`
                        : pangkat.trim()
                      : n;
                    setValue("pangkatGolongan", pg, { shouldDirty: true });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>TMT Golongan Ruang</label>
                <input
                  type="date"
                  {...register("tmtGolonganRuang")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Masa Kerja Golongan Ruang (MKG)</label>
                <input
                  {...register("masaKerjaGolonganRuang")}
                  placeholder="Terhitung otomatis"
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>TMT Kerja</label>
                <input
                  type="date"
                  {...register("tmtKerja")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Masa Kerja</label>
                <input
                  {...register("masaKerja")}
                  placeholder="Terhitung otomatis"
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Tanggal Berkala Terakhir</label>
                <input
                  type="date"
                  {...register("tanggalBerkalaTerakhir")}
                  className={input}
                />
                <p className="text-[10px] text-slate-400">
                  Dasar prediksi KGB (indikatif)
                </p>
              </div>
              <div className="space-y-1.5">
                <label className={label}>TMT KP manual (opsional)</label>
                <input
                  type="date"
                  {...register("tmtKp")}
                  className={input}
                />
                <p className="text-[10px] text-slate-400">
                  Override dasar prediksi KP (+4 th). Kosong = TMT golongan.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className={label}>BUP / pensiun manual (opsional)</label>
                <input
                  type="date"
                  {...register("bupTanggal")}
                  className={input}
                />
                <p className="text-[10px] text-slate-400">
                  Override TMT pensiun. Kosong = hitung dari tgl lahir + jabatan.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className={label}>Gaji Pokok</label>
                <input
                  {...register("gajiPokok")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Besaran Gaji Kotor</label>
                <input
                  {...register("besaranGajiKotor")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Digaji Menurut PP/SK</label>
                <input
                  {...register("digajiMenurut")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>No. Rekening Bank</label>
                <input
                  {...register("noRekeningBank")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>NPWP</label>
                <input
                  {...register("npwp")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Nomor Karpeg</label>
                <input
                  {...register("nomorKarpeg")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>TMT Pensiun (tampil, indikatif)</label>
                <input
                  {...register("pensiun")}
                  placeholder="Hitung otomatis / dari BUP manual"
                  className={`${input} bg-slate-50`}
                  readOnly
                />
                <p className="text-[10px] text-slate-400">
                  Bukan field legal — isi &quot;BUP manual&quot; di atas jika perlu override.
                </p>
              </div>
            </div>
          </div>

        {/* Tab 4: Keluarga & Cuti */}
        <div className={activeTab === 4 ? "space-y-6 block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className={label}>Sisa Cuti N</label>
                <input
                  {...register("sisaCutiN")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Sisa Cuti N-1</label>
                <input
                  {...register("sisaCutiN1")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Sisa Cuti N-2</label>
                <input
                  {...register("sisaCutiN2")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Jumlah Tertanggung</label>
                <input
                  type="number"
                  {...register("jumlahTertanggung", { valueAsNumber: true })}
                  className={input}
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6 mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Susunan Anggota Keluarga</h3>
                <button
                  type="button"
                  onClick={() =>
                    append({
                      name: "",
                      relation: "Istri",
                      birthDate: "",
                      marriageDate: "",
                      occupation: "",
                      description: "",
                    })
                  }
                  className="flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" /> Tambah Anggota
                </button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="p-4 sm:p-5 border border-slate-200 rounded-lg bg-slate-50/50 space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                        Anggota #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
<label className="text-xs font-medium text-slate-500">Nama</label>
                        <input
                          {...register(`dataKeluarga.${index}.name` as const, { required: true })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500">Hubungan</label>
                        <select
                          {...register(`dataKeluarga.${index}.relation` as const)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                        >
                          <option value="Istri">Istri</option>
                          <option value="Suami">Suami</option>
                          <option value="Anak">Anak</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500">Tanggal Lahir</label>
                        <input
                          type="date"
                          {...register(`dataKeluarga.${index}.birthDate` as const)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500">Tanggal Perkawinan (Jika Ada)</label>
                        <input
                          type="date"
                          {...register(`dataKeluarga.${index}.marriageDate` as const)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500">Pekerjaan</label>
                        <input
                          {...register(`dataKeluarga.${index}.occupation` as const)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                        />
                      </div>
                      <div className="space-y-1 lg:col-span-3">
<label className="text-xs font-medium text-slate-500">Keterangan</label>
                        <input
                          {...register(`dataKeluarga.${index}.description` as const)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {fields.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-lg text-sm text-slate-400">
                    Belum ada data keluarga yang ditambahkan.
                  </div>
                )}
              </div>
            </div>
          </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-6 border-t border-slate-100">
        <div className="flex gap-2">
          {activeTab > 1 && (
            <button
              type="button"
              onClick={() => setActiveTab(activeTab - 1)}
              disabled={busy}
              className={`${btnSecondary} px-5 py-2.5 text-sm`}
            >
              Kembali
            </button>
          )}
          <button
            type="button"
            onClick={requestCancel}
            disabled={busy}
            className={`${btnSecondary} px-5 py-2.5 text-sm`}
          >
            Batal
          </button>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {activeTab < 4 && (
            <button
              type="button"
              onClick={() => setActiveTab(activeTab + 1)}
              disabled={busy}
              className={`${btnSecondary} px-5 py-2.5 text-sm`}
            >
              Selanjutnya
            </button>
          )}
          {/* Simpan always available — operator need not reach step 4 to save */}
          <button
            type="submit"
            disabled={busy}
            className={`${btnPrimary} px-5 py-2.5 text-sm min-w-[7.5rem]`}
          >
            {busy ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Menyimpan…
              </>
            ) : (
              "Simpan"
            )}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Buang perubahan?"
        description="Ada perubahan yang belum disimpan. Tutup formulir ini?"
        confirmLabel="Buang & tutup"
        cancelLabel="Tetap mengisi"
        variant="danger"
        onConfirm={() => {
          setDiscardOpen(false);
          onCancel();
        }}
      />
    </form>
  );
}

