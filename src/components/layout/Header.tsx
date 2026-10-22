import { Menu } from 'lucide-react';
import { useAppStore } from '@/stores/app.store';

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { pageTitle, saisonActive } = useAppStore();

  return (
    <header className="no-print flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="rounded p-1 hover:bg-muted md:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-foreground">{pageTitle}</h1>
      </div>

      {saisonActive && (
        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Campagne : {saisonActive.libelle}
        </div>
      )}
    </header>
  );
}
