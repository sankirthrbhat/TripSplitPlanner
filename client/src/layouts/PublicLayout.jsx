import { Compass } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function PublicLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-canvas-border bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-bold tracking-tight text-ink transition-opacity duration-150 hover:opacity-90"
          >
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F766E] text-white shadow-sm">
              <Compass className="h-5 w-5" />
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-coral"
              />
            </span>
            <span className="text-base sm:text-lg">TripSplit Planner</span>
          </Link>

          <nav aria-label="Public navigation" className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <Link
                to="/trips"
                className="inline-flex min-h-[40px] items-center rounded-xl bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#0D625B]"
              >
                Go to My Trips
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex min-h-[40px] items-center rounded-xl px-3.5 py-2 text-sm font-semibold text-ink-body transition-colors duration-150 hover:bg-canvas-subtle hover:text-ink"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex min-h-[40px] items-center rounded-xl bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#0D625B]"
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

      <footer className="border-t border-canvas-border bg-white py-6 text-center text-xs text-ink-muted">
        <div className="mx-auto max-w-6xl px-4">
          TripSplit Planner — Collaborative Group Trip Planning, Conflict Detection &amp; Expense Splitting
        </div>
      </footer>
    </div>
  );
}

