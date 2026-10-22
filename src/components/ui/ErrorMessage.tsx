import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  message: string;
  className?: string;
}

export default function ErrorMessage({ message, className }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-2 rounded-md border border-destructive/30',
        'bg-destructive/5 px-3 py-2 text-sm text-destructive',
        className,
      )}
    >
      <AlertCircle size={14} className="shrink-0" />
      {message}
    </div>
  );
}
