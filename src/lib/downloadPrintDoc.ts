/**
 * Export print preview HTML as a Word-compatible .doc file (client-side).
 * Uses HTML + Word XML namespace so MS Word / LibreOffice open it cleanly,
 * with @page margins so the paper is not edge-to-edge.
 */
export type DocOrientation = "portrait" | "landscape";

export type DownloadPrintDocOptions = {
  orientation?: DocOrientation;
  /** Page margin in mm (default 15 portrait / 12 landscape). */
  marginMm?: number;
};

const DEFAULT_MARGIN = { portrait: 15, landscape: 12 } as const;

/**
 * Download the print sheet as `.doc` (HTML Word format).
 * Preserves tables, kop, and layout from the preview element.
 */
export function downloadElementAsWordDoc(
  el: HTMLElement,
  filename: string,
  options: DownloadPrintDocOptions = {},
): void {
  const orientation = options.orientation ?? "portrait";
  const marginMm =
    options.marginMm ??
    (orientation === "landscape"
      ? DEFAULT_MARGIN.landscape
      : DEFAULT_MARGIN.portrait);

  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".print-hidden").forEach((n) => n.remove());
  // Strip chrome that should not appear in Word
  clone.style.boxShadow = "none";
  clone.style.border = "none";
  clone.style.margin = "0";
  clone.style.padding = "0";
  clone.style.width = "100%";
  clone.style.minHeight = "0";
  clone.style.backgroundColor = "#ffffff";
  clone.style.color = "#000000";

  const pageSize =
    orientation === "landscape" ? "297mm 210mm" : "210mm 297mm";
  const msoOrient =
    orientation === "landscape" ? "landscape" : "portrait";

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>Dokumen</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<xml>
  <o:OfficeDocumentSettings>
    <o:AllowPNG/>
  </o:OfficeDocumentSettings>
</xml>
<style>
  /* Page setup for Word */
  @page {
    size: ${pageSize};
    margin: ${marginMm}mm;
    mso-page-orientation: ${msoOrient};
  }
  @page Section1 {
    size: ${pageSize};
    margin: ${marginMm}mm ${marginMm}mm ${marginMm}mm ${marginMm}mm;
    mso-header-margin: 0;
    mso-footer-margin: 0;
    mso-paper-source: 0;
  }
  div.Section1 { page: Section1; }
</style>
<![endif]-->
<style>
  @page {
    size: ${orientation === "landscape" ? "A4 landscape" : "A4"};
    margin: ${marginMm}mm;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
  }
  body {
    /* Fallback margin if @page ignored */
    margin: ${marginMm}mm !important;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    mso-table-lspace: 0pt;
    mso-table-rspace: 0pt;
  }
  th, td {
    border: 1px solid #000;
    color: #000;
    vertical-align: top;
  }
  th {
    background: #f3f4f6;
    font-weight: 700;
    text-align: center;
  }
  img {
    max-width: 96px;
    height: auto;
  }
  * {
    box-sizing: border-box;
  }
</style>
</head>
<body>
<div class="Section1" style="margin:0;padding:0;">
${clone.outerHTML}
</div>
</body>
</html>`;

  // BOM helps Word detect UTF-8 (NIP, names with accents)
  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });

  const safe =
    filename.replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, "_") || "dokumen";
  const base = safe.replace(/\.docx?$/i, "").replace(/\.pdf$/i, "");
  const name = `${base}.doc`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after click settles
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
