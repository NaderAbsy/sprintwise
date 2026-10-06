import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <p className="mt-4 font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5 flex w-full justify-center">{action}</div>}
    </div>
  );
}
