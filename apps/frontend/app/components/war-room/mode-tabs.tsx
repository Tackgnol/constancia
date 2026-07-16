import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';

export interface WarRoomModeTab {
  to: string;
  label: string;
  end?: boolean;
}

function normalizePathname(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

export function WarRoomModeTabs({ tabs }: { tabs: WarRoomModeTab[] }) {
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const currentPathname = normalizePathname(location.pathname);

  useEffect(() => {
    const activeTab = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    activeTab?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [location.pathname]);

  return (
    <div className="mode-tabs-frame">
      <nav ref={navRef} className="mode-tabs" aria-label="War room modes">
        {tabs.map((tab) => {
          const tabPathname = normalizePathname(tab.to);
          const isActive = tab.end
            ? currentPathname === tabPathname
            : currentPathname === tabPathname || currentPathname.startsWith(`${tabPathname}/`);

          return (
            <Link
              key={tab.to}
              aria-current={isActive ? 'page' : undefined}
              className={`mode-tab${isActive ? ' is-active' : ''}`}
              to={tab.to}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
