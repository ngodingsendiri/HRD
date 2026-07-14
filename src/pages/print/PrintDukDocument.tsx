import type { CSSProperties } from "react";
import type { Employee, AppSettings } from "../../types";
import { PrintKop } from "./PrintKop";
import {
  cellPadForDensity,
  densityFromRowCount,
  tableDensityStyle,
  type PrintDensity,
} from "./printPageCss";

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
  /** Optional override; default from row count. */
  density?: PrintDensity;
};

function cellStyles(pad: string): { th: CSSProperties; tdBase: CSSProperties } {
  return {
    th: {
      border: "1px solid #000",
      padding: pad,
      textAlign: "center",
      fontWeight: 700,
      backgroundColor: "#f3f4f6",
      color: "#000",
      verticalAlign: "middle",
    },
    tdBase: {
      border: "1px solid #000",
      padding: pad,
      color: "#000",
      verticalAlign: "top",
    },
  };
}

/** Daftar Urut Kepangkatan — landscape-oriented wide table. */
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
  density: densityProp,
}: PrintDukDocumentProps) {
  const density = densityProp ?? densityFromRowCount(sortedEmployees.length);
  const tableStyle = tableDensityStyle(density, true);
  const { th, tdBase } = cellStyles(cellPadForDensity(density));

  return (
    <div className="print-sheet" style={{ color: "#000", backgroundColor: "#fff" }}>
      <PrintKop settings={settings} />
      <div style={{ borderBottom: "1px solid #000", marginBottom: "12px" }} />
      <div style={{ textAlign: "center", marginBottom: "12px" }}>
        <h2
          style={{
            fontSize: "12pt",
            fontWeight: 700,
            textTransform: "uppercase",
            margin: 0,
            color: "#000",
          }}
        >
          {customTitle}
        </h2>
        {customSubtitle ? (
          <p
            style={{
              fontSize: "10pt",
              fontWeight: 700,
              margin: "4px 0 0",
              color: "#000",
            }}
          >
            {customSubtitle}
          </p>
        ) : null}
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "20px",
          tableLayout: "auto",
          ...tableStyle,
        }}
      >
        <colgroup>
          <col style={{ width: "3%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "5%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={th}>NO</th>
            <th style={th}>NAMA</th>
            <th style={th}>NIP</th>
            <th style={th}>PANGKAT / GOL</th>
            <th style={th}>TMT GOL</th>
            <th style={th}>JABATAN</th>
            <th style={th}>KELAS</th>
            <th style={th}>MASA KERJA</th>
            <th style={th}>UNIT KERJA</th>
            <th style={th}>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.map((emp, idx) => (
            <tr key={emp.id || idx}>
              <td style={{ ...tdBase, textAlign: "center" }}>{idx + 1}</td>
              <td style={{ ...tdBase, wordBreak: "break-word" }}>{emp.nama}</td>
              <td
                style={{
                  ...tdBase,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {emp.nip || "-"}
              </td>
              <td style={{ ...tdBase, textAlign: "center", wordBreak: "break-word" }}>
                {emp.pangkatGolongan ||
                  [emp.pangkat, emp.gol].filter(Boolean).join(" / ") ||
                  "-"}
              </td>
              <td style={{ ...tdBase, textAlign: "center", whiteSpace: "nowrap" }}>
                {emp.tmtGolonganRuang
                  ? formatDateId(emp.tmtGolonganRuang)
                  : "-"}
              </td>
              <td style={{ ...tdBase, wordBreak: "break-word" }}>
                {emp.jabatan || "-"}
              </td>
              <td style={{ ...tdBase, textAlign: "center" }}>
                {emp.kelasJabatan || "-"}
              </td>
              <td style={{ ...tdBase, textAlign: "center", whiteSpace: "nowrap" }}>
                {emp.masaKerja || "-"}
              </td>
              <td style={{ ...tdBase, wordBreak: "break-word" }}>
                {emp.bidang || "-"}
              </td>
              <td style={{ ...tdBase, textAlign: "center" }}>
                {emp.status || "-"}
              </td>
            </tr>
          ))}
          {sortedEmployees.length === 0 && (
            <tr>
              <td
                colSpan={10}
                style={{
                  ...tdBase,
                  textAlign: "center",
                  fontStyle: "italic",
                  padding: "16px",
                }}
              >
                Tidak ada data pegawai untuk daftar urut kepangkatan.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div
        className="page-break-inside-avoid"
        style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}
      >
        <div style={{ textAlign: "left", minWidth: "200px", maxWidth: "320px" }}>
          <p style={{ fontSize: "10pt", margin: "0 0 4px", color: "#000" }}>
            Jember,{" "}
            {new Date().toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p
            style={{
              fontSize: "10pt",
              margin: "0 0 48px",
              lineHeight: 1.35,
              color: "#000",
            }}
          >
            {kadisTitle}
          </p>
          <p
            style={{
              fontSize: "10pt",
              fontWeight: 700,
              textDecoration: "underline",
              whiteSpace: "nowrap",
              margin: 0,
              color: "#000",
            }}
          >
            {ttdName}
          </p>
          <p style={{ fontSize: "10pt", whiteSpace: "nowrap", margin: 0, color: "#000" }}>
            {ttdPangkat}
          </p>
          <p
            style={{
              fontSize: "10pt",
              whiteSpace: "nowrap",
              margin: "2px 0 0",
              color: "#000",
            }}
          >
            NIP. {ttdNip}
          </p>
        </div>
      </div>
    </div>
  );
}
