export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-canvas-border bg-white shadow-card transition-[border-color,box-shadow] duration-150 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

