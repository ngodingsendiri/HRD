/**
 * Export print preview as Word-compatible .doc (HTML Word format).
 *
 * Keeps template inline styles; strips Tailwind/classes and screen chrome.
 * Does NOT dump full getComputedStyle (that breaks Word with flex + px widths).
 */
export type DocOrientation = "portrait" | "landscape";

export type DownloadPrintDocOptions = {
  orientation?: DocOrientation;
  marginMm?: number;
};

const DEFAULT_MARGIN = { portrait: 15, landscape: 12 } as const;

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

  stripClassesDeep(clone);
  expandCssVarsInClone(clone);
  normalizeForWord(clone);
  promoteImgSrc(clone);

  clone.style.cssText =
    "width:100%;background:#ffffff;color:#000000;font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;border:none;";

  const pageSize =
    orientation === "landscape" ? "297mm 210mm" : "210mm 297mm";
  const msoOrient =
    orientation === "landscape" ? "landscape" : "portrait";

  // Single margin source: @page only (body margin 0) — avoids double margin in Word
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
<style>
  @page Section1 {
    size: ${pageSize};
    margin: ${marginMm}mm ${marginMm}mm ${marginMm}mm ${marginMm}mm;
    mso-page-orientation: ${msoOrient};
    mso-header-margin: 0mm;
    mso-footer-margin: 0mm;
  }
  div.Section1 { page: Section1; }
</style>
<![endif]-->
<style type="text/css">
  @page {
    size: ${orientation === "landscape" ? "A4 landscape" : "A4"};
    margin: ${marginMm}mm;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff;
    color: #000000;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    mso-table-lspace: 0pt;
    mso-table-rspace: 0pt;
  }
  th, td {
    border: 1px solid #000000;
    color: #000000;
    vertical-align: top;
    padding: 2px 4px;
    font-family: Arial, Helvetica, sans-serif;
  }
  th {
    background: #f3f4f6;
    font-weight: bold;
    text-align: center;
  }
  /* Kop / spacer cells without borders */
  table.kop td, td.no-border, th.no-border {
    border: none !important;
  }
  img {
    max-width: 90px;
    height: auto;
  }
</style>
</head>
<body>
<div class="Section1">
${clone.outerHTML}
</div>
</body>
</html>`;

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

/** Resolve var(--x, fallback) left in inline styles from React templates. */
function expandCssVarsInClone(root: HTMLElement) {
  const nodes = [root, ...Array.from(root.querySelectorAll("*"))].filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  );
  for (const node of nodes) {
    const style = node.getAttribute("style");
    if (!style || !style.includes("var(")) continue;
    const next = style.replace(
      /var\s*\(\s*--[^,)]+\s*,\s*([^)]+)\)/g,
      "$1",
    );
    node.setAttribute("style", next);
  }
}

function normalizeForWord(root: HTMLElement) {
  const all = [root, ...Array.from(root.querySelectorAll("*"))].filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  );

  for (const node of all) {
    node.style.removeProperty("min-height");
    node.style.removeProperty("max-height");
    node.style.removeProperty("max-width");
    node.style.removeProperty("box-shadow");
    node.style.removeProperty("transform");
    node.style.removeProperty("gap");
    node.style.removeProperty("flex");
    node.style.removeProperty("flex-shrink");
    node.style.removeProperty("flex-direction");
    node.style.removeProperty("align-items");
    node.style.removeProperty("justify-content");

    const tag = node.tagName;

    if (node === root) {
      node.style.width = "100%";
      node.style.height = "auto";
      node.style.padding = "0";
      node.style.margin = "0";
      node.style.border = "none";
      node.style.display = "block";
    }

    // Demote residual flex/grid (kop is table now; cuti may still have flex)
    if (tag !== "TD" && tag !== "TH" && tag !== "TR" && tag !== "TABLE") {
      const display = (node.style.display || "").toLowerCase();
      if (
        display === "flex" ||
        display === "inline-flex" ||
        display === "grid"
      ) {
        node.style.display = "block";
      }
    }

    if (tag === "TABLE") {
      node.style.width = "100%";
      node.style.borderCollapse = "collapse";
      node.style.tableLayout = "auto";
      // First table is usually kop — no outer border grid
      const isFirst = root.querySelector("table") === node;
      if (isFirst) {
        node.classList.add("kop");
        node.querySelectorAll("td, th").forEach((c) => {
          const cell = c as HTMLElement;
          cell.style.border = "none";
          cell.classList.add("no-border");
        });
      }
    }

    if (tag === "TH" || tag === "TD") {
      const style = node.getAttribute("style") || "";
      const hasBorder =
        style.includes("border") ||
        Boolean(node.style.border) ||
        Boolean(node.style.borderTop);
      if (!hasBorder && !node.classList.contains("no-border")) {
        node.style.border = "1px solid #000000";
      }
      if (!node.style.padding && !style.includes("padding")) {
        node.style.padding = "2px 4px";
      }
      if (!node.style.color) node.style.color = "#000000";
    }

    if (tag === "IMG") {
      const img = node as HTMLImageElement;
      // Prefer fixed px for Word
      if (!img.getAttribute("width")) img.setAttribute("width", "90");
      node.style.maxWidth = "90px";
      node.style.height = "auto";
    }
  }
}

function promoteImgSrc(root: HTMLElement) {
  root.querySelectorAll("img").forEach((img) => {
    const el = img as HTMLImageElement;
    if (el.currentSrc && el.currentSrc.startsWith("data:")) {
      el.setAttribute("src", el.currentSrc);
    }
  });
}
