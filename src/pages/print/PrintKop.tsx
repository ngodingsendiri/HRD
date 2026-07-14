import type { AppSettings } from "../../types";

/** Shared letterhead for print documents (hex colors — PDF-safe). */
export function PrintKop({ settings }: { settings: AppSettings | null }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        borderBottom: "3px solid #000000",
        paddingBottom: 8,
        marginBottom: 4,
        lineHeight: 1.2,
        color: "#000000",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 96,
          height: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {settings?.logoBase64 ? (
          <img
            src={settings.logoBase64}
            alt="Logo"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            crossOrigin="anonymous"
          />
        ) : (
          <div
            className="print-hidden"
            style={{
              width: "100%",
              height: "100%",
              border: "2px dashed #d1d5db",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              textAlign: "center",
              color: "#9ca3af",
            }}
          >
            Logo
            <br />
            (Kosong)
          </div>
        )}
      </div>
      <div
        style={{
          flex: 1,
          textAlign: "center",
          paddingRight: 96,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          color: "#000000",
        }}
      >
        {settings?.kopLine1 && (
          <div
            style={{
              fontSize: "14pt",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {settings.kopLine1}
          </div>
        )}
        {settings?.kopLine2 && (
          <div
            style={{
              fontSize: "16pt",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {settings.kopLine2}
          </div>
        )}
        {settings?.kopLine3 && (
          <div style={{ fontSize: "10pt", marginTop: 2 }}>{settings.kopLine3}</div>
        )}
        {settings?.kopLine4 && (
          <div style={{ fontSize: "10pt" }}>{settings.kopLine4}</div>
        )}
      </div>
    </div>
  );
}
