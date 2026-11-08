export function FormField({ label, htmlFor, error, hint, required, children }) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-slate-800"
        >
          {label}
          {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClassName =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 disabled:bg-slate-50 disabled:text-slate-500';

