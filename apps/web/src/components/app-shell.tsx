import {
  Activity,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings2,
  ShieldHalf,
  Upload,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

// Fixed left rail. Investigating means jumping between the overview, the event
// table and settings constantly, and every one of those should be one click
// with nothing to expand first.

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Monitor',
    items: [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/events', label: 'Detections', icon: Activity },
      { to: '/reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    heading: 'Manage',
    items: [
      { to: '/uploads', label: 'Log sources', icon: Upload },
      { to: '/registry', label: 'AI registry', icon: ShieldHalf },
      { to: '/settings', label: 'Risk settings', icon: Settings2 },
      { to: '/audit', label: 'Audit trail', icon: ScrollText, adminOnly: true },
    ],
  },
];

export function AppShell(): JSX.Element {
  const { user, isAdmin, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((group) => group.items.length > 0);

  const current = groups.flatMap((g) => g.items).find((i) => location.pathname.startsWith(i.to));

  return (
    <div className="min-h-screen">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-52 flex-col border-r border-line bg-surface transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-10 items-center justify-between gap-2 border-b border-line px-3">
          <div className="flex items-center gap-2">
            <ShieldHalf className="size-4 text-accent" aria-hidden />
            <span className="text-body font-semibold tracking-tight">ShadowScan</span>
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

        <nav className="flex-1 overflow-y-auto py-2" aria-label="Main">
          {groups.map((group) => (
            <div key={group.heading} className="mb-3">
              <p className="eyebrow px-3 pb-1.5">{group.heading}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 border-l-2 py-1.5 pl-[10px] pr-3 text-body',
                      isActive
                        ? 'border-accent bg-elevated font-medium text-fg'
                        : 'border-transparent text-fg-muted hover:bg-elevated/60 hover:text-fg',
                    )
                  }
                >
                  <item.icon className="size-3.5 shrink-0" aria-hidden />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-3 py-2">
          <p className="truncate text-meta text-fg">{user?.name}</p>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="eyebrow truncate">{user?.role}</span>
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-1 text-meta text-fg-subtle hover:text-fg"
            >
              <LogOut className="size-3" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-52">
        <header className="sticky top-0 z-20 flex h-10 items-center gap-2 border-b border-line bg-canvas/90 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <span className="text-meta text-fg-subtle">ShadowScan</span>
          <span className="text-meta text-fg-subtle">/</span>
          <span className="text-meta text-fg-muted">{current?.label ?? 'Console'}</span>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-3">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
