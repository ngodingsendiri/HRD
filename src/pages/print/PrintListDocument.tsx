import type { Employee, AppSettings } from "../../types";
import { PrintKop } from "./PrintKop";

export type PrintListDocumentProps = {
  settings: AppSettings | null;
  customTitle: string;
  customSubtitle: string;
  sortedEmployees: Employee[];
  isTandaTerima: boolean;
  kadisTitle: string;
  ttdName: string;
  ttdPangkat: string;
  ttdNip: string;
};

/** Absensi global/unit + tanda terima (shared attendance-style table). */
export function PrintListDocument({
  settings,
  customTitle,
  customSubtitle,
  sortedEmployees,
  isTandaTerima,
  kadisTitle,
  ttdName,
  ttdPangkat,
  ttdNip,
}: PrintListDocumentProps) {
  return (
    <>
      <PrintKop settings={settings} />
      <div className="border-b border-black mb-6" />
      <div className="text-center mb-6 space-y-1">
        <h2 className="text-[12pt] font-bold uppercase">{customTitle}</h2>
        {customSubtitle && (
          <p className="text-[12pt] font-bold">{customSubtitle}</p>
        )}
      </div>
      <table className="w-full border-collapse mb-10 text-[12pt] leading-tight">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black px-2 py-1 w-10 text-center font-bold align-middle">
              NO
            </th>
            <th className="border border-black px-2 py-1 text-center font-bold align-middle">
              NAMA PEGAWAI
            </th>
            <th className="border border-black px-2 py-1 w-10 text-center font-bold align-middle">
              JK
            </th>
            <th className="border border-black px-2 py-1 w-44 text-center font-bold align-middle">
              NIP
            </th>
            <th className="border border-black px-2 py-1 w-40 font-bold text-center align-middle">
              {isTandaTerima ? "TANDA TERIMA" : "TANDA TANGAN"}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.map((emp, idx) => (
            <tr key={emp.id || idx} className="h-8">
              <td className="border border-black px-2 py-1 text-center align-middle">
                {idx + 1}
              </td>
              <td className="border border-black px-3 py-1 align-middle">
                <div className="text-[11pt] leading-none">{emp.nama}</div>
              </td>
              <td className="border border-black px-1 py-1 text-center align-middle text-[11pt]">
                {emp.jk || "-"}
              </td>
              <td className="border border-black px-2 py-1 align-middle text-center">
                <div className="text-[11pt] leading-none">{emp.nip || "-"}</div>
              </td>
              <td className="border border-black px-2 py-1 align-middle">
                <div
                  className={`text-[11pt] font-semibold ${idx % 2 === 0 ? "text-left pl-1" : "text-left pl-10"}`}
                >
                  {idx + 1}.
                </div>
              </td>
            </tr>
          ))}
          {sortedEmployees.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="border border-black px-4 py-6 text-center italic text-gray-500 text-[12pt]"
              >
                Tidak ada data pegawai yang sesuai untuk dicetak.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex justify-end mt-12 pr-8 page-break-inside-avoid">
        <div className="text-left min-w-[200px] max-w-[350px]">
          <p className="text-[12pt] mb-1">
            Jember,{" "}
            {new Date().toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p className="text-[12pt] mb-20 leading-snug">{kadisTitle}</p>
          <p className="text-[12pt] font-bold underline whitespace-nowrap">
            {ttdName}
          </p>
          <p className="text-[12pt] whitespace-nowrap">{ttdPangkat}</p>
          <p className="text-[12pt] mt-0.5 whitespace-nowrap">NIP. {ttdNip}</p>
        </div>
      </div>
    </>
  );
}
