import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/app-shell';
import { EmptyState, Spinner } from '@/components/layout-parts';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { AuditPage } from '@/pages/audit';
import { DashboardPage } from '@/pages/dashboard';
import { EventsPage } from '@/pages/events';
import { LoginPage } from '@/pages/login';
import { RegistryPage } from '@/pages/registry';
import { ReportDetailPage } from '@/pages/report-detail';
import { ReportsPage } from '@/pages/reports';
import { SettingsPage } from '@/pages/settings';
import { UploadsPage } from '@/pages/uploads';
import { Link } from 'react-router-dom';

// Route table.
export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/uploads" element={<UploadsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/:id" element={<ReportDetailPage />} />
        <Route path="/registry" element={<RegistryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="/audit"
          element={
            <RequireAdmin>
              <AuditPage />
            </RequireAdmin>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  // 'checking' must not render the sign-in screen, or every page refresh flashes
  // a login form at users who are already authenticated.
  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6 text-accent" />
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }): JSX.Element {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <EmptyState
        title="Administrator access required"
        description="This view is limited to administrator accounts. Ask an administrator to grant your account the role, or return to the overview."
        action={
          <Button asChild size="sm">
            <Link to="/dashboard">Back to overview</Link>
          </Button>
        }
      />
    );
  }
  return children;
}

function NotFoundPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <EmptyState
        title="Page not found"
        description="That route does not exist in the console."
        action={
          <Button asChild variant="primary" size="sm">
            <Link to="/dashboard">Back to overview</Link>
          </Button>
        }
      />
    </div>
  );
}
