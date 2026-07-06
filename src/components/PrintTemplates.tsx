import React from "react";
import { Employee, AppSettings } from "../types";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface PrintProps {
  employees: Employee[];
  settings: AppSettings | null;
  type: "data-dasar" | "absen" | "tanda-terima";
  getHierarchy: (emp: Employee) => {
    atasan: string;
    nipAtasan: string;
    pejabat: string;
    nipPejabat: string;
  };
}

export const PrintTemplates = React.forwardRef<HTMLDivElement, PrintProps>(
  ({ employees, settings, type, getHierarchy }, ref) => {
    const today = format(new Date(), "dd MMMM yyyy", { locale: id });

    return (
      <div ref={ref} className="print-container bg-white text-slate-900">
        <style>{`
 @media print {
 @page {
 size: A4;
 margin: 15mm;
 }
 body {
 -webkit-print-color-adjust: exact;
 }
 .page-break {
 page-break-after: always;
 }
 .no-print {
 display: none;
 }
 }
 .print-container {
 font-family: 'Inter', sans-serif;
 line-height: 1.5;
 }
 table {
 width: 100%;
 border-collapse: collapse;
 margin-bottom: 1rem;
 }
 th, td {
 border: 1px solid #e2e8f0;
 padding: 8px 12px;
 text-align: left;
 font-size: 11px;
 }
 th {
 background-color: #f8fafc;
 font-weight: 700;
 text-transform: uppercase;
 letter-spacing: 0.05em;
 }
 `}</style>

        {type === "data-dasar" &&
          employees.map((emp, idx) => {
            const hierarchy = getHierarchy(emp);
            return (
              <div key={emp.id || idx} className="page-break p-4">
                <div className="text-center mb-8 border-b-2 border-slate-900 pb-4">
                  <h1 className="text-xl font-bold uppercase">
                    Data Dasar Pegawai
                  </h1>
                  <p className="text-sm font-medium text-slate-600">
                    Sistem Informasi Kepegawaian (SIMPEG)
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <section>
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1">
                      I. Identitas Pribadi
                    </h2>
                    <table className="border-none">
                      <tbody>
                        <tr className="border-none">
                          <td className="border-none font-bold w-40">
                            Nama Lengkap
                          </td>
                          <td className="border-none">: {emp.nama}</td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">NIP</td>
                          <td className="border-none">: {emp.nip || "-"}</td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">NIK</td>
                          <td className="border-none">: {emp.nik}</td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">
                            Tempat, Tgl Lahir
                          </td>
                          <td className="border-none">
                            : {emp.tempatLahir}, {emp.tanggalLahir}
                          </td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">
                            Jenis Kelamin
                          </td>
                          <td className="border-none">
                            : {emp.jk === "L" ? "Laki-laki" : "Perempuan"}
                          </td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">Agama</td>
                          <td className="border-none">: {emp.agama || "-"}</td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">
                            Status Kawin
                          </td>
                          <td className="border-none">
                            : {emp.statusKawin || "-"}
                          </td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">Alamat</td>
                          <td className="border-none">
                            : {emp.jalanDusun}, RT {emp.rt}/RW {emp.rw},{" "}
                            {emp.desaKelurahan}, {emp.kecamatan},{" "}
                            {emp.kabupaten}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  <section>
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1">
                      II. Data Kepegawaian
                    </h2>
                    <table className="border-none">
                      <tbody>
                        <tr className="border-none">
                          <td className="border-none font-bold w-40">Status</td>
                          <td className="border-none">: {emp.status}</td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">Jabatan</td>
                          <td className="border-none">: {emp.jabatan}</td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">
                            Bidang / Unit Kerja
                          </td>
                          <td className="border-none">: {emp.bidang}</td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">
                            Pangkat / Golongan
                          </td>
                          <td className="border-none">
                            : {emp.pangkat} ({emp.gol})
                          </td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">TMT Kerja</td>
                          <td className="border-none">
                            : {emp.tmtKerja || "-"}
                          </td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">
                            Pendidikan Terakhir
                          </td>
                          <td className="border-none">
                            : {emp.pendidikan} - {emp.jurusan}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  <section>
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1">
                      III. Hierarki Atasan
                    </h2>
                    <table className="border-none">
                      <tbody>
                        <tr className="border-none">
                          <td className="border-none font-bold w-40">
                            Atasan Langsung
                          </td>
                          <td className="border-none">: {hierarchy.atasan}</td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">NIP Atasan</td>
                          <td className="border-none">
                            : {hierarchy.nipAtasan}
                          </td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">
                            Pejabat Berwenang
                          </td>
                          <td className="border-none">: {hierarchy.pejabat}</td>
                        </tr>
                        <tr className="border-none">
                          <td className="border-none font-bold">NIP Pejabat</td>
                          <td className="border-none">
                            : {hierarchy.nipPejabat}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </section>
                </div>

                <div className="mt-12 flex justify-end">
                  <div className="text-center w-64">
                    <p className="text-xs mb-12">Dicetak pada: {today}</p>
                    <p className="font-bold border-b border-slate-900 pb-1">
                      {emp.nama}
                    </p>
                    <p className="text-xs">NIP. {emp.nip || "-"}</p>
                  </div>
                </div>
              </div>
            );
          })}

        {type === "absen" && (
          <div className="p-4">
            <div className="text-center mb-8">
              <h1 className="text-xl font-bold uppercase">
                Daftar Hadir Manual Pegawai
              </h1>
              <p className="text-sm font-medium text-slate-600">
                Bulan: ................................ Tahun:{" "}
                {new Date().getFullYear()}
              </p>
            </div>

            <table>
              <thead>
                <tr>
                  <th className="w-8 text-center">No</th>
                  <th>Nama / NIP</th>
                  <th>Jabatan</th>
                  <th className="w-24 text-center">Pagi</th>
                  <th className="w-24 text-center">Sore</th>
                  <th className="w-32 text-center">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, idx) => (
                  <tr key={emp.id || idx}>
                    <td className="text-center">{idx + 1}</td>
                    <td>
                      <div className="font-bold">{emp.nama}</div>
                      <div className="text-[9px] text-slate-500">
                        NIP. {emp.nip || "-"}
                      </div>
                    </td>
                    <td>{emp.jabatan}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-12 flex justify-end">
              <div className="text-center w-64">
                <p className="text-xs mb-1">Mengetahui,</p>
                <p className="text-xs mb-12">Sekretaris Daerah</p>
                <p className="font-bold border-b border-slate-900 pb-1">
                  {settings?.sekdaNama || "................................"}
                </p>
                <p className="text-xs">
                  NIP.{" "}
                  {settings?.sekdaNip || "................................"}
                </p>
              </div>
            </div>
          </div>
        )}

        {type === "tanda-terima" && (
          <div className="p-4">
            <div className="text-center mb-8">
              <h1 className="text-xl font-bold uppercase">
                Daftar Tanda Terima
              </h1>
              <p className="text-sm font-medium text-slate-600">
                Keperluan:
                ................................................................................
              </p>
            </div>

            <table>
              <thead>
                <tr>
                  <th className="w-8 text-center">No</th>
                  <th>Nama / NIP</th>
                  <th>Jabatan / Bidang</th>
                  <th className="w-48 text-center">Tanda Terima</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, idx) => (
                  <tr key={emp.id || idx}>
                    <td className="text-center">{idx + 1}</td>
                    <td>
                      <div className="font-bold">{emp.nama}</div>
                      <div className="text-[9px] text-slate-500">
                        NIP. {emp.nip || "-"}
                      </div>
                    </td>
                    <td>
                      <div className="font-medium">{emp.jabatan}</div>
                      <div className="text-[9px] text-slate-500">
                        {emp.bidang}
                      </div>
                    </td>
                    <td className="relative h-12">
                      <span className="absolute left-2 top-1 text-[8px] text-slate-400">
                        {idx + 1}.
                      </span>
                      {idx % 2 !== 0 && (
                        <span className="absolute right-12 top-4 text-[8px] text-slate-400">
                          {idx + 1}.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-12 flex justify-end">
              <div className="text-center w-64">
                <p className="text-xs mb-1">{today}</p>
                <p className="text-xs mb-12">Bendahara / Pengelola,</p>
                <p className="font-bold border-b border-slate-900 pb-1">
                  ................................
                </p>
                <p className="text-xs">NIP. ................................</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

PrintTemplates.displayName = "PrintTemplates";
