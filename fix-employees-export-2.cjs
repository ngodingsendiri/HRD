const fs = require('fs');

let content = fs.readFileSync('src/pages/Employees.tsx', 'utf8');

const handleExportNew = `  const handleExport = () => {
    const today = new Date();
    const exportData = employees.map(
      ({ id, dataKeluarga, createdAt, updatedAt, ...rest }) => {
        let usia = "";
        let tmtPensiun = rest.pensiun;
        if (rest.tanggalLahir) {
          const birth = new Date(rest.tanggalLahir);
          if (!isNaN(birth.getTime())) {
            const ageDate = new Date(today.getTime() - birth.getTime());
            usia = String(Math.abs(ageDate.getUTCFullYear() - 1970));
            
            if (!tmtPensiun) {
              const pensiunDate = new Date(birth);
              const pensiunAge = String(rest.jabatan).toLowerCase().includes('guru') || String(rest.jabatan).toLowerCase().includes('medis') ? 60 : 58;
              pensiunDate.setFullYear(pensiunDate.getFullYear() + pensiunAge);
              tmtPensiun = pensiunDate.toISOString().split("T")[0];
            }
          }
        }

        let nextKgb = "";
        if (rest.tanggalBerkalaTerakhir) {
           const d = new Date(rest.tanggalBerkalaTerakhir);
           if (!isNaN(d.getTime())) {
             d.setFullYear(d.getFullYear() + 2);
             nextKgb = d.toISOString().split("T")[0];
           }
        }
        
        let nextKp = "";
        if (rest.tmtGolonganRuang) {
           const d = new Date(rest.tmtGolonganRuang);
           if (!isNaN(d.getTime())) {
             d.setFullYear(d.getFullYear() + 4);
             nextKp = d.toISOString().split("T")[0];
           }
        }

        return {
          Nama: rest.nama,
          "N I P": rest.nip,
          "N I K": rest.nik,
          JK: rest.jk,
          "Tempat Lahir": rest.tempatLahir,
          "Tanggal Lahir": rest.tanggalLahir,
          "Usia": usia,
          "Jalan/Dusun": rest.jalanDusun,
          RT: rest.rt,
          RW: rest.rw,
          "Desa/Kelurahan": rest.desaKelurahan,
          Kecamatan: rest.kecamatan,
          Kabupaten: rest.kabupaten,
          "kelas jabatan": rest.kelasJabatan,
          "beban kerja": rest.bebanKerja,
          "TMT Kerja": rest.tmtKerja,
          "Masa Kerja": rest.masaKerja,
          "Pensiun (BUP)": tmtPensiun,
          "TMT Golongan Ruang": rest.tmtGolonganRuang,
          "Masa Kerja Golongan Ruang": rest.masaKerjaGolonganRuang,
          "Prediksi Kenaikan Pangkat (KP)": nextKp,
          "No. Rekening Bank": rest.noRekeningBank,
          NPWP: rest.npwp,
          Pangkat: rest.pangkat,
          Gol: rest.gol,
          "Tanggal Berkala Terakhir": rest.tanggalBerkalaTerakhir,
          "Prediksi Kenaikan Gaji Berkala (KGB)": nextKgb,
          "Gaji Pokok": rest.gajiPokok,
          "Besaran Gaji Kotor": rest.besaranGajiKotor,
          "Digaji Menurut PP/SK": rest.digajiMenurut,
          Jabatan: rest.jabatan,
          Bidang: rest.bidang,
          Status: rest.status,
          "Nomor Karpeg": rest.nomorKarpeg,
          Pendidikan: rest.pendidikan,
          Jurusan: rest.jurusan,
          "Diklat Jenjang": rest.diklatJenjang,
          "Tahun Diklat": rest.tahunDiklat,
          "Status Kawin": rest.statusKawin,
          Agama: rest.agama,
          "Nomor HP": rest.nomorHp,
          "Sisa Cuti Tahunan N": rest.sisaCutiN,
          "Sisa Cuti Tahunan N1": rest.sisaCutiN1,
          "Sisa Cuti Tahunan N2": rest.sisaCutiN2,
          "SK Terakhir Yang Dimiliki": rest.skTerakhir,
          "Nama Istri/Suami":
            dataKeluarga?.find(
              (k: any) => k.relation === "Istri" || k.relation === "Suami",
            )?.name || "",
          "Tanggal Lahir Pasangan":
            dataKeluarga?.find(
              (k: any) => k.relation === "Istri" || k.relation === "Suami",
            )?.birthDate || "",
          "Perkawinan Pasangan":
            dataKeluarga?.find(
              (k: any) => k.relation === "Istri" || k.relation === "Suami",
            )?.marriageDate || "",
          "Pekerjaan Pasangan":
            dataKeluarga?.find(
              (k: any) => k.relation === "Istri" || k.relation === "Suami",
            )?.occupation || "",
          "Keterangan Pasangan":
            dataKeluarga?.find(
              (k: any) => k.relation === "Istri" || k.relation === "Suami",
            )?.description || "",
          "Nama Anak 1":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[0]?.name ||
            "",
          "Tanggal Lahir Anak 1":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[0]
              ?.birthDate || "",
          "Perkawinan Anak 1":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[0]
              ?.marriageDate || "",
          "Pekerjaan Anak 1":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[0]
              ?.occupation || "",
          "Keterangan Anak 1":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[0]
              ?.description || "",
          "Nama Anak 2":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[1]?.name ||
            "",
          "Tanggal Lahir Anak 2":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[1]
              ?.birthDate || "",
          "Perkawinan Anak 2":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[1]
              ?.marriageDate || "",
          "Pekerjaan Anak 2":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[1]
              ?.occupation || "",
          "Keterangan Anak 2":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[1]
              ?.description || "",
          "Nama Anak 3":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[2]?.name ||
            "",
          "Tanggal Lahir Anak 3":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[2]
              ?.birthDate || "",
          "Perkawinan Anak 3":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[2]
              ?.marriageDate || "",
          "Pekerjaan Anak 3":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[2]
              ?.occupation || "",
          "Keterangan Anak 3":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[2]
              ?.description || "",
          "Nama Anak 4":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[3]?.name ||
            "",
          "Tanggal Lahir Anak 4":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[3]
              ?.birthDate || "",
          "Perkawinan Anak 4":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[3]
              ?.marriageDate || "",
          "Pekerjaan Anak 4":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[3]
              ?.occupation || "",
          "Keterangan Anak 4":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[3]
              ?.description || "",
          "Nama Anak 5":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[4]?.name ||
            "",
          "Tanggal Lahir Anak 5":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[4]
              ?.birthDate || "",
          "Perkawinan Anak 5":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[4]
              ?.marriageDate || "",
          "Pekerjaan Anak 5":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[4]
              ?.occupation || "",
          "Keterangan Anak 5":
            dataKeluarga?.filter((k: any) => k.relation === "Anak")[4]
              ?.description || "",
          "Jumlah Tertanggung": rest.jumlahTertanggung,
        };
      },
    );`;

const regexExport = /const handleExport = \(\) => \{[\s\S]*?"Jumlah Tertanggung": rest\.jumlahTertanggung,\s*\};\s*\},\s*\);/g;

if (!regexExport.test(content)) {
  console.log('REGEX FAILED to match handleExport');
} else {
  content = content.replace(regexExport, handleExportNew);
  console.log('handleExport Replaced');
}

fs.writeFileSync('src/pages/Employees.tsx', content);

