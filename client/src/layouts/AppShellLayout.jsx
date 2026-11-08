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
    <div className="min-h-screen flex flex-col bg-canvas text-slate-900">
      <header className="sticky top-0 z-30 border-b border-navy-800 bg-navy-900 text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="/trips" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
                <Compass className="h-5 w-5" />
              </span>
              <span className="text-base sm:text-lg">TripSplit Planner</span>
            </Link>

            <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1">
              <NavLink
                to="/trips"
                end
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-navy-800 text-teal-300'
                      : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                  }`
                }
              >
                My Trips
              </NavLink>
              <NavLink
                to="/trips/new"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-navy-800 text-teal-300'
                      : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                  }`
                }
              >
                New Trip
              </NavLink>
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link
              to="/trips/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-500"
            >
              <Plus className="h-4 w-4" />
              Create Trip
            </Link>
            <div className="flex items-center gap-2.5 border-l border-navy-700 pl-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white">
                {getInitials(user?.displayName)}
              </div>
              <div className="text-left leading-tight">
                <p className="text-sm font-medium text-white">{user?.displayName}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-navy-800 hover:text-white"
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
            className="md:hidden rounded-lg p-2 text-slate-200 hover:bg-navy-800"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="md:hidden border-t border-navy-800 bg-navy-900 px-4 py-4 space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-navy-800">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white">
                {getInitials(user?.displayName)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.displayName}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Link
                to="/trips"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-200 hover:bg-navy-800"
              >
                <Luggage className="h-4 w-4" />
                My Trips
              </Link>
              <Link
                to="/trips/new"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-teal-300 hover:bg-navy-800"
              >
                <Plus className="h-4 w-4" />
                Create Trip
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-300 hover:bg-navy-800"
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
