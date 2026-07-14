import type { Employee } from "../../types";
import { matchesCutiJenisNumber } from "../../lib/printParams";

export type CutiSisaSnapshot = { n: string; n1: string; n2: string };

export type PrintCutiDocumentProps = {
  employees: Employee[];
  cutiEmployeeId: string;
  cutiJenis: string;
  cutiAlasan: string;
  cutiLamaHari: number;
  cutiMulai: string;
  cutiAkhir: string;
  cutiAlamat: string;
  cutiHp: string;
  cutiMasaKerja: string;
  cutiSisaPrint: CutiSisaSnapshot | null;
  getHierarchy: (emp?: Employee) => {
    atasan: string;
    nipAtasan: string;
    pejabat: string;
    nipPejabat: string;
  };
  formatDateId: (d?: string) => string;
};

export function PrintCutiDocument({
  employees,
  cutiEmployeeId,
  cutiJenis,
  cutiAlasan,
  cutiLamaHari,
  cutiMulai,
  cutiAkhir,
  cutiAlamat,
  cutiHp,
  cutiMasaKerja,
  cutiSisaPrint,
  getHierarchy,
  formatDateId,
}: PrintCutiDocumentProps) {

              const emp = employees.find((e) => e.id === cutiEmployeeId);
              const hierarchy = getHierarchy(emp);

              const listJenis = [
                "1. Cuti Tahunan",
                "4. Cuti Melahirkan",
                "2. Cuti Besar",
                "5. Cuti Karena Alasan Penting",
                "3. Cuti Sakit",
                "6. Cuti di Luar Tanggungan Negara",
              ];

              return (
                <div className="text-[11pt] leading-tight text-black relative pt-[40px]">
                  {/* Top Right Header Context */}
                  <div className="absolute top-0 right-0 text-[10pt] w-[400px]">
                    <p>ANAK LAMPIRAN 1.b</p>
                    <p>PERATURAN BADAN KEPEGAWAIAN NEGARA REPUBLIK INDONESIA</p>
                    <p>NOMOR 24 TAHUN 2017</p>
                    <p>TENTANG TATA CARA PEMBERIAN CUTI PEGAWAI NEGERI SIPIL</p>
                  </div>

                  <div className="mt-28 flex justify-end">
                    <div className="w-[350px]">
                      <p>
                        Jember,{" "}
                        {new Date().toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <p>Kepada Yth.</p>
                      <p>{hierarchy.pejabat}</p>
                      <p>di</p>
                      <p className="ml-8 underline">Jember</p>
                    </div>
                  </div>

                  <h1 className="text-center font-bold text-[12pt] mt-8 mb-4">
                    FORMULIR PERMINTAAN DAN PEMBERIAN CUTI
                  </h1>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">I. DATA PEGAWAI</div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5 w-[15%]">
                          Nama
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[35%]">
                          {emp?.nama || "-"}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[15%]">
                          NIP
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[35%]">
                          {emp?.nip || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5">
                          Jabatan
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          {emp?.jabatan || "-"}
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          Pangkat/Gol.
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          {emp?.pangkatGolongan || " - "}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5">
                          Unit Kerja
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          {emp?.bidang || "-"}
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          Masa Kerja
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          {cutiMasaKerja}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">
                      II. JENIS CUTI YANG DIAMBIL **
                    </div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3 text-[10.5pt]">
                    <tbody>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[0]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {matchesCutiJenisNumber(cutiJenis, 1) ? "✓" : ""}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[1]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {matchesCutiJenisNumber(cutiJenis, 4) ? "✓" : ""}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[2]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {matchesCutiJenisNumber(cutiJenis, 2) ? "✓" : ""}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[3]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {matchesCutiJenisNumber(cutiJenis, 5) ? "✓" : ""}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[4]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {matchesCutiJenisNumber(cutiJenis, 3) ? "✓" : ""}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[40%]">
                          {listJenis[5]}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[10%] text-center">
                          {matchesCutiJenisNumber(cutiJenis, 6) ? "✓" : ""}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">III. ALASAN CUTI</div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td className="px-1.5 py-1.5 min-h-[30px]">
                          {cutiAlasan || "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">IV. LAMANYA CUTI</div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td className="border-r border-black px-1.5 py-0.5 w-[30%]">
                          Selama {cutiLamaHari} Hari
                          <s>/Bulan/Tahun</s>
                        </td>
                        <td className="px-1.5 py-0.5">
                          Mulai tanggal{" "}
                          <span className="mx-2">
                            {cutiMulai ? formatDateId(cutiMulai) : "-"}
                          </span>{" "}
                          s/d{" "}
                          <span className="mx-2">
                            {cutiAkhir ? formatDateId(cutiAkhir) : "-"}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">V. CATATAN CUTI ***</div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3 text-[10.5pt]">
                    <tbody>
                      <tr>
                        <td
                          colSpan={3}
                          className="border border-black px-1.5 py-0.5 w-[50%]"
                        >
                          1. Cuti Tahunan
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[35%]">
                          2. Cuti Besar
                        </td>
                        <td className="border border-black px-1.5 py-0.5 w-[15%]"></td>
                      </tr>
                      <tr>
                        <td className="border border-black text-center w-[15%]">
                          Tahun
                        </td>
                        <td className="border border-black text-center w-[15%]">
                          Sisa
                        </td>
                        <td className="border border-black text-center w-[20%]">
                          Keterangan
                        </td>
                        <td className="border border-black px-1.5 py-0.5">
                          3. Cuti Sakit
                        </td>
                        <td className="border border-black px-1.5 py-0.5"></td>
                      </tr>
                      <tr>
                        <td className="border border-black text-center">N-2</td>
                        <td className="border border-black text-center">
                          {cutiSisaPrint?.n2 ?? emp?.sisaCutiN2 ?? "-"}
                        </td>
                        <td className="border border-black text-center"></td>
                        <td className="border border-black px-1.5 py-0.5">
                          4. Cuti Melahirkan
                        </td>
                        <td className="border border-black px-1.5 py-0.5"></td>
                      </tr>
                      <tr>
                        <td className="border border-black text-center">N-1</td>
                        <td className="border border-black text-center">
                          {cutiSisaPrint?.n1 ?? emp?.sisaCutiN1 ?? "-"}
                        </td>
                        <td className="border border-black text-center"></td>
                        <td className="border border-black px-1.5 py-0.5">
                          5. Cuti Karena Alasan Penting
                        </td>
                        <td className="border border-black px-1.5 py-0.5"></td>
                      </tr>
                      <tr>
                        <td className="border border-black text-center">N</td>
                        <td className="border border-black text-center">
                          {cutiSisaPrint?.n ?? emp?.sisaCutiN ?? "-"}
                        </td>
                        <td className="border border-black text-center"></td>
                        <td className="border border-black px-1.5 py-0.5">
                          6. Cuti di Luar Tanggungan Negara
                        </td>
                        <td className="border border-black px-1.5 py-0.5"></td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">
                      VI. ALAMAT SELAMA MENJALANKAN CUTI
                    </div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td className="border border-black text-center p-1 font-bold w-[45%]">
                          Alamat Lengkap
                        </td>
                        <td className="border border-black text-center p-1 font-bold w-[25%]">
                          Nomor HP
                        </td>
                        <td
                          colSpan={2}
                          className="border border-black text-center p-1.5 font-bold w-[30%]"
                        >
                          Hormat Saya,
                        </td>
                      </tr>
                      <tr>
                        <td
                          className="border border-black align-top p-1"
                          rowSpan={3}
                        >
                          {cutiAlamat}
                        </td>
                        <td
                          className="border border-black align-top p-1 text-center"
                          rowSpan={3}
                        >
                          {cutiHp}
                        </td>
                        <td
                          colSpan={2}
                          className="border-r border-black p-1 h-[60px]"
                        ></td>
                      </tr>
                      <tr>
                        <td
                          colSpan={2}
                          className="border-r border-black p-0 h-[10px]"
                        ></td>
                      </tr>
                      <tr>
                        <td
                          colSpan={2}
                          className="border-r border-black p-1 text-center h-[20px]"
                        >
                          {emp?.nama || "-"}
                          <br />
                          NIP. {emp?.nip || "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">
                      VII. PERTIMBANGAN ATASAN LANGSUNG **
                    </div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td className="border border-black text-center p-0.5">
                          Disetujui
                        </td>
                        <td className="border border-black text-center p-0.5">
                          Perubahan ****
                        </td>
                        <td className="border border-black text-center p-0.5">
                          Ditangguhkan ****
                        </td>
                        <td
                          colSpan={2}
                          className="border border-black text-center p-0.5"
                        >
                          Tidak Disetujui ****
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black h-[20px]"></td>
                        <td className="border border-black h-[20px]"></td>
                        <td className="border border-black h-[20px]"></td>
                        <td
                          colSpan={2}
                          className="border border-black h-[20px]"
                        ></td>
                      </tr>
                      <tr>
                        <td
                          colSpan={3}
                          className="border border-black border-r-0"
                        ></td>
                        <td
                          colSpan={2}
                          className="border border-black border-l-0 text-center py-6 align-bottom"
                        >
                          {hierarchy.atasan}
                          <br />
                          NIP. {hierarchy.nipAtasan}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black mb-1 p-0 flex font-bold bg-white">
                    <div className="px-1 w-full">
                      VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI **
                    </div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td className="border border-black text-center p-0.5">
                          Disetujui
                        </td>
                        <td className="border border-black text-center p-0.5">
                          Perubahan ****
                        </td>
                        <td className="border border-black text-center p-0.5">
                          Ditangguhkan ****
                        </td>
                        <td
                          colSpan={2}
                          className="border border-black text-center p-0.5"
                        >
                          Tidak Disetujui ****
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black h-[20px]"></td>
                        <td className="border border-black h-[20px]"></td>
                        <td className="border border-black h-[20px]"></td>
                        <td
                          colSpan={2}
                          className="border border-black h-[20px]"
                        ></td>
                      </tr>
                      <tr>
                        <td
                          colSpan={3}
                          className="border border-black border-r-0"
                        ></td>
                        <td
                          colSpan={2}
                          className="border border-black border-l-0 text-center py-6 align-bottom"
                        >
                          {hierarchy.pejabat}
                          <br />
                          NIP. {hierarchy.nipPejabat}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="text-[10pt] mt-4">
                    <p className="font-bold">Catatan:</p>
                    <table className="border-collapse">
                      <tbody>
                        <tr>
                          <td className="w-6 align-top">*</td>
                          <td>Coret yang tidak perlu</td>
                        </tr>
                        <tr>
                          <td className="w-6 align-top">**</td>
                          <td>
                            Pilih salah satu dengan memberi tanda centang (✓)
                          </td>
                        </tr>
                        <tr>
                          <td className="w-6 align-top">***</td>
                          <td>
                            diisi oleh pejabat yang menangani bidang kepegawaian
                            sebelum PNS mengajukan Cuti
                          </td>
                        </tr>
                        <tr>
                          <td className="w-6 align-top">****</td>
                          <td>diberi tanda centang dan alasannya.</td>
                        </tr>
                        <tr>
                          <td className="w-6 align-top">N</td>
                          <td>Cuti tahun berjalan</td>
                        </tr>
                        <tr>
                          <td className="w-6 align-top">N-1</td>
                          <td>Sisa cuti 1 tahun sebelumnya</td>
                        </tr>
                        <tr>
                          <td className="w-6 align-top">N-2</td>
                          <td>Sisa cuti 2 tahun sebelumnya</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            
}
