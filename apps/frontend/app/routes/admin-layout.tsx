import { listMessageReports } from '@constancia/api-client/endpoints/admin/admin';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, NavLink, Outlet, redirect, useLoaderData } from 'react-router';
import { buildServerApiOptions } from '@/lib/api-proxy.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const response = await listMessageReports({ status: 'pending' }, buildServerApiOptions(request));
  if (response.status !== 'ok') {
    throw redirect('/');
  }

  return { pendingCount: response.data.length };
}

export default function AdminLayout() {
  const { pendingCount } = useLoaderData<typeof loader>();

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link className="admin-brand" to="/admin">
          <span>Constancia</span>
          <strong>Operator desk</strong>
        </Link>
        <nav className="admin-nav" aria-label="Moderation">
          <NavLink to="/admin/reports">
            Reports <span>{pendingCount}</span>
          </NavLink>
          <NavLink to="/admin/bans">Access controls</NavLink>
        </nav>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
