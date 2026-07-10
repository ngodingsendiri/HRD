import { useForm, useFieldArray } from "react-hook-form";
import { Employee, AppSettings } from "../types";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { validateAndExtractNIP, calculateBUP, calculateMasaKerja } from "../lib/employeeUtils";
import { btnPrimary, btnSecondary, input, label } from "../lib/ui";

interface EmployeeFormProps {
  initialData?: Employee;
  settings?: AppSettings | null;
  onSubmit: (data: Employee) => void;
  onCancel: () => void;
}

export function EmployeeForm({
  initialData,
  settings,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const [activeTab, setActiveTab] = useState(1);
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, dirtyFields },
  } = useForm<Employee>({
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
      if (matchedKelas)
        setValue("kelasJabatan", matchedKelas, { shouldDirty: true });
      if (matchedBeban)
        setValue("bebanKerja", matchedBeban, { shouldDirty: true });
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

  useEffect(() => {
    if (tanggalLahir && jabatan && (dirtyFields.tanggalLahir || dirtyFields.jabatan)) {
      const calculatedPensiun = calculateBUP(tanggalLahir, jabatan);
      if (calculatedPensiun) {
        setValue("pensiun", calculatedPensiun, { shouldDirty: true });
      }
    }
  }, [tanggalLahir, jabatan, setValue, dirtyFields.tanggalLahir, dirtyFields.jabatan]);

  useEffect(() => {
    if (tmtKerja && dirtyFields.tmtKerja) {
      const calculatedMasaKerja = calculateMasaKerja(tmtKerja);
      if (calculatedMasaKerja) {
        setValue("masaKerja", calculatedMasaKerja, { shouldDirty: true });
      }
    }
  }, [tmtKerja, setValue, dirtyFields.tmtKerja]);

  useEffect(() => {
    if (tmtGolonganRuang && dirtyFields.tmtGolonganRuang) {
      const calculatedMKG = calculateMasaKerja(tmtGolonganRuang);
      if (calculatedMKG) {
        setValue("masaKerjaGolonganRuang", calculatedMKG, { shouldDirty: true });
      }
    }
  }, [tmtGolonganRuang, setValue, dirtyFields.tmtGolonganRuang]);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      if (errors.nik || errors.nama) {
        setActiveTab(1);
      } else if (errors.dataKeluarga) {
        setActiveTab(4);
      }
    }
  }, [errors]);

  const tabs = [
    { id: 1, label: "Identitas Pribadi" },
    { id: 2, label: "Jabatan & Penempatan" },
    { id: 3, label: "Kepangkatan & Gaji" },
    { id: 4, label: "Keluarga & Lainnya" },
  ];

  return (
    <form onSubmit={handleSubmit((data) => {
      let combined = `${data.pangkat || ""} / ${data.gol || ""}`.trim();
      if (combined === "/") combined = "";
      data.pangkatGolongan = combined;
      onSubmit(data);
    })} className="space-y-6">
      
      {/* Navigation Tabs */}
      <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all active:scale-95 ${
              activeTab === tab.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="h-[60vh] sm:h-[65vh] overflow-y-auto pr-2 pb-4 space-y-6">
        {/* Tab 1: Identitas Pribadi */}
        <div className={activeTab === 1 ? "space-y-6 block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className={label}>NIP</label>
                <input
                  {...register("nip")}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>NIK *</label>
                <input
                  {...register("nik", { required: true })}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Nama Lengkap (Sesuai KTP) *</label>
                <input
                  {...register("nama", { required: true })}
                  className={input}
                />
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
                  {...register("gol")}
                  className={input}
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
                <label className={label}>TMT Pensiun (BUP)</label>
                <input
                  {...register("pensiun")}
                  placeholder="Terhitung otomatis"
                  className={input}
                />
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

      <div className="flex justify-between pt-6 border-t border-slate-100">
        <div>
          {activeTab > 1 && (
            <button
              type="button"
              onClick={() => setActiveTab(activeTab - 1)}
              className={`${btnSecondary} px-5 py-2.5 text-sm`}
            >
              Kembali
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={`${btnSecondary} px-5 py-2.5 text-sm`}
          >
            Batal
          </button>
          {activeTab < 4 ? (
            <button
              type="button"
              onClick={() => setActiveTab(activeTab + 1)}
              className={`${btnSecondary} px-5 py-2.5 text-sm bg-slate-50`}
            >
              Selanjutnya
            </button>
          ) : (
            <button type="submit" className={`${btnPrimary} px-5 py-2.5 text-sm`}>
              Simpan Rekam Data
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

