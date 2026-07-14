import type { CSSProperties } from "react";

/** Shared @page + print media CSS for Cetak (injected once in Print.tsx). */
export const PRINT_PAGE_CSS = `
@page {
  size: A4 portrait;
  margin: 12mm;
}
@page landscape-a4 {
  size: A4 landscape;
  margin: 10mm;
}
@media print {
  body {
    background-color: white !important;
    background-image: none !important;
  }
  .print-hidden {
    display: none !important;
  }
  .page-break-inside-avoid {
    page-break-inside: avoid;
  }
  .print-container {
    width: 100% !important;
    max-width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }
  .print-container.print-landscape {
    page: landscape-a4;
  }
  .print-sheet {
    color: #000000 !important;
    background-color: #ffffff !important;
    font-family: Arial, Helvetica, sans-serif !important;
  }
  .print-sheet table {
    width: 100% !important;
    border-collapse: collapse !important;
  }
  .print-sheet th,
  .print-sheet td {
    border: 1px solid #000000 !important;
    color: #000000 !important;
  }
  .print-sheet thead th {
    background-color: #f3f4f6 !important;
  }
}
`;

/** Preview + PDF sheet density from row count (and wide layouts). */
export type PrintDensity = "comfortable" | "normal" | "compact";

export function densityFromRowCount(n: number): PrintDensity {
  if (n > 45) return "compact";
  if (n > 22) return "normal";
  return "comfortable";
}

/** Inline styles for print tables — hex only (no Tailwind oklch). */
export function tableDensityStyle(
  density: PrintDensity,
  landscape: boolean,
): CSSProperties {
  const fontPt =
    density === "compact"
      ? landscape
        ? 7.5
        : 9
      : density === "normal"
        ? landscape
          ? 8.5
          : 10
        : landscape
          ? 9
          : 11;
  const cellPad =
    density === "compact"
      ? "1px 3px"
      : density === "normal"
        ? "2px 4px"
        : "3px 6px";
  const lineHeight = density === "compact" ? 1.15 : 1.25;
  return {
    fontSize: `${fontPt}pt`,
    lineHeight,
    ["--print-cell-pad" as string]: cellPad,
  };
}
