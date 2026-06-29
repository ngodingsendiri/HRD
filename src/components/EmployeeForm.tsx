import { useForm, useFieldArray } from "react-hook-form";
import { Employee, AppSettings } from "../types";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";

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
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
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
      pangkat: "",
      gol: "",
      pangkatGolongan: "",
      tanggalBerkalaTerakhir: "",
      gajiPokok: "",
      besaranGajiKotor: "",
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
    if (!settings?.jabatanKamusCsv || !jabatan) return;

    // Parse kamus
    const rows = settings.jabatanKamusCsv.split("\n");
    let matchedKelas = "";
    let matchedBeban = "";

    for (const row of rows) {
      if (!row || row.trim() === "") continue;
      // split by ; or tab
      const cols = row.split(/;|\t/);
      if (cols.length >= 4) {
        // Assume format: No;Jabatan;Kelas;Beban Kerja
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
  }, [jabatan, settings?.jabatanKamusCsv, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Section 1: Identitas Pribadi */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">
          Data Diri Aparatur
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">NIP</label>
            <input
              {...register("nip")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">NIK *</label>
            <input
              {...register("nik", { required: true })}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Nama Lengkap (Sesuai KTP) *
            </label>
            <input
              {...register("nama", { required: true })}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Jenis Kelamin
            </label>
            <select
              {...register("jk")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            >
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Kota / Kab. Kelahiran
            </label>
            <input
              {...register("tempatLahir")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Tanggal Lahir
            </label>
            <input
              {...register("tanggalLahir")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Agama</label>
            <input
              {...register("agama")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Status Kawin
            </label>
            <input
              {...register("statusKawin")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Nomor HP
            </label>
            <input
              {...register("nomorHp")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Alamat */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">
          Informasi Alamat & Domisili
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">
              Alamat Lengkap (Jalan/Dusun)
            </label>
            <input
              {...register("jalanDusun")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">RT</label>
              <input
                {...register("rt")}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">RW</label>
              <input
                {...register("rw")}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Desa / Kelurahan
            </label>
            <input
              {...register("desaKelurahan")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Kecamatan
            </label>
            <input
              {...register("kecamatan")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Kabupaten
            </label>
            <input
              {...register("kabupaten")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Kepegawaian */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">
          Informasi Jabatan & Penempatan
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Status Hubungan Kerja
            </label>
            <select
              {...register("status")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            >
              <option value="PNS">PNS</option>
              <option value="PPPK">PPPK</option>
              <option value="Honorer">Honorer</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Jabatan
            </label>
            <select
              {...register("jabatan")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all cursor-pointer"
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
            <label className="text-sm font-medium text-slate-700">
              Unit Kerja / Bidang
            </label>
            <select
              {...register("bidang")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all cursor-pointer"
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
            <label className="text-sm font-medium text-slate-700">
              Kelas Jabatan
            </label>
            <input
              {...register("kelasJabatan")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all cursor-not-allowed text-slate-500"
              placeholder="Otomatis dari Kamus"
              readOnly
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Beban Kerja
            </label>
            <input
              {...register("bebanKerja")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all cursor-not-allowed text-slate-500"
              placeholder="Otomatis dari Kamus"
              readOnly
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Pangkat
            </label>
            <input
              {...register("pangkat")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Golongan
            </label>
            <input
              {...register("gol")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              TMT Golongan
            </label>
            <input
              {...register("tmtGolonganRuang")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              TMT Kerja
            </label>
            <input
              {...register("tmtKerja")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Masa Kerja
            </label>
            <input
              {...register("masaKerja")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Pensiun
            </label>
            <input
              {...register("pensiun")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Gaji Pokok
            </label>
            <input
              {...register("gajiPokok")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Besaran Gaji Kotor
            </label>
            <input
              {...register("besaranGajiKotor")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Nomor Karpeg
            </label>
            <input
              {...register("nomorKarpeg")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Section 4: Pendidikan & Diklat */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">
          Riwayat Pendidikan & Pelatihan
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Pendidikan Terakhir
            </label>
            <input
              {...register("pendidikan")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Jurusan
            </label>
            <input
              {...register("jurusan")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Diklat Jenjang
            </label>
            <input
              {...register("diklatJenjang")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Tahun Diklat
            </label>
            <input
              {...register("tahunDiklat")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Section 6: Lain-lain */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">
          Rekam Jejak & Administrasi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Sisa Cuti N
            </label>
            <input
              {...register("sisaCutiN")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Sisa Cuti N-1
            </label>
            <input
              {...register("sisaCutiN1")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Sisa Cuti N-2
            </label>
            <input
              {...register("sisaCutiN2")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">
              SK Terakhir
            </label>
            <input
              {...register("skTerakhir")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Jumlah Tertanggung
            </label>
            <input
              type="number"
              {...register("jumlahTertanggung")}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Section 7: Data Keluarga */}
      <div className="border-t border-slate-100 pt-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Susunan Anggota Keluarga
          </h3>
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
              className="p-4 sm:p-5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-4"
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">
                    Nama
                  </label>
                  <input
                    {...register(`dataKeluarga.${index}.name` as const, {
                      required: true,
                    })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">
                    Hubungan
                  </label>
                  <select
                    {...register(`dataKeluarga.${index}.relation` as const)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                  >
                    <option value="Istri">Istri</option>
                    <option value="Suami">Suami</option>
                    <option value="Anak">Anak</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">
                    Tanggal Lahir
                  </label>
                  <input
                    {...register(`dataKeluarga.${index}.birthDate` as const)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">
                    Tanggal Perkawinan (Jika Ada)
                  </label>
                  <input
                    {...register(`dataKeluarga.${index}.marriageDate` as const)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">
                    Pekerjaan
                  </label>
                  <input
                    {...register(`dataKeluarga.${index}.occupation` as const)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">
                    Keterangan
                  </label>
                  <input
                    {...register(`dataKeluarga.${index}.description` as const)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>
            </div>
          ))}
          {fields.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl text-sm text-slate-400">
              Belum ada data keluarga yang ditambahkan.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all "
        >
          Batal
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-all "
        >
          Simpan Rekam Data
        </button>
      </div>
    </form>
  );
}
