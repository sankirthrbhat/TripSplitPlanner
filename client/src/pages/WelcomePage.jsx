import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Compass,
  Hotel,
  IndianRupee,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function TravelRouteIllustration() {
  return (
    <svg
      viewBox="0 0 360 118"
      className="w-full h-auto"
      role="img"
      aria-label="Decorative illustrated travel route connecting three trip stops"
    >
      <defs>
        <linearGradient id="routeWarmBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E9F5F3" />
          <stop offset="55%" stopColor="#F7F6F2" />
          <stop offset="100%" stopColor="#FEF8E8" />
        </linearGradient>
      </defs>

      <rect width="360" height="118" rx="14" fill="url(#routeWarmBg)" />

      {/* Distant gentle hills */}
      <path
        d="M0 98 C58 76, 112 104, 178 82 C238 62, 294 92, 360 74 L360 118 L0 118 Z"
        fill="#DCECE8"
        opacity="0.7"
      />
      <path
        d="M0 106 C80 88, 150 110, 232 94 C290 82, 326 98, 360 90 L360 118 L0 118 Z"
        fill="#CFE4DF"
        opacity="0.6"
      />

      {/* Sunshine motif */}
      <circle cx="308" cy="30" r="14" fill="#F4C95D" opacity="0.85" />
      <circle cx="308" cy="30" r="20" fill="#F4C95D" opacity="0.22" />

      {/* Winding dashed travel path */}
      <path
        d="M46 76 C96 28, 146 96, 198 48 C242 10, 282 70, 314 54"
        fill="none"
        stroke="#0F766E"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="6 6"
      />

      {/* Waypoint 1 - Coral departure pin */}
      <g transform="translate(46, 76)">
        <circle r="10" fill="#FDF0ED" stroke="#F27A62" strokeWidth="2.5" />
        <circle r="4" fill="#F27A62" />
      </g>

      {/* Waypoint 2 - Deep teal mid-trip pin */}
      <g transform="translate(198, 48)">
        <circle r="11" fill="#FFFFFF" stroke="#0F766E" strokeWidth="2.5" />
        <circle r="4.5" fill="#0F766E" />
      </g>

      {/* Waypoint 3 - Navy destination pin */}
      <g transform="translate(314, 54)">
        <circle r="10" fill="#FFFFFF" stroke="#142C3A" strokeWidth="2.5" />
        <circle r="4" fill="#142C3A" />
      </g>
    </svg>
  );
}

export function WelcomePage() {
  const { isAuthenticated } = useAuth();

  const capabilities = [
    {
      icon: CalendarClock,
      accent: 'coral',
      title: 'Chronological Itinerary & Overlap Alerts',
      description:
        'Plan multi-day schedules in your trip timezone. Overlapping activities are detected and explained automatically from exact timestamps.',
    },
    {
      icon: IndianRupee,
      accent: 'teal',
      title: 'Equal & Custom Paise Splitting',
      description:
        'Record planned budgets and paid receipts in integer paise (INR) with remainder-safe equal splits or validated custom member shares.',
    },
    {
      icon: Users,
      accent: 'sunshine',
      title: 'Paid-Only Settlement Plan',
      description:
        'Compare each member’s estimated trip total side by side while generating settlement transfers strictly from paid expenses.',
    },
    {
      icon: Hotel,
      accent: 'navy',
      title: 'Bookings, Tasks & Trip Pulse',
      description:
        'Keep reservation references, group responsibilities, and the transparent four-pillar Trip Pulse check together in one workspace.',
    },
  ];

  return (
    <div className="space-y-12 py-8 sm:space-y-16 sm:py-12">
      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-[20px] border border-canvas-border bg-white shadow-card">
          <div
            aria-hidden="true"
            className="h-1.5 w-full bg-gradient-to-r from-[#0F766E] via-sunshine to-coral"
          />
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-12 lg:items-center lg:gap-10 lg:p-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#BEE3DD] bg-[#E9F5F3] px-3.5 py-1 text-xs font-semibold text-[#0C5E57]">
                <Compass className="h-3.5 w-3.5" />
                Shared Group Trip Notebook
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-5xl sm:leading-[1.12]">
                Good trips start together.
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-ink-body sm:text-lg">
                Build a calm day-by-day itinerary with overlap warnings, keep stay
                bookings and group tasks organized, and share trip costs fairly down to
                the exact paisa.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {isAuthenticated ? (
                  <Link
                    to="/trips"
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#0F766E] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#0D625B]"
                  >
                    Open My Trips Workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#0F766E] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#0D625B]"
                    >
                      Create Account
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/login"
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#D4DDD9] bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm transition-colors duration-150 hover:bg-canvas-subtle"
                    >
                      Sign In
                    </Link>
                  </>
                )}
              </div>

              <div className="grid gap-3 border-t border-canvas-border pt-5 sm:grid-cols-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-xs font-bold text-ink">Conflict Detection</p>
                    <p className="mt-0.5 text-xs text-ink-body">
                      Flags overlapping slots while allowing back-to-back plans.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0F766E]" />
                  <div>
                    <p className="text-xs font-bold text-ink">Exact INR Ledger</p>
                    <p className="mt-0.5 text-xs text-ink-body">
                      Integer-paise arithmetic keeps planned &amp; paid splits exact.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0F766E]" />
                  <div>
                    <p className="text-xs font-bold text-ink">Private Trips</p>
                    <p className="mt-0.5 text-xs text-ink-body">
                      Invite links stay scoped strictly to members of each trip.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Destination-Themed Decorative Preview Card ("Example trip") */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-canvas-border bg-[#FAF9F5] p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sunshine-border bg-sunshine-soft px-2.5 py-0.5 text-xs font-semibold text-sunshine-ink">
                    Example trip
                  </span>
                  <span className="text-xs font-medium text-ink-muted tabular-nums">
                    3-day group plan
                  </span>
                </div>

                <TravelRouteIllustration />

                <div className="rounded-xl border border-canvas-border bg-white p-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-ink">
                        Hampi Riverside Trail
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-body">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0F766E]" />
                        Hampi, Karnataka
                      </p>
                    </div>
                    <span className="rounded-full border border-[#BEE3DD] bg-[#E9F5F3] px-2 py-0.5 text-[11px] font-semibold text-[#0C5E57]">
                      0 conflicts
                    </span>
                  </div>

                  <div className="space-y-2 border-t border-dashed border-canvas-border pt-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink truncate">
                        Sunrise temple trail
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-ink-muted tabular-nums">
                        07:30 – 10:00
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink truncate">
                        Homestay booking (Paid)
                      </span>
                      <span className="shrink-0 font-semibold text-[#0F766E] tabular-nums">
                        ₹4,800.00
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-[#FAF9F5] px-2.5 py-1.5">
                      <span className="text-ink-body">Sample per-person share</span>
                      <span className="shrink-0 whitespace-nowrap font-bold text-ink tabular-nums">
                        ₹1,200.00 each
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 space-y-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-ink">
            Designed for clear group coordination
          </h2>
          <p className="mt-1 text-sm text-ink-body">
            Itinerary timings, bookings, responsibilities, and settlements stay connected inside one shared workspace.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            const iconStyle =
              cap.accent === 'coral'
                ? 'bg-coral-soft text-coral-ink border-coral-border'
                : cap.accent === 'sunshine'
                  ? 'bg-sunshine-soft text-sunshine-ink border-sunshine-border'
                  : 'bg-[#E9F5F3] text-[#0F766E] border-[#BEE3DD]';
            return (
              <div
                key={cap.title}
                className="rounded-2xl border border-canvas-border bg-white p-6 shadow-card transition-shadow duration-150 hover:shadow-card-hover"
              >
                <div
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${iconStyle}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-ink">
                  {cap.title}
                </h3>
                <p className="mt-1.5 text-sm text-ink-body leading-relaxed">
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
