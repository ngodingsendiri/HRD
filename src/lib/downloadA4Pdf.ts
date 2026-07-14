/**
 * Client-side HTML element → A4 PDF download (no server/Puppeteer).
 */
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_W_MM = 210;
const A4_H_MM = 297;

export async function downloadElementAsA4Pdf(
  el: HTMLElement,
  filename: string,
): Promise<void> {
  // Hide non-print UI inside the sheet if any slipped in
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    // Avoid capturing UI chrome accidentally placed inside
    ignoreElements: (node) =>
      node instanceof HTMLElement && node.classList.contains("print-hidden"),
  });

  const imgData = canvas.toDataURL("image/png", 1.0);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const imgWidth = A4_W_MM;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
  heightLeft -= A4_H_MM;

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
    heightLeft -= A4_H_MM;
  }

  const safe =
    filename.replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, "_") || "dokumen";
  const name = safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
  pdf.save(name);
}
