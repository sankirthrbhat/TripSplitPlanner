import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Compass,
  Hotel,
  IndianRupee,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function WelcomePage() {
  const { isAuthenticated } = useAuth();

  const capabilities = [
    {
      icon: CalendarClock,
      title: 'Chronological Itinerary & Overlap Alerts',
      description:
        'Plan multi-day schedules in your trip timezone. The backend automatically detects and explains overlapping activities using UTC timestamp comparisons.',
    },
    {
      icon: IndianRupee,
      title: 'Deterministic Paise Expense Engine',
      description:
        'Track planned and paid costs in integer paise (INR). Supports exact equal splitting with remainder distribution and validated custom splits.',
    },
    {
      icon: Users,
      title: 'Paid-Only Settlement Transfers',
      description:
        'See each member’s estimated total trip cost and net balance. Generates minimum debtor-to-creditor transfers strictly from paid expenses.',
    },
    {
      icon: Hotel,
      title: 'Bookings, Tasks & Trip Pulse',
      description:
        'Organize stays, transport references, and member responsibilities with a transparent, rule-based Trip Pulse readiness indicator.',
    },
  ];

  return (
    <div className="space-y-16 py-10 sm:py-16">
      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl bg-navy-900 text-white p-8 sm:p-12 lg:p-16 border border-navy-800 shadow-lg">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-700/60 bg-teal-950/60 px-3.5 py-1 text-xs font-medium text-teal-300">
              <Compass className="h-3.5 w-3.5" />
              Collaborative Group Trip Workspace
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
              Coordinate itineraries, bookings, tasks, and shared trip expenses in one place.
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              TripSplit Planner gives small travel groups a single authoritative ledger for
              planned and paid expenses, automatic schedule conflict flagging, and exact
              per-person cost estimates.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {isAuthenticated ? (
                <Link
                  to="/trips"
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-500 transition-colors"
                >
                  Open My Trips Workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-500 transition-colors"
                  >
                    Create Your Account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-navy-800 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-navy-700 transition-colors"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Architectural Differentiator Strip */}
          <div className="mt-12 grid gap-4 border-t border-navy-800 pt-8 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">
                  UTC Schedule Conflict Detection
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Flags overlapping non-cancelled activities while allowing touching endpoints.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">
                  Zero Floating-Point Drift
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  All INR amounts are stored and split in integer paise so shares always sum to 100%.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">
                  Trip-Scoped Access Control
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  httpOnly cookie sessions and hashed 7-day invitation tokens keep trips private.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 space-y-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-navy-900">
            Designed for real group trip coordination
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Every workspace module connects to the same trip membership roster and financial ledger.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="rounded-2xl border border-canvas-border bg-white p-6 shadow-sm"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-navy-900">
                  {cap.title}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  {cap.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

