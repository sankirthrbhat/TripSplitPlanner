export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
      {Icon ? (
        <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-600">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = 'h-24 w-full' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`}
    />
  );
}

