import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from './Button';
import { PAGE_SIZE_OPTIONS } from '@/hooks/usePagination';

interface PaginationProps {
  /** Page courante (1-indexée) */
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (s: number) => void;
  /** Masquer le sélecteur de taille de page */
  hidePageSize?: boolean;
  className?: string;
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  hidePageSize = false,
  className,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const debut = (page - 1) * pageSize + 1;
  const fin   = Math.min(page * pageSize, totalItems);

  // Génère les numéros de page à afficher (fenêtre de 5 autour de la page courante)
  function pages(): (number | '…')[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const result: (number | '…')[] = [1];
    if (page > 3)      result.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      result.push(i);
    }
    if (page < totalPages - 2) result.push('…');
    result.push(totalPages);
    return result;
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 py-3 text-sm',
        className,
      )}
      aria-label="Pagination"
    >
      {/* Info : x–y sur N */}
      <p className="text-muted-foreground">
        {debut}–{fin} sur {totalItems.toLocaleString('fr-FR')} résultat{totalItems > 1 ? 's' : ''}
      </p>

      <div className="flex items-center gap-1">
        {/* Première page */}
        <Button
          variant="ghost"
          size="sm"
          icon={<ChevronsLeft size={14} />}
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          aria-label="Première page"
          title="Première page"
        />

        {/* Page précédente */}
        <Button
          variant="ghost"
          size="sm"
          icon={<ChevronLeft size={14} />}
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Page précédente"
          title="Page précédente"
        />

        {/* Numéros de page */}
        {pages().map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                p === page
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-muted text-foreground',
              )}
            >
              {p}
            </button>
          ),
        )}

        {/* Page suivante */}
        <Button
          variant="ghost"
          size="sm"
          icon={<ChevronRight size={14} />}
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Page suivante"
          title="Page suivante"
        />

        {/* Dernière page */}
        <Button
          variant="ghost"
          size="sm"
          icon={<ChevronsRight size={14} />}
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          aria-label="Dernière page"
          title="Dernière page"
        />
      </div>

      {/* Sélecteur de taille de page */}
      {!hidePageSize && onPageSizeChange && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Lignes par page :</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={cn(
              'h-8 rounded-md border border-input bg-background px-2 text-xs',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            aria-label="Nombre de lignes par page"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
