import { useMemo, useState } from 'react';

export interface UsePaginationOptions {
  /** Nombre d'éléments par page (défaut : 15) */
  pageSize?: number;
}

export interface UsePaginationReturn<T> {
  /** Page courante (1-indexée) */
  page: number;
  /** Nombre total de pages */
  totalPages: number;
  /** Nombre total d'éléments */
  totalItems: number;
  /** Taille de page courante */
  pageSize: number;
  /** Sous-ensemble d'éléments pour la page courante */
  items: T[];
  /** Aller à la page suivante */
  nextPage: () => void;
  /** Aller à la page précédente */
  prevPage: () => void;
  /** Aller à une page précise */
  goToPage: (p: number) => void;
  /** Changer la taille de page */
  setPageSize: (s: number) => void;
  /** Remettre à la première page (utile après un changement de filtre) */
  reset: () => void;
}

export const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100] as const;

export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {},
): UsePaginationReturn<T> {
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSizeState] = useState(options.pageSize ?? 15);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Si les filtres externes réduisent totalPages en dessous de page courante,
  // on recadre automatiquement.
  const currentPage = Math.min(page, totalPages);

  const items = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  function nextPage() {
    setPage((p) => Math.min(p + 1, totalPages));
  }

  function prevPage() {
    setPage((p) => Math.max(p - 1, 1));
  }

  function goToPage(p: number) {
    setPage(Math.max(1, Math.min(p, totalPages)));
  }

  function setPageSize(s: number) {
    setPageSizeState(s);
    setPage(1);
  }

  function reset() {
    setPage(1);
  }

  return {
    page: currentPage,
    totalPages,
    totalItems,
    pageSize,
    items,
    nextPage,
    prevPage,
    goToPage,
    setPageSize,
    reset,
  };
}
