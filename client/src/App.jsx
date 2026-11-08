import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Skeleton } from './components/ui/EmptyState';
import { useAuth } from './hooks/useAuth';
import { AppShellLayout } from './layouts/AppShellLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { TripWorkspaceLayout } from './layouts/TripWorkspaceLayout';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { BookingsPage } from './pages/BookingsPage';
import { CreateTripPage } from './pages/CreateTripPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ItineraryPage } from './pages/ItineraryPage';
import { LoginPage } from './pages/LoginPage';
import { MembersPage } from './pages/MembersPage';
import { MyTripsPage } from './pages/MyTripsPage';
import { RegisterPage } from './pages/RegisterPage';
import { TasksPage } from './pages/TasksPage';
import { TripOverviewPage } from './pages/TripOverviewPage';
import { TripSettingsPage } from './pages/TripSettingsPage';
import { WelcomePage } from './pages/WelcomePage';

export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-8 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return children;
}

export function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/invite/:token" element={<AcceptInvitePage />} />
      </Route>

      {/* Authenticated Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppShellLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/trips" element={<MyTripsPage />} />
        <Route path="/trips/new" element={<CreateTripPage />} />

        <Route path="/trips/:tripId" element={<TripWorkspaceLayout />}>
          <Route index element={<TripOverviewPage />} />
          <Route path="itinerary" element={<ItineraryPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="settings" element={<TripSettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

