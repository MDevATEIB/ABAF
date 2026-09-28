import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

let modalOuvertsCount = 0;
let savedOverflow = '';
let savedPosition = '';
let savedTop = '';
let savedWidth = '';
let savedScrollY = 0;

function lockBodyScroll() {
  if (modalOuvertsCount === 0) {
    savedOverflow = document.body.style.overflow;
    savedPosition = document.body.style.position;
    savedTop = document.body.style.top;
    savedWidth = document.body.style.width;
    savedScrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = '100%';
  }
  modalOuvertsCount += 1;
}

function unlockBodyScroll() {
  modalOuvertsCount = Math.max(0, modalOuvertsCount - 1);
  if (modalOuvertsCount === 0) {
    const y = parseInt(document.body.style.top || '0', 10) * -1;
    document.body.style.overflow = savedOverflow;
    document.body.style.position = savedPosition;
    document.body.style.top = savedTop;
    document.body.style.width = savedWidth;
    window.scrollTo(0, y || savedScrollY);
  }
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);

    lockBodyScroll();

    return () => {
      window.removeEventListener('keydown', handler);
      unlockBodyScroll();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenu : hauteur max + layout en colonne pour scroll interne */}
      <div
        className={cn(
          'relative z-10 w-full rounded-lg bg-card shadow-xl border border-border',
          'max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden',
          sizeClasses[size],
          className,
        )}
      >
        {/* En-tête — reste fixe quand le corps défile */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-foreground">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-muted transition-colors"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corps — scroll vertical si le contenu dépasse */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
