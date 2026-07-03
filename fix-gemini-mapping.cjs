const fs = require('fs');

let content = fs.readFileSync('api/gemini.ts', 'utf8');

const promptMapHeaders = ` I have an Excel file with the following column headers: [\${headers.join(", ")}]. I need to map these headers to the following internal field names for an employee management system:
- nik (Nomor Induk Kependudukan)
- nama (Nama Lengkap)
- nip (Nomor Induk Pegawai)
- jk (Jenis Kelamin: L/P)
- tempatLahir (Tempat Lahir)
- tanggalLahir (Tanggal Lahir)
- jalanDusun (Jalan / Dusun)
- rt (RT)
- rw (RW)
- desaKelurahan (Desa / Kelurahan)
- kecamatan (Kecamatan)
- kabupaten (Kabupaten / Kota)
- kelasJabatan (Kelas Jabatan)
- bebanKerja (Beban Kerja)
- tmtKerja (TMT Kerja)
- masaKerja (Masa Kerja)
- pensiun (TMT Pensiun / BUP)
- tmtGolonganRuang (TMT Golongan Ruang)
- masaKerjaGolonganRuang (Masa Kerja Golongan Ruang / MKG)
- noRekeningBank (No. Rekening Bank)
- npwp (NPWP)
- pangkat (Pangkat)
- gol (Golongan)
- tanggalBerkalaTerakhir (Tanggal Berkala Terakhir)
- gajiPokok (Gaji Pokok)
- besaranGajiKotor (Besaran Gaji Kotor)
- digajiMenurut (Digaji Menurut PP/SK)
- jabatan (Jabatan)
- bidang (Bidang / Unit Kerja)
- status (Status: PNS, CPNS, PPPK, dll)
- nomorKarpeg (Nomor Karpeg)
- pendidikan (Pendidikan)
- jurusan (Jurusan)
- diklatJenjang (Diklat Jenjang)
- tahunDiklat (Tahun Diklat)
- statusKawin (Status Perkawinan)
- agama (Agama)
- nomorHp (Nomor HP)
- sisaCutiN (Sisa Cuti N)
- sisaCutiN1 (Sisa Cuti N-1)
- sisaCutiN2 (Sisa Cuti N-2)
- skTerakhir (SK Terakhir)
- jumlahTertanggung (Jumlah Tertanggung)

CRITICAL INSTRUCTIONS:
1. Be extremely careful with NIK and NIP. They are different.
2. "Nama" or "Nama Lengkap" must map to "nama".
3. If a header is "No" or "No.", DO NOT map it to anything.
4. Return ONLY a JSON object where the keys are the EXACT Excel headers from the list above and the values are the corresponding internal field names.
5. If you are unsure, do not map that header.
`;

// Replace prompt for map-headers
content = content.replace(/const prompt = ` I have an Excel file[\s\S]*?If you are unsure, do not map that header\. `;/g, 'const prompt = `' + promptMapHeaders + '`;');

// We also should update extract-text and extract-file schemas
const schemaProperties = `
              nik: { type: Type.STRING },
              nama: { type: Type.STRING },
              nip: { type: Type.STRING },
              jk: { type: Type.STRING, enum: ["L", "P"] as any[] },
              tempatLahir: { type: Type.STRING },
              tanggalLahir: { type: Type.STRING },
              jalanDusun: { type: Type.STRING },
              rt: { type: Type.STRING },
              rw: { type: Type.STRING },
              desaKelurahan: { type: Type.STRING },
              kecamatan: { type: Type.STRING },
              kabupaten: { type: Type.STRING },
              kelasJabatan: { type: Type.STRING },
              bebanKerja: { type: Type.STRING },
              tmtKerja: { type: Type.STRING },
              masaKerja: { type: Type.STRING },
              pensiun: { type: Type.STRING },
              tmtGolonganRuang: { type: Type.STRING },
              masaKerjaGolonganRuang: { type: Type.STRING },
              noRekeningBank: { type: Type.STRING },
              npwp: { type: Type.STRING },
              pangkat: { type: Type.STRING },
              gol: { type: Type.STRING },
              tanggalBerkalaTerakhir: { type: Type.STRING },
              gajiPokok: { type: Type.STRING },
              besaranGajiKotor: { type: Type.STRING },
              digajiMenurut: { type: Type.STRING },
              jabatan: { type: Type.STRING },
              bidang: { type: Type.STRING },
              status: { type: Type.STRING, enum: ["PNS", "CPNS", "PPPK", "PPPKPW", "Honorer", "Lainnya"] as any[] },
              nomorKarpeg: { type: Type.STRING },
              pendidikan: { type: Type.STRING },
              jurusan: { type: Type.STRING },
              diklatJenjang: { type: Type.STRING },
              tahunDiklat: { type: Type.STRING },
              statusKawin: { type: Type.STRING },
              agama: { type: Type.STRING },
              nomorHp: { type: Type.STRING },
              sisaCutiN: { type: Type.STRING },
              sisaCutiN1: { type: Type.STRING },
              sisaCutiN2: { type: Type.STRING },
              skTerakhir: { type: Type.STRING },
              jumlahTertanggung: { type: Type.NUMBER },
`;

content = content.replace(/properties: \{[\s\S]*?jurusan: \{ type: Type\.STRING \},\s*\}/g, 'properties: {' + schemaProperties + '}');

fs.writeFileSync('api/gemini.ts', content);
console.log('Updated api/gemini.ts');
