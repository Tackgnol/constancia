import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SetupNotice({
  label,
  children,
  tone = 'default',
  role,
}: {
  label: string;
  children: ReactNode;
  tone?: 'default' | 'error';
  role?: 'status' | 'alert';
}) {
  return (
	<div
	  className={cn('setup-notice', tone === 'error' && 'is-error')}
	  role={role ?? (tone === 'error' ? 'alert' : 'status')}
	>
	  <p className="detail-label">{label}</p>
	  {children}
	</div>
  );
}

