/**
 * Export print preview as Word-compatible .doc (HTML Word format).
 *
 * Do NOT dump full getComputedStyle (px widths + flex) — Word mangles that.
 * Prefer existing inline styles from print templates + a small safe stylesheet.
 */
export type DocOrientation = "portrait" | "landscape";

export type DownloadPrintDocOptions = {
  orientation?: DocOrientation;
  marginMm?: number;
};

const DEFAULT_MARGIN = { portrait: 15, landscape: 12 } as const;

/**
 * Download the print sheet as `.doc` (HTML Word format).
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

  // Strip Tailwind class noise; keep inline styles from print templates
  stripClassesDeep(clone);
  normalizeForWord(clone);

  clone.style.cssText =
    "width:100%;background:#ffffff;color:#000000;font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;border:none;";

  const pageSize =
    orientation === "landscape" ? "297mm 210mm" : "210mm 297mm";
  const msoOrient =
    orientation === "landscape" ? "landscape" : "portrait";

  // Embed images as data URLs if they already are; absolute http logos stay as-is
  promoteImgSrc(clone);

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta charset="utf-8" />
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
<![endif]-->
<style>
  /* Page */
  @page {
    size: ${orientation === "landscape" ? "A4 landscape" : "A4"};
    margin: ${marginMm}mm;
  }
  @page Section1 {
    size: ${pageSize};
    margin: ${marginMm}mm;
    mso-page-orientation: ${msoOrient};
  }
  div.Section1 { page: Section1; }

  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
  }
  body { margin: ${marginMm}mm; }

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
    padding: 2px 4px;
  }
  th {
    background: #f3f4f6;
    font-weight: bold;
    text-align: center;
  }
  img {
    max-width: 90px;
    height: auto;
  }
  h1, h2, h3, p, div, span {
    color: #000;
  }
</style>
</head>
<body>
<div class="Section1">
${clone.outerHTML}
</div>
</body>
</html>`;

  // UTF-8 BOM helps Word open Indonesian text correctly
  const blob = new Blob(["\ufeff", html], {
    type: "application/msword",
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

function stripClassesDeep(root: HTMLElement) {
  root.removeAttribute("class");
  root.querySelectorAll("[class]").forEach((n) => n.removeAttribute("class"));
}

/**
 * Word-friendly cleanup: drop screen-only layout props that break tables
 * (fixed px widths from preview, flex, minHeight A4 stage, etc.).
 */
function normalizeForWord(root: HTMLElement) {
  const all = [root, ...Array.from(root.querySelectorAll("*"))].filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  );

  for (const node of all) {
    // Kill stage chrome from Print.tsx printRef
    node.style.removeProperty("min-height");
    node.style.removeProperty("max-height");
    node.style.removeProperty("max-width");
    node.style.removeProperty("box-shadow");
    node.style.removeProperty("transform");
    node.style.removeProperty("gap");

    // Flex often collapses badly in Word — demote to block when not a table cell
    const tag = node.tagName;
    if (tag !== "TD" && tag !== "TH" && tag !== "TR" && tag !== "TABLE") {
      const display = node.style.display;
      if (display === "flex" || display === "inline-flex" || display === "grid") {
        node.style.display = "block";
      }
    }

    // Preview uses w-[210mm]/w-[297mm] via class (stripped) or style width
    if (node === root) {
      node.style.width = "100%";
      node.style.height = "auto";
      node.style.padding = "0";
      node.style.margin = "0";
      node.style.border = "none";
    }

    if (tag === "TABLE") {
      node.style.width = "100%";
      node.style.borderCollapse = "collapse";
      node.style.tableLayout = "auto";
    }

    if (tag === "TH" || tag === "TD") {
      // Ensure visible borders for cells that only had Tailwind border classes
      if (!node.style.border && !node.getAttribute("style")?.includes("border")) {
        node.style.border = "1px solid #000";
      }
      if (!node.style.padding) node.style.padding = "2px 4px";
      node.style.color = node.style.color || "#000";
    }

    if (tag === "IMG") {
      node.style.maxWidth = "90px";
      node.style.height = "auto";
    }
  }
}

function promoteImgSrc(root: HTMLElement) {
  root.querySelectorAll("img").forEach((img) => {
    const el = img as HTMLImageElement;
    // Prefer currentSrc if set
    if (el.currentSrc && el.currentSrc.startsWith("data:")) {
      el.setAttribute("src", el.currentSrc);
    }
  });
}
