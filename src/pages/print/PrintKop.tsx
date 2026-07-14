import type { AppSettings } from "../../types";

/**
 * Shared letterhead — table layout (not flex) so PDF capture and Word .doc
 * both render logo + instansi lines correctly.
 */
export function PrintKop({ settings }: { settings: AppSettings | null }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        border: "none",
        marginBottom: 4,
        color: "#000000",
      }}
    >
      <tbody>
        <tr>
          <td
            style={{
              width: 100,
              border: "none",
              verticalAlign: "middle",
              padding: "0 8px 0 0",
            }}
          >
            {settings?.logoBase64 ? (
              <img
                src={settings.logoBase64}
                alt="Logo"
                width={90}
                height={90}
                style={{
                  width: 90,
                  height: 90,
                  objectFit: "contain",
                  display: "block",
                }}
                crossOrigin="anonymous"
              />
            ) : (
              <div
                className="print-hidden"
                style={{
                  width: 90,
                  height: 90,
                  border: "2px dashed #d1d5db",
                  fontSize: 11,
                  textAlign: "center",
                  color: "#9ca3af",
                  lineHeight: "90px",
                }}
              >
                Logo
              </div>
            )}
          </td>
          <td
            style={{
              border: "none",
              verticalAlign: "middle",
              textAlign: "center",
              color: "#000000",
              padding: 0,
            }}
          >
            {settings?.kopLine1 ? (
              <div
                style={{
                  fontSize: "14pt",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  lineHeight: 1.25,
                }}
              >
                {settings.kopLine1}
              </div>
            ) : null}
            {settings?.kopLine2 ? (
              <div
                style={{
                  fontSize: "16pt",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  lineHeight: 1.25,
                }}
              >
                {settings.kopLine2}
              </div>
            ) : null}
            {settings?.kopLine3 ? (
              <div style={{ fontSize: "10pt", marginTop: 2, lineHeight: 1.3 }}>
                {settings.kopLine3}
              </div>
            ) : null}
            {settings?.kopLine4 ? (
              <div style={{ fontSize: "10pt", lineHeight: 1.3 }}>
                {settings.kopLine4}
              </div>
            ) : null}
          </td>
          {/* Spacer so title stays optically centered with logo on the left */}
          <td style={{ width: 100, border: "none", padding: 0 }} />
        </tr>
      </tbody>
    </table>
  );
}
