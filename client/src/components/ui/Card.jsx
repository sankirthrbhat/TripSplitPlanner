export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-canvas-border bg-white shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

