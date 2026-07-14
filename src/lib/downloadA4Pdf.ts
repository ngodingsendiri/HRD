/**
 * Client-side HTML element → A4 PDF download (no server/Puppeteer).
 * Uses html2canvas-pro (oklch/lab support) + jsPDF multi-page.
 */
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export type PdfOrientation = "portrait" | "landscape";

const A4_PORTRAIT = { w: 210, h: 297 } as const;
const A4_LANDSCAPE = { w: 297, h: 210 } as const;

export type DownloadA4PdfOptions = {
  /** Default portrait. Use landscape for wide tables (e.g. DUK). */
  orientation?: PdfOrientation;
  /** Canvas scale (2 = sharp; 1.5 faster for large sheets). */
  scale?: number;
};

/**
 * Capture a print sheet DOM node and save as multi-page A4 PDF.
 * Content taller than one page is sliced across pages.
 */
export async function downloadElementAsA4Pdf(
  el: HTMLElement,
  filename: string,
  options: DownloadA4PdfOptions = {},
): Promise<void> {
  const orientation: PdfOrientation = options.orientation ?? "portrait";
  const page = orientation === "landscape" ? A4_LANDSCAPE : A4_PORTRAIT;
  const scale = options.scale ?? 2;

  // Snapshot dimensions before capture (avoids 0-size during layout thrash)
  const rect = el.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) {
    throw new Error("Pratinjau dokumen kosong atau belum siap.");
  }

  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    // Prefer window width of the sheet, not the viewport
    windowWidth: Math.ceil(el.scrollWidth || rect.width),
    windowHeight: Math.ceil(el.scrollHeight || rect.height),
    ignoreElements: (node) =>
      node instanceof HTMLElement && node.classList.contains("print-hidden"),
    onclone: (_doc, cloned) => {
      // Print-safe monochrome fallbacks: avoid any remaining modern color fns
      // on inherited UI chrome that might sneak into the clone.
      sanitizeCloneColors(cloned);
      cloned.style.boxShadow = "none";
      cloned.style.border = "none";
    },
  });

  const imgData = canvas.toDataURL("image/png", 1.0);
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageW = page.w;
  const pageH = page.h;

  // Fit full width; height scales proportionally (may span multiple pages)
  const imgWidth = pageW;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
  heightLeft -= pageH;

  while (heightLeft > 1) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(
      imgData,
      "PNG",
      0,
      position,
      imgWidth,
      imgHeight,
      undefined,
      "FAST",
    );
    heightLeft -= pageH;
  }

  const safe =
    filename.replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, "_") || "dokumen";
  const name = safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
  pdf.save(name);
}

/** Force computed colors onto inline styles as rgb/hex (Tailwind v4 safety net). */
function sanitizeCloneColors(root: HTMLElement) {
  const nodes: HTMLElement[] = [root, ...Array.from(root.querySelectorAll("*"))].filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  );

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
    // Drop filters/shadows that can carry unsupported color functions
    if (cs.boxShadow && cs.boxShadow !== "none") {
      node.style.setProperty("box-shadow", "none", "important");
    }
    if (cs.textShadow && cs.textShadow !== "none") {
      node.style.setProperty("text-shadow", "none", "important");
    }
  }
}

/** Convert any CSS color the browser understands into rgb()/hex for html2canvas. */
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
    // Browser normalizes to #rrggbb when possible
    return String(ctx.fillStyle || "#000000");
  } catch {
    return "#000000";
  }
}
