export function Badge({ children, variant = 'neutral', className = '' }) {
  const variants = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    teal: 'bg-teal-50 text-teal-800 border-teal-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    navy: 'bg-navy-900 text-white border-navy-800',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${variants[variant] || variants.neutral} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    confirmed: { label: 'Confirmed', variant: 'emerald' },
    paid: { label: 'Paid', variant: 'emerald' },
    done: { label: 'Done', variant: 'emerald' },
    accepted: { label: 'Accepted', variant: 'emerald' },
    planned: { label: 'Planned', variant: 'teal' },
    in_progress: { label: 'In Progress', variant: 'teal' },
    pending: { label: 'Pending', variant: 'amber' },
    tentative: { label: 'Tentative', variant: 'amber' },
    todo: { label: 'To Do', variant: 'neutral' },
    cancelled: { label: 'Cancelled', variant: 'rose' },
    revoked: { label: 'Revoked', variant: 'rose' },
    expired: { label: 'Expired', variant: 'neutral' },
  };
  const cfg = map[status] || { label: status || 'Unknown', variant: 'neutral' };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

