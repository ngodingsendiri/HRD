/** Shared @page + print media CSS for Cetak (injected once in Print.tsx). */
export const PRINT_PAGE_CSS = `
@page {
  size: A4 portrait;
  margin: 15mm;
}
@media print {
  body {
    background-color: white !important;
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
}
`;
