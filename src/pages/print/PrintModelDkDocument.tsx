import type { Employee, AppSettings } from "../../types";

export type PrintModelDkDocumentProps = {
  employees: Employee[];
  cutiEmployeeId: string;
  settings: AppSettings | null;
  kadisTitle: string;
  ttdName: string;
  ttdNip: string;
  formatDateId: (d?: string) => string;
  instansiNama: string;
  instansiAlamat: string;
};

export function PrintModelDkDocument({
  employees,
  cutiEmployeeId,
  settings,
  kadisTitle,
  ttdName,
  ttdNip,
  formatDateId,
  instansiNama,
  instansiAlamat,
}: PrintModelDkDocumentProps) {

              const emp = employees.find((e) => e.id === cutiEmployeeId);
              const gajiDigits = String(emp?.besaranGajiKotor || "0").replace(
                /[^0-9]/g,
                "",
              );
              const numGaji = parseInt(gajiDigits, 10) || 0;
              const formatRp = new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
              }).format(numGaji);

              const keluarga = emp?.dataKeluarga || [];
              const tglSurat = new Date().toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });

              const jkLabel =
                emp?.jk === "P"
                  ? "Perempuan"
                  : emp?.jk === "L"
                    ? "Laki-laki"
                    : emp?.jk || "-";

              return (
                <div className="text-[11pt] leading-tight text-black p-[20px]">
                  <div className="text-right text-[11pt] mb-8 font-bold">
                    Model DK
                  </div>

                  <div className="text-center font-bold text-[12pt] leading-snug mb-8 tracking-widest pb-6">
                    SURAT KETERANGAN
                    <br />
                    UNTUK MENDAPATKAN PEMBAYARAN TUNJANGAN KELUARGA
                  </div>

                  <table className="w-full text-[11pt] border-none mb-6">
                    <tbody>
                      <tr>
                        <td className="w-64 align-top py-0.5">Nama Instansi</td>
                        <td className="w-4 align-top py-0.5">:</td>
                        <td className="align-top py-0.5 uppercase">
                          {instansiNama}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">Alamat</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">{instansiAlamat}</td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">
                          Nama Pembuat Daftar Gaji
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          ..............................................
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="font-bold text-[11pt] mb-2 uppercase">
                    DATA PEGAWAI
                  </div>

                  <table className="w-full text-[11pt] border-none mb-4">
                    <tbody>
                      {/* Fields 1–18 as Model DK spec */}
                      <tr>
                        <td className="w-6 align-top py-0.5">1.</td>
                        <td className="w-60 align-top py-0.5">Nama lengkap</td>
                        <td className="w-4 align-top py-0.5">:</td>
                        <td className="align-top py-0.5">{emp?.nama || "-"}</td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">2.</td>
                        <td className="align-top py-0.5">NIP</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">{emp?.nip || "-"}</td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">3.</td>
                        <td className="align-top py-0.5">
                          Pangkat /Golongan Ruang
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.pangkatGolongan ||
                            [emp?.pangkat, emp?.gol].filter(Boolean).join(" / ") ||
                            "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">4.</td>
                        <td className="align-top py-0.5">TMT Golongan Ruang</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {formatDateId(emp?.tmtGolonganRuang)}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">5.</td>
                        <td className="align-top py-0.5">
                          Tempat/Tanggal Lahir
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.tempatLahir || "-"},{" "}
                          {formatDateId(emp?.tanggalLahir)}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">6.</td>
                        <td className="align-top py-0.5">Jenis Kelamin</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">{jkLabel}</td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">7.</td>
                        <td className="align-top py-0.5">Agama</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.agama || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">8.</td>
                        <td className="align-top py-0.5">Alamat Lengkap</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.jalanDusun ||
                          emp?.rt ||
                          emp?.rw ||
                          emp?.desaKelurahan ||
                          emp?.kecamatan ||
                          emp?.kabupaten
                            ? `${emp?.jalanDusun || ""} ${emp?.rt ? `RT.${emp?.rt}` : ""} ${emp?.rw ? `RW.${emp?.rw}` : ""} ${emp?.desaKelurahan || ""}, ${emp?.kecamatan || ""}, ${emp?.kabupaten || ""}`
                            : "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">9.</td>
                        <td className="align-top py-0.5">TMT Pegawai</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {formatDateId(emp?.tmtKerja)}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">10.</td>
                        <td className="align-top py-0.5">Status Kepegawaian</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.status || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">11.</td>
                        <td className="align-top py-0.5">
                          Digaji Menurut PP/SK
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.digajiMenurut ||
                            "......................................"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">12.</td>
                        <td className="align-top py-0.5">Besaran Gaji Kotor</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">{formatRp}</td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">13.</td>
                        <td className="align-top py-0.5">Jabatan</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.jabatan || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">14.</td>
                        <td className="align-top py-0.5">
                          Jumlah Keluarga Tertanggung
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.jumlahTertanggung || "0"} Orang
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">15.</td>
                        <td className="align-top py-0.5">
                          SK Terakhir yang dimiliki
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.skTerakhir || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">16.</td>
                        <td className="align-top py-0.5">
                          Masa kerja golongan
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.masaKerjaGolonganRuang ||
                            "....... Tahun ....... Bulan"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">17.</td>
                        <td className="align-top py-0.5">
                          Masa kerja Keseluruhan
                        </td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5">
                          {emp?.masaKerja || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top py-0.5">18.</td>
                        <td className="align-top py-0.5">Susunan Keluarga</td>
                        <td className="align-top py-0.5">:</td>
                        <td className="align-top py-0.5"></td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="w-full border-collapse border border-black mb-6 text-[11pt]">
                    <thead>
                      <tr>
                        <th className="border border-black p-1">No</th>
                        <th className="border border-black p-1">
                          Nama Istri / Suami / Anak
                          <br />
                          Tanggungan
                        </th>
                        <th className="border border-black p-1">
                          Tanggal Kelahiran
                          <br />
                          (Umur)
                        </th>
                        <th className="border border-black p-1">Perkawinan</th>
                        <th className="border border-black p-1">
                          Pekerjaan / Sekolah
                        </th>
                        <th className="border border-black p-1">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const validKeluarga = keluarga.filter((k) => k.name);
                        const emptyRowContext: {
                          name: string;
                          birthDate: string;
                          marriageDate: string;
                          occupation?: string;
                          description?: string;
                        } = {
                          name: "",
                          birthDate: "",
                          marriageDate: "",
                          occupation: "",
                          description: "",
                        };
                        const rows =
                          validKeluarga.length > 0
                            ? [...validKeluarga, emptyRowContext]
                            : [emptyRowContext];

                        return rows.map((member, i) => (
                          <tr key={i} className="h-7 text-center">
                            <td className="border border-black">
                              {member?.name ? i + 1 : ""}
                            </td>
                            <td className="border border-black text-left px-2">
                              {member?.name || ""}
                            </td>
                            <td className="border border-black">
                              {member?.name && member.birthDate
                                ? formatDateId(member.birthDate)
                                : ""}
                            </td>
                            <td className="border border-black">
                              {member?.name && member.marriageDate
                                ? formatDateId(member.marriageDate)
                                : ""}
                            </td>
                            <td className="border border-black">
                              {member?.occupation || ""}
                            </td>
                            <td className="border border-black">
                              {member?.description || ""}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>

                  <p className="text-justify mb-8">
                    Keterangan ini saya buat dengan sesungguhnya dan apabila
                    keterangan ini ternyata tidak benar (palsu), saya bersedia
                    dituntut dimuka pengadilan berdasarkan Undang-undang yang
                    berlaku, dan bersedia mengembalikan semua penghasilan yang
                    telah saya terima yang seharusnya bukan menjadi hak saya.
                  </p>

                  <div className="flex justify-between mt-8 page-break-inside-avoid">
                    <div className="w-[45%] flex flex-col justify-between">
                      <div>
                        <p>Mengetahui,</p>
                        <p>{kadisTitle}</p>
                        <p>Kabupaten Jember</p>
                      </div>
                      <div className="mt-20">
                        <p className="font-bold underline whitespace-nowrap">
                          {ttdName}
                        </p>
                        <p className="whitespace-nowrap">NIP. {ttdNip}</p>
                      </div>
                    </div>
                    <div className="w-[45%] flex flex-col justify-between">
                      <div>
                        <p>Jember, {tglSurat}</p>
                        <p>Pegawai yang bersangkutan,</p>
                        <p>&nbsp;</p>
                      </div>
                      <div className="mt-20">
                        <p className="font-bold underline whitespace-nowrap">
                          {emp?.nama ||
                            "..........................................."}
                        </p>
                        <p className="whitespace-nowrap">
                          NIP.{" "}
                          {emp?.nip ||
                            "..........................................."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            
}
