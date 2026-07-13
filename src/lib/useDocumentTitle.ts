import { useEffect } from "react";

/**
 * Sets `document.title` as "{page} · HRD ASN".
 * Pass `null` to skip (e.g. Layout on form routes so the page owns the title).
 */
export function useDocumentTitle(page: string | null) {
  useEffect(() => {
    if (page === null) return;
    const prev = document.title;
    document.title = page ? `${page} · HRD ASN` : "HRD ASN";
    return () => {
      document.title = prev;
    };
  }, [page]);
}
