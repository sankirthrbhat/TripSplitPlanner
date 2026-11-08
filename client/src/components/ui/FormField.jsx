export function FormField({ label, htmlFor, error, hint, required, children }) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-semibold text-ink"
        >
          {label}
          {required ? <span className="ml-0.5 text-rose-700">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClassName =
  'w-full min-h-[42px] rounded-xl border border-[#D4DDD9] bg-white px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted/80 transition-colors duration-150 focus:border-[#0F766E] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 disabled:bg-canvas-subtle disabled:text-ink-muted';

