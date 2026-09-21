import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  className?: string;
  size?: number;
  label?: string;
}

export default function Spinner({ className, size = 20, label = 'Chargement...' }: SpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2 text-muted-foreground', className)}>
      <Loader2 size={size} className="animate-spin" aria-hidden="true" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
