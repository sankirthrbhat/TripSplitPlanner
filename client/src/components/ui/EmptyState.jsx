export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD6D2] bg-white/85 px-6 py-12 text-center shadow-card">
      {Icon ? (
        <div className="relative mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#BEE3DD] bg-[#E9F5F3] text-[#0F766E]">
          <Icon className="h-6 w-6" />
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-sunshine"
          />
        </div>
      ) : null}
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-ink-body leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = 'h-24 w-full' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-2xl bg-[#E8ECEA] ${className}`}
    />
  );
}

