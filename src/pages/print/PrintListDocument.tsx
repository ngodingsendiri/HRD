import type { CSSProperties } from "react";
import type { Employee, AppSettings } from "../../types";
import { PrintKop } from "./PrintKop";
import {
  densityFromRowCount,
  tableDensityStyle,
  type PrintDensity,
} from "./printPageCss";

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
  density?: PrintDensity;
};

const th: CSSProperties = {
  border: "1px solid #000",
  padding: "var(--print-cell-pad, 3px 6px)",
  textAlign: "center",
  fontWeight: 700,
  backgroundColor: "#f3f4f6",
  color: "#000",
  verticalAlign: "middle",
};

const td: CSSProperties = {
  border: "1px solid #000",
  padding: "var(--print-cell-pad, 3px 6px)",
  color: "#000",
  verticalAlign: "middle",
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
  density: densityProp,
}: PrintListDocumentProps) {
  const density = densityProp ?? densityFromRowCount(sortedEmployees.length);
  const tableStyle = tableDensityStyle(density, false);
  const rowMinH =
    density === "compact" ? 22 : density === "normal" ? 28 : 32;

  return (
    <div className="print-sheet" style={{ color: "#000", backgroundColor: "#fff" }}>
      <PrintKop settings={settings} />
      <div style={{ borderBottom: "1px solid #000", marginBottom: "16px" }} />
      <div style={{ textAlign: "center", marginBottom: "16px" }}>
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
              fontSize: "12pt",
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
          marginBottom: "24px",
          tableLayout: "fixed",
          ...tableStyle,
        }}
      >
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "36%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "20%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={th}>NO</th>
            <th style={th}>NAMA PEGAWAI</th>
            <th style={th}>JK</th>
            <th style={th}>NIP</th>
            <th style={th}>
              {isTandaTerima ? "TANDA TERIMA" : "TANDA TANGAN"}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.map((emp, idx) => (
            <tr key={emp.id || idx} style={{ height: rowMinH }}>
              <td style={{ ...td, textAlign: "center" }}>{idx + 1}</td>
              <td style={{ ...td, paddingLeft: 10, wordBreak: "break-word" }}>
                {emp.nama}
              </td>
              <td style={{ ...td, textAlign: "center" }}>{emp.jk || "-"}</td>
              <td
                style={{
                  ...td,
                  textAlign: "center",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {emp.nip || "-"}
              </td>
              <td
                style={{
                  ...td,
                  fontWeight: 600,
                  paddingLeft: idx % 2 === 0 ? 6 : 28,
                }}
              >
                {idx + 1}.
              </td>
            </tr>
          ))}
          {sortedEmployees.length === 0 && (
            <tr>
              <td
                colSpan={5}
                style={{
                  ...td,
                  textAlign: "center",
                  fontStyle: "italic",
                  padding: "20px",
                }}
              >
                Tidak ada data pegawai yang sesuai untuk dicetak.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div
        className="page-break-inside-avoid"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "32px",
          paddingRight: "16px",
        }}
      >
        <div style={{ textAlign: "left", minWidth: "200px", maxWidth: "350px" }}>
          <p style={{ fontSize: "12pt", margin: "0 0 4px", color: "#000" }}>
            Jember,{" "}
            {new Date().toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p
            style={{
              fontSize: "12pt",
              margin: "0 0 56px",
              lineHeight: 1.35,
              color: "#000",
            }}
          >
            {kadisTitle}
          </p>
          <p
            style={{
              fontSize: "12pt",
              fontWeight: 700,
              textDecoration: "underline",
              whiteSpace: "nowrap",
              margin: 0,
              color: "#000",
            }}
          >
            {ttdName}
          </p>
          <p style={{ fontSize: "12pt", whiteSpace: "nowrap", margin: 0, color: "#000" }}>
            {ttdPangkat}
          </p>
          <p
            style={{
              fontSize: "12pt",
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
