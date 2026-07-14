import type { Employee, AppSettings } from "../../types";
import { PrintKop } from "./PrintKop";

export type PrintDukDocumentProps = {
  settings: AppSettings | null;
  customTitle: string;
  customSubtitle: string;
  sortedEmployees: Employee[];
  formatDateId: (d?: string) => string;
  kadisTitle: string;
  ttdName: string;
  ttdPangkat: string;
  ttdNip: string;
};

/** Daftar Urut Kepangkatan (operational DUK columns). */
export function PrintDukDocument({
  settings,
  customTitle,
  customSubtitle,
  sortedEmployees,
  formatDateId,
  kadisTitle,
  ttdName,
  ttdPangkat,
  ttdNip,
}: PrintDukDocumentProps) {
  return (
    <>
      <PrintKop settings={settings} />
      <div className="border-b border-black mb-6" />
      <div className="text-center mb-6 space-y-1">
        <h2 className="text-[12pt] font-bold uppercase">{customTitle}</h2>
        {customSubtitle && (
          <p className="text-[11pt] font-bold">{customSubtitle}</p>
        )}
      </div>
      <table className="w-full border-collapse mb-10 text-[9pt] leading-tight">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black px-1 py-1 w-8 text-center font-bold">
              NO
            </th>
            <th className="border border-black px-1 py-1 text-center font-bold">
              NAMA
            </th>
            <th className="border border-black px-1 py-1 w-28 text-center font-bold">
              NIP
            </th>
            <th className="border border-black px-1 py-1 w-20 text-center font-bold">
              PANGKAT / GOL
            </th>
            <th className="border border-black px-1 py-1 w-20 text-center font-bold">
              TMT GOL
            </th>
            <th className="border border-black px-1 py-1 text-center font-bold">
              JABATAN
            </th>
            <th className="border border-black px-1 py-1 w-12 text-center font-bold">
              KELAS
            </th>
            <th className="border border-black px-1 py-1 w-16 text-center font-bold">
              MASA KERJA
            </th>
            <th className="border border-black px-1 py-1 w-24 text-center font-bold">
              UNIT KERJA
            </th>
            <th className="border border-black px-1 py-1 w-14 text-center font-bold">
              STATUS
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.map((emp, idx) => (
            <tr key={emp.id || idx}>
              <td className="border border-black px-1 py-0.5 text-center align-top">
                {idx + 1}
              </td>
              <td className="border border-black px-1.5 py-0.5 align-top">
                {emp.nama}
              </td>
              <td className="border border-black px-1 py-0.5 text-center align-top">
                {emp.nip || "-"}
              </td>
              <td className="border border-black px-1 py-0.5 text-center align-top">
                {emp.pangkatGolongan ||
                  [emp.pangkat, emp.gol].filter(Boolean).join(" / ") ||
                  "-"}
              </td>
              <td className="border border-black px-1 py-0.5 text-center align-top">
                {emp.tmtGolonganRuang
                  ? formatDateId(emp.tmtGolonganRuang)
                  : "-"}
              </td>
              <td className="border border-black px-1.5 py-0.5 align-top">
                {emp.jabatan || "-"}
              </td>
              <td className="border border-black px-1 py-0.5 text-center align-top">
                {emp.kelasJabatan || "-"}
              </td>
              <td className="border border-black px-1 py-0.5 text-center align-top text-[8pt]">
                {emp.masaKerja || "-"}
              </td>
              <td className="border border-black px-1 py-0.5 align-top">
                {emp.bidang || "-"}
              </td>
              <td className="border border-black px-1 py-0.5 text-center align-top">
                {emp.status || "-"}
              </td>
            </tr>
          ))}
          {sortedEmployees.length === 0 && (
            <tr>
              <td
                colSpan={10}
                className="border border-black px-4 py-6 text-center italic text-gray-500"
              >
                Tidak ada data pegawai untuk DUK.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex justify-end mt-12 pr-8 page-break-inside-avoid">
        <div className="text-left min-w-[200px] max-w-[350px]">
          <p className="text-[11pt] mb-1">
            Jember,{" "}
            {new Date().toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p className="text-[11pt] mb-20 leading-snug">{kadisTitle}</p>
          <p className="text-[11pt] font-bold underline whitespace-nowrap">
            {ttdName}
          </p>
          <p className="text-[11pt] whitespace-nowrap">{ttdPangkat}</p>
          <p className="text-[11pt] mt-0.5 whitespace-nowrap">NIP. {ttdNip}</p>
        </div>
      </div>
    </>
  );
}
