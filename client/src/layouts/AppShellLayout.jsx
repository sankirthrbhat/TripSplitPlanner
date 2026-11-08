import { useState } from 'react';
import { Compass, LogOut, Luggage, Menu, Plus, X } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getInitials } from '../utils/format';

export function AppShellLayout() {
  const { user, logout, isLoggingOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.info('Signed out', 'Your session has been cleared.');
      navigate('/login');
    } catch (err) {
      toast.error('Logout failed', err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-canvas-border bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              to="/trips"
              className="flex items-center gap-2.5 font-bold tracking-tight text-ink transition-opacity duration-150 hover:opacity-90"
            >
              <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F766E] text-white shadow-sm">
                <Compass className="h-5 w-5" />
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-sunshine"
                />
              </span>
              <span className="text-base sm:text-lg">TripSplit Planner</span>
            </Link>

            <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-1.5">
              <NavLink
                to="/trips"
                end
                className={({ isActive }) =>
                  `rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#E9F5F3] text-[#0C5E57]'
                      : 'text-ink-body hover:bg-canvas-subtle hover:text-ink'
                  }`
                }
              >
                My Trips
              </NavLink>
              <NavLink
                to="/trips/new"
                className={({ isActive }) =>
                  `rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#E9F5F3] text-[#0C5E57]'
                      : 'text-ink-body hover:bg-canvas-subtle hover:text-ink'
                  }`
                }
              >
                New Trip
              </NavLink>
            </nav>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <Link
              to="/trips/new"
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#0F766E] px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#0D625B]"
            >
              <Plus className="h-4 w-4" />
              Create Trip
            </Link>
            <div className="flex items-center gap-2.5 border-l border-canvas-border pl-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
                {getInitials(user?.displayName)}
              </div>
              <div className="min-w-0 max-w-44 text-left leading-tight">
                <p className="truncate text-sm font-semibold text-ink">{user?.displayName}</p>
                <p className="truncate text-xs text-ink-muted">{user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#D4DDD9] bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-canvas-subtle"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-canvas-border bg-white text-ink transition-colors duration-150 hover:bg-canvas-subtle"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="lg:hidden border-t border-canvas-border bg-white px-4 py-4 space-y-3 shadow-card">
            <div className="flex items-center gap-3 pb-3 border-b border-canvas-border">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F766E] text-xs font-bold text-white">
                {getInitials(user?.displayName)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{user?.displayName}</p>
                <p className="text-xs text-ink-muted truncate">{user?.email}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Link
                to="/trips"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-ink hover:bg-canvas-subtle"
              >
                <Luggage className="h-4 w-4 text-[#0F766E]" />
                My Trips
              </Link>
              <Link
                to="/trips/new"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[44px] items-center gap-2.5 rounded-xl bg-[#E9F5F3] px-3.5 py-2 text-sm font-semibold text-[#0C5E57] hover:bg-[#D7ECE8]"
              >
                <Plus className="h-4 w-4" />
                Create Trip
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3.5 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
