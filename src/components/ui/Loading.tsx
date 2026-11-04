import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return <Loader2 className={`animate-spin text-blue-600 ${className}`} style={{ width: size, height: size }} />;
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size={40} />
        <p className="text-sm text-slate-500 dark:text-slate-400">A carregar...</p>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="mb-3 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mb-2 h-8 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="h-4 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-4 w-16 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Loader2;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-slate-100 p-4 dark:bg-slate-800">
        <Icon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mb-4 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action}
    </div>
  );
}
