/**
 * Client-side HTML → A4 PDF (html2canvas-pro + jsPDF).
 *
 * - Clones the sheet off-DOM at fixed A4 pixel width (no live overflow clip)
 * - Bakes L/R/T/B margin into the capture
 * - Multi-page via per-page canvas crops (no bleed / ghosting between pages)
 */
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export type PdfOrientation = "portrait" | "landscape";

/** CSS mm → px at 96dpi (browser standard). */
const MM_TO_PX = 96 / 25.4;

const A4_PORTRAIT_MM = { w: 210, h: 297 } as const;
const A4_LANDSCAPE_MM = { w: 297, h: 210 } as const;

export const PDF_MARGIN_MM = {
  portrait: 15,
  landscape: 12,
} as const;

export type DownloadA4PdfOptions = {
  orientation?: PdfOrientation;
  /** Canvas scale (2 = sharp). */
  scale?: number;
  marginMm?: number;
};

export async function downloadElementAsA4Pdf(
  el: HTMLElement,
  filename: string,
  options: DownloadA4PdfOptions = {},
): Promise<void> {
  const orientation: PdfOrientation = options.orientation ?? "portrait";
  const pageMm = orientation === "landscape" ? A4_LANDSCAPE_MM : A4_PORTRAIT_MM;
  const marginMm =
    options.marginMm ??
    (orientation === "landscape"
      ? PDF_MARGIN_MM.landscape
      : PDF_MARGIN_MM.portrait);
  const scale = options.scale ?? 2;

  if (el.getBoundingClientRect().width < 4) {
    throw new Error("Pratinjau dokumen kosong atau belum siap.");
  }

  const pageWpx = Math.round(pageMm.w * MM_TO_PX);

  // Off-DOM host — fixed pixel width so layout matches A4
  const host = document.createElement("div");
  host.setAttribute("data-pdf-capture-host", "1");
  host.style.cssText = [
    "position:fixed",
    "left:-14000px",
    "top:0",
    `width:${pageWpx}px`,
    "background:#ffffff",
    "color:#000000",
    "z-index:-1",
    "overflow:visible",
    "pointer-events:none",
  ].join(";");

  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".print-hidden").forEach((n) => n.remove());
  expandCssVars(clone);
  ensureTableBorders(clone);

  // Full sheet padding = page margin (single source of white edge)
  clone.style.cssText = [
    "display:block",
    "width:100%",
    "max-width:none",
    "min-height:0",
    "height:auto",
    "max-height:none",
    "box-sizing:border-box",
    `padding:${marginMm}mm`,
    "margin:0",
    "border:none",
    "box-shadow:none",
    "background:#ffffff",
    "color:#000000",
    "overflow:visible",
    "font-family:Arial,Helvetica,sans-serif",
  ].join(";");

  host.appendChild(clone);
  document.body.appendChild(host);

  let fullCanvas: HTMLCanvasElement;
  try {
    await waitForImages(clone);
    await nextFrame();
    await nextFrame();

    const w = Math.max(clone.scrollWidth, clone.offsetWidth, pageWpx);
    const h = Math.max(clone.scrollHeight, clone.offsetHeight, 1);

    fullCanvas = await html2canvas(clone, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      scrollX: 0,
      scrollY: 0,
      onclone: (_doc, cloned) => {
        expandCssVars(cloned);
        ensureTableBorders(cloned);
      },
    });
  } finally {
    host.remove();
  }

  if (fullCanvas.width < 8 || fullCanvas.height < 8) {
    throw new Error("Gagal merender pratinjau ke gambar.");
  }

  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
    compress: true,
  });

  // Map full canvas → page height in source pixels
  const pxPerMm = fullCanvas.width / pageMm.w;
  const pageHpx = Math.max(1, Math.round(pageMm.h * pxPerMm));
  const totalH = fullCanvas.height;
  const pageCount = Math.max(1, Math.ceil(totalH / pageHpx));

  for (let i = 0; i < pageCount; i++) {
    if (i > 0) pdf.addPage();

    const srcY = i * pageHpx;
    const sliceH = Math.min(pageHpx, totalH - srcY);
    if (sliceH <= 0) break;

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = fullCanvas.width;
    // Always full page height so short last page keeps bottom margin white
    pageCanvas.height = pageHpx;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D tidak tersedia.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      fullCanvas,
      0,
      srcY,
      fullCanvas.width,
      sliceH,
      0,
      0,
      fullCanvas.width,
      sliceH,
    );

    // PNG = sharp text/borders; quality matters for ASN docs
    const img = pageCanvas.toDataURL("image/png");
    pdf.addImage(img, "PNG", 0, 0, pageMm.w, pageMm.h, undefined, "FAST");
  }

  const safe =
    filename.replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, "_") || "dokumen";
  const name = safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
  pdf.save(name);
}

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          window.setTimeout(done, 3000);
        }),
    ),
  );
}

/** Resolve CSS custom properties (e.g. --print-cell-pad) to concrete values. */
function expandCssVars(root: HTMLElement) {
  const nodes = [root, ...Array.from(root.querySelectorAll("*"))].filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  );
  for (const node of nodes) {
    const pad = node.style.getPropertyValue("padding");
    if (pad && pad.includes("var(")) {
      const fallback = pad.match(/var\([^,]+,\s*([^)]+)\)/);
      if (fallback?.[1]) node.style.padding = fallback[1].trim();
    }
    // Also check individual longhands if set via CSS var in shorthand style attr
    const styleAttr = node.getAttribute("style") || "";
    if (styleAttr.includes("--print-cell-pad") || styleAttr.includes("var(")) {
      const cs = window.getComputedStyle(node);
      if (cs.padding && cs.padding !== "0px") {
        node.style.padding = cs.padding;
      }
    }
  }
}

function ensureTableBorders(root: HTMLElement) {
  root.querySelectorAll("table").forEach((t) => {
    const el = t as HTMLElement;
    el.style.borderCollapse = "collapse";
    el.style.width = "100%";
  });
  root.querySelectorAll("th, td").forEach((cell) => {
    const el = cell as HTMLElement;
    const b = el.style.border || el.getAttribute("style") || "";
    if (!b.includes("border") && !el.style.borderTop) {
      el.style.border = "1px solid #000000";
    }
    if (!el.style.color) el.style.color = "#000000";
  });
}
