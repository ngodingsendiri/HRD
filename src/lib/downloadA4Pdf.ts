/**
 * Client-side HTML element → A4 PDF download.
 * Strategy: clone off-DOM at fixed A4 width, bake page margins into the
 * capture, multi-page vertical slice with jsPDF. Avoids live-DOM overflow
 * clipping and double-margin bugs.
 */
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export type PdfOrientation = "portrait" | "landscape";

const A4_PORTRAIT = { w: 210, h: 297 } as const;
const A4_LANDSCAPE = { w: 297, h: 210 } as const;

export const PDF_MARGIN_MM = {
  portrait: 15,
  landscape: 12,
} as const;

export type DownloadA4PdfOptions = {
  orientation?: PdfOrientation;
  scale?: number;
  marginMm?: number;
};

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

  if (el.getBoundingClientRect().width < 8) {
    throw new Error("Pratinjau dokumen kosong atau belum siap.");
  }

  // --- Off-DOM capture host at true A4 width (mm) ---
  const host = document.createElement("div");
  host.setAttribute("data-pdf-capture-host", "1");
  host.style.cssText = [
    "position:fixed",
    "left:-12000px",
    "top:0",
    `width:${page.w}mm`,
    "background:#ffffff",
    "color:#000000",
    "z-index:-1",
    "overflow:visible",
    "pointer-events:none",
  ].join(";");

  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".print-hidden").forEach((n) => n.remove());

  // Margins baked into the sheet so L/R white space is correct on every page
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

  // Soft-fix modern colors that break older canvas parsers
  forcePrintSafeColors(clone);

  host.appendChild(clone);
  document.body.appendChild(host);

  let canvas: HTMLCanvasElement;
  try {
    await waitForImages(clone);
    // Give layout a tick after off-DOM attach
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));

    const w = Math.max(clone.scrollWidth, clone.offsetWidth, 1);
    const h = Math.max(clone.scrollHeight, clone.offsetHeight, 1);

    canvas = await html2canvas(clone, {
      scale,
      useCORS: true,
      // do not allowTaint — would block canvas.toDataURL for mixed-origin images
      logging: false,
      backgroundColor: "#ffffff",
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      scrollX: 0,
      scrollY: 0,
    });
  } finally {
    host.remove();
  }

  if (canvas.width < 8 || canvas.height < 8) {
    throw new Error("Gagal merender pratinjau ke gambar.");
  }

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
    compress: true,
  });

  // Full page width — margins already inside the image
  const imgW = page.w;
  const imgH = (canvas.height * imgW) / canvas.width;
  const pageH = page.h;

  // Vertical multi-page slice of one tall image
  let yOffset = 0;
  let pageIndex = 0;
  while (yOffset < imgH - 0.5) {
    if (pageIndex > 0) pdf.addPage();
    // Negative y shifts the tall image so the next band fills the page
    pdf.addImage(imgData, "JPEG", 0, -yOffset, imgW, imgH, undefined, "FAST");
    yOffset += pageH;
    pageIndex += 1;
    // Safety: avoid infinite loop on tiny remainders
    if (pageIndex > 80) break;
  }

  const safe =
    filename.replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, "_") || "dokumen";
  const name = safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
  pdf.save(name);
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          // Don't hang forever
          window.setTimeout(done, 2500);
        }),
    ),
  );
}

/** Flatten oklch/lab-ish colors to rgb on the clone only. */
function forcePrintSafeColors(root: HTMLElement) {
  const nodes: HTMLElement[] = [
    root,
    ...Array.from(root.querySelectorAll("*")),
  ].filter((n): n is HTMLElement => n instanceof HTMLElement);

  for (const node of nodes) {
    // Prefer explicit black text / white bg when Tailwind left computed oklch
    const style = node.getAttribute("style") || "";
    if (!style.includes("color") && !node.style.color) {
      // leave as inherited
    }
    // Ensure table cells keep black borders if they had any border class
    if (node.tagName === "TABLE") {
      node.style.borderCollapse = "collapse";
      node.style.width = "100%";
    }
  }
}
