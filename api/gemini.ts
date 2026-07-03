import { GoogleGenAI, Type } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

const getAiClient = (): GoogleGenAI => {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set on the server.");
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey || "dummy-key" });
  }
  return aiClient;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { action, payload } = req.body;
    const client = getAiClient();

    if (action === "extract-text") {
      const { textData } = payload;
      const prompt = `
 Extract employee information from the provided text data (this is data parsed from an Excel/CSV file that didn't match the template).
 Map the extracted data to the following JSON structure. 
 If a field is not found, leave it as an empty string or null.
 For 'jk', use 'L' for Male and 'P' for Female.
 For 'status', use one of: 'PNS', 'PPPK', 'Honorer', 'Lainnya'.
 For dates, use YYYY-MM-DD format if possible.

 Data to extract from:
 ${textData}
 `;

      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
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
},
          },
        },
      });

      return res.status(200).json({ text: response.text });
    } else if (action === "extract-file") {
      const { fileData, mimeType } = payload;
      const prompt = `
 Extract employee information from the provided file (it could be an image of a KTP, an SK document, or an Excel/table screenshot).
 Map the extracted data to the following JSON structure. 
 If a field is not found, leave it as an empty string or null.
 For 'jk', use 'L' for Male and 'P' for Female.
 For 'status', use one of: 'PNS', 'PPPK', 'Honorer', 'Lainnya'.
 For dates, use YYYY-MM-DD format if possible.
 `;

      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: fileData,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
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
},
          },
        },
      });

      return res.status(200).json({ text: response.text });
    } else if (action === "map-headers") {
      const { headers } = payload;
      const prompt = `
 I have an Excel file with the following column headers: [${headers.join(", ")}].
 I need to map these headers to the following internal field names for an employee management system:
 - nik (Nomor Induk Kependudukan / Identity Number - usually 16 digits)
 - nama (Full Name / Nama Lengkap)
 - nip (Nomor Induk Pegawai / Employee ID - usually 18 digits)
 - jk (Jenis Kelamin / Gender / L/P)
 - tempatLahir (Place of Birth)
 - tanggalLahir (Date of Birth)
 - jabatan (Position / Job Title)
 - bidang (Department / Division / Unit Kerja)
 - status (Employment Status: PNS, PPPK, Honorer)
 - nomorHp (Phone Number / No HP)
 - pendidikan (Education / Jenjang Pendidikan)
 - agama (Religion)
 - alamatLengkap (Full Address / Alamat)

 CRITICAL INSTRUCTIONS:
 1. Be extremely careful with NIK and NIP. They are different.
 2. "Nama" or "Nama Lengkap" must map to "nama".
 3. If a header is "No" or "No.", DO NOT map it to anything.
 4. Return ONLY a JSON object where the keys are the EXACT Excel headers from the list above and the values are the corresponding internal field names.
 5. If you are unsure, do not map that header.
 `;

      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
        },
      });

      return res.status(200).json({ text: response.text });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err: any) {
    console.error("API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
