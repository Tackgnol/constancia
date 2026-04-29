import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function ManagementWorkspace({
  eyebrow,
  title,
  description,
  meta,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('management-workspace', className)}>
      <section className="management-hero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="hero-copy">{description}</p>
        </div>
        {meta ? <div className="management-hero-meta">{meta}</div> : null}
      </section>

      {children}
    </div>
  );
}
