import {
  Activity,
  FileText,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings2,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/misc';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

// Application chrome: a fixed left rail plus a routed content area.

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/events', label: 'Detections', icon: Activity },
  { to: '/uploads', label: 'Log sources', icon: Upload },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/registry', label: 'AI registry', icon: ShieldCheck },
  { to: '/settings', label: 'Risk settings', icon: Settings2 },
  { to: '/audit', label: 'Audit trail', icon: ScrollText, adminOnly: true },
];

export function AppShell(): JSX.Element {
  const { user, isAdmin, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="bg-mesh min-h-screen">
      {/* Mobile scrim */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface/95 backdrop-blur transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-line px-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-accent" aria-hidden />
            <span className="text-sm font-semibold tracking-tight">ShadowScan</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Main">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-elevated font-medium text-fg'
                    : 'text-fg-muted hover:bg-elevated/60 hover:text-fg',
                )
              }
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Separator />

        <div className="p-3">
          <div className="mb-2 px-1">
            <p className="truncate text-xs font-medium text-fg">{user?.name}</p>
            <p className="truncate text-[11px] text-fg-subtle">
              {user?.email} · {user?.role}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <LayoutDashboard />
          </Button>
          <p className="text-xs text-fg-subtle">
            {visibleItems.find((item) => location.pathname.startsWith(item.to))?.label ?? 'ShadowScan'}
          </p>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
