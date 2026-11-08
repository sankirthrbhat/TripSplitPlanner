import { Compass } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function PublicLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-slate-900">
      <header className="sticky top-0 z-30 border-b border-navy-800 bg-navy-900 text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
              <Compass className="h-5 w-5" />
            </span>
            <span className="text-base sm:text-lg">TripSplit Planner</span>
          </Link>

          <nav aria-label="Public navigation" className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <Link
                to="/trips"
                className="rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-500"
              >
                Go to My Trips
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-200 hover:bg-navy-800 hover:text-white"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-500"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-canvas-border bg-white py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-6xl px-4">
          TripSplit Planner — Collaborative Group Trip Planning, Conflict Detection & Expense Splitting
        </div>
      </footer>
    </div>
  );
}

