import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <div className="border-b border-border bg-card/40 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="px-6 lg:px-8 py-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {eyebrow}
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="p-6 lg:p-8 space-y-6">{children}</div>;
}

interface PlaceholderProps {
  title: string;
  description: string;
  icon?: ReactNode;
}
export function Placeholder({ title, description, icon }: PlaceholderProps) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
      {icon && <div className="mx-auto mb-3 h-10 w-10 grid place-items-center rounded-md bg-muted text-muted-foreground">{icon}</div>}
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{description}</p>
      <p className="mt-4 text-xs text-muted-foreground">Coming in a follow-up — this is a foundation build.</p>
    </div>
  );
}
