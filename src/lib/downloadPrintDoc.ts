/**
 * Export print preview HTML as a Word-compatible .doc file (client-side).
 * Uses HTML + Word XML namespace so MS Word / LibreOffice open it cleanly,
 * with @page margins so the paper is not edge-to-edge.
 *
 * Inline computed styles from the live DOM so Tailwind-heavy templates
 * (e.g. surat cuti) still look correct in Word.
 */
export type DocOrientation = "portrait" | "landscape";

export type DownloadPrintDocOptions = {
  orientation?: DocOrientation;
  /** Page margin in mm (default 15 portrait / 12 landscape). */
  marginMm?: number;
};

const DEFAULT_MARGIN = { portrait: 15, landscape: 12 } as const;

const STYLE_PROPS = [
  "color",
  "background-color",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-collapse",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "text-align",
  "vertical-align",
  "padding",
  "margin",
  "width",
  "min-width",
  "max-width",
  "height",
  "min-height",
  "display",
  "flex-direction",
  "justify-content",
  "align-items",
  "gap",
  "white-space",
  "text-decoration",
  "table-layout",
  "box-sizing",
] as const;

/** Copy computed layout styles so Word does not depend on Tailwind CSS. */
function inlineComputedStyles(sourceRoot: HTMLElement, cloneRoot: HTMLElement) {
  const sources = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll("*"))];
  const clones = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll("*"))];
  const n = Math.min(sources.length, clones.length);
  for (let i = 0; i < n; i++) {
    const s = sources[i];
    const c = clones[i];
    if (!(s instanceof HTMLElement) || !(c instanceof HTMLElement)) continue;
    if (c.classList.contains("print-hidden")) continue;
    const cs = window.getComputedStyle(s);
    for (const prop of STYLE_PROPS) {
      const val = cs.getPropertyValue(prop);
      if (!val || val === "normal" || val === "none" || val === "auto") {
        // Keep borders / colors even when "none" for tables
        if (
          !prop.startsWith("border") &&
          prop !== "background-color" &&
          prop !== "color"
        ) {
          continue;
        }
      }
      try {
        c.style.setProperty(prop, val);
      } catch {
        /* ignore invalid */
      }
    }
  }
}

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
  inlineComputedStyles(el, clone);

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
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
