import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Truck,
  Receipt,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ─── Définition de la navigation ─────────────────────────────────────────────
interface NavChild {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  {
    label: 'Tableau de bord',
    icon: <LayoutDashboard size={17} />,
    href: '/',
  },
  {
    label: 'Référentiels',
    icon: <Layers size={17} />,
    href: '/referentiels',
    children: [
      { label: 'Saisons',     href: '/referentiels/saisons' },
      { label: 'Tarifs',      href: '/referentiels/tarifs' },
      { label: 'Prix Gasoil', href: '/referentiels/prix-gasoil' },
      { label: 'Clients',     href: '/referentiels/clients' },
    ],
  },
  {
    label: 'Opérations',
    icon: <Truck size={17} />,
    href: '/operations',
    children: [
      { label: 'Pesées',      href: '/operations/pesees' },
      { label: 'Bordereaux',  href: '/operations/bordereaux' },
      { label: 'Livraisons',  href: '/operations/livraisons' },
    ],
  },
  {
    label: 'Finance',
    icon: <Receipt size={17} />,
    href: '/finance',
    children: [
      { label: 'Factures',   href: '/finance/factures' },
      { label: 'Paiements',  href: '/finance/paiements' },
      { label: 'Avances',    href: '/finance/avances' },
    ],
  },
  {
    label: 'Rapports',
    icon: <BarChart2 size={17} />,
    href: '/rapports',
    children: [
      { label: 'Récapitulatif',  href: '/rapports/recap' },
      { label: 'Rapport Annuel', href: '/rapports/annuel' },
      { label: 'Export Excel',   href: '/rapports/export-excel' },
      { label: 'Export PDF',     href: '/rapports/export-pdf' },
    ],
  },
  {
    label: 'Paramètres',
    icon: <Settings size={17} />,
    href: '/parametres',
  },
];

// ─── Composant section de nav ─────────────────────────────────────────────────
function NavSection({
  item,
  collapsed,
}: {
  item: NavItem;
  collapsed: boolean;
}) {
  const location = useLocation();

  // Le groupe est actif si l'URL courante commence par le préfixe du groupe
  const isGroupActive =
    item.href !== '/' && location.pathname.startsWith(item.href);

  // État ouvert/fermé du groupe (par défaut ouvert si groupe actif)
  const [open, setOpen] = useState(isGroupActive);

  if (!item.children) {
    // Lien simple
    return (
      <NavLink
        to={item.href}
        end
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-foreground hover:bg-muted hover:text-primary',
          )
        }
        title={collapsed ? item.label : undefined}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && <span>{item.label}</span>}
      </NavLink>
    );
  }

  // Groupe avec enfants
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-2 text-sm font-medium transition-colors',
          isGroupActive
            ? 'text-primary'
            : 'text-foreground hover:bg-muted hover:text-primary',
        )}
        title={collapsed ? item.label : undefined}
        aria-expanded={open && !collapsed}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </>
        )}
      </button>

      {/* Sous-menu */}
      {!collapsed && open && (
        <div className="pb-1">
          {item.children.map((child) => (
            <NavLink
              key={child.href}
              to={child.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center py-1.5 pl-11 pr-4 text-sm transition-colors',
                  isActive
                    ? 'font-medium text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-primary hover:bg-muted',
                )
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar principale ───────────────────────────────────────────────────────
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'no-print flex flex-col border-r border-border bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <span className="text-lg font-bold text-primary">ABAF</span>
        )}
        <button
          onClick={onToggle}
          className="ml-auto rounded p-1 hover:bg-muted transition-colors"
          aria-label={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Navigation principale">
        {navItems.map((item) => (
          <NavSection key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Version */}
      {!collapsed && (
        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          ABAF SARL – v0.1.0
        </div>
      )}
    </aside>
  );
}
