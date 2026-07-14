/**
 * Client-side HTML element → A4 PDF download (no server/Puppeteer).
 * Uses html2canvas-pro (oklch/lab support) + jsPDF multi-page with page margins.
 */
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export type PdfOrientation = "portrait" | "landscape";

const A4_PORTRAIT = { w: 210, h: 297 } as const;
const A4_LANDSCAPE = { w: 297, h: 210 } as const;

/** Official-doc margins (mm). Portrait a bit roomier; landscape tighter for wide tables. */
export const PDF_MARGIN_MM = {
  portrait: 15,
  landscape: 12,
} as const;

export type DownloadA4PdfOptions = {
  /** Default portrait. Use landscape for wide tables (e.g. DUK). */
  orientation?: PdfOrientation;
  /** Canvas scale (2 = sharp; 1.5 faster for large sheets). */
  scale?: number;
  /** Override page margin in mm (default 15 portrait / 12 landscape). */
  marginMm?: number;
};

/**
 * Capture a print sheet DOM node and save as multi-page A4 PDF.
 * Content is placed inside page margins (not edge-to-edge).
 */
export async function downloadElementAsA4Pdf(
  el: HTMLElement,
  filename: string,
  options: DownloadA4PdfOptions = {},
): Promise<void> {
  const orientation: PdfOrientation = options.orientation ?? "portrait";
  const page = orientation === "landscape" ? A4_LANDSCAPE : A4_PORTRAIT;
  const marginMm =
    options.marginMm ??
    (orientation === "landscape"
      ? PDF_MARGIN_MM.landscape
      : PDF_MARGIN_MM.portrait);
  const scale = options.scale ?? 2;

  const contentW = page.w - marginMm * 2;
  const contentH = page.h - marginMm * 2;
  if (contentW < 40 || contentH < 40) {
    throw new Error("Margin PDF terlalu besar untuk halaman A4.");
  }

  const rect = el.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) {
    throw new Error("Pratinjau dokumen kosong atau belum siap.");
  }

  // Temporarily unclip overflow ancestors so tall sheets capture fully
  const restoreOverflow: Array<{ el: HTMLElement; value: string }> = [];
  let walk: HTMLElement | null = el.parentElement;
  while (walk && walk !== document.body) {
    const ov = window.getComputedStyle(walk).overflow;
    if (ov === "auto" || ov === "scroll" || ov === "hidden") {
      restoreOverflow.push({ el: walk, value: walk.style.overflow });
      walk.style.overflow = "visible";
    }
    walk = walk.parentElement;
  }

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(el, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: Math.ceil(el.scrollWidth || rect.width),
      windowHeight: Math.ceil(Math.max(el.scrollHeight, rect.height)),
      ignoreElements: (node) =>
        node instanceof HTMLElement && node.classList.contains("print-hidden"),
      onclone: (_doc, cloned) => {
        sanitizeCloneColors(cloned);
        // Capture body only — page margins are applied by jsPDF, not double padding
        cloned.style.boxShadow = "none";
        cloned.style.border = "none";
        cloned.style.margin = "0";
        // Keep a tiny inner pad so table borders never kiss the content box edge
        cloned.style.padding = "2mm";
        cloned.style.boxSizing = "border-box";
        cloned.style.backgroundColor = "#ffffff";
        cloned.style.height = "auto";
        cloned.style.maxHeight = "none";
        cloned.style.overflow = "visible";
      },
    });
  } finally {
    for (const { el: node, value } of restoreOverflow) {
      node.style.overflow = value;
    }
  }

  const imgData = canvas.toDataURL("image/png", 1.0);
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
    compress: true,
  });

  // Fit image to content box (inside margins), keep aspect ratio
  const imgWidth = contentW;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  // Y of image top on current page (starts at top margin)
  let position = marginMm;

  pdf.addImage(
    imgData,
    "PNG",
    marginMm,
    position,
    imgWidth,
    imgHeight,
    undefined,
    "FAST",
  );
  heightLeft -= contentH;

  while (heightLeft > 1) {
    // Shift image up so the next slice appears in the content box
    position = marginMm - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(
      imgData,
      "PNG",
      marginMm,
      position,
      imgWidth,
      imgHeight,
      undefined,
      "FAST",
    );
    heightLeft -= contentH;
  }

  const safe =
    filename.replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, "_") || "dokumen";
  const name = safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
  pdf.save(name);
}

/** Force computed colors onto inline styles as rgb/hex (Tailwind v4 safety net). */
function sanitizeCloneColors(root: HTMLElement) {
  const nodes: HTMLElement[] = [
    root,
    ...Array.from(root.querySelectorAll("*")),
  ].filter((n): n is HTMLElement => n instanceof HTMLElement);

  const colorProps = [
    "color",
    "background-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "text-decoration-color",
    "column-rule-color",
    "caret-color",
  ] as const;

  for (const node of nodes) {
    const cs = window.getComputedStyle(node);
    for (const prop of colorProps) {
      const raw = cs.getPropertyValue(prop);
      if (!raw || raw === "transparent" || raw === "rgba(0, 0, 0, 0)") continue;
      const safe = cssColorToRgb(raw);
      if (safe) node.style.setProperty(prop, safe, "important");
    }
    if (cs.boxShadow && cs.boxShadow !== "none") {
      node.style.setProperty("box-shadow", "none", "important");
    }
    if (cs.textShadow && cs.textShadow !== "none") {
      node.style.setProperty("text-shadow", "none", "important");
    }
  }
}

function cssColorToRgb(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (
    v.startsWith("#") ||
    v.startsWith("rgb") ||
    v === "transparent" ||
    v === "currentcolor"
  ) {
    return v;
  }
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return "#000000";
    ctx.fillStyle = "#000000";
    ctx.fillStyle = v;
    return String(ctx.fillStyle || "#000000");
  } catch {
    return "#000000";
  }
}
