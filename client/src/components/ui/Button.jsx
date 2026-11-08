export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  className = '',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E] active:translate-y-px disabled:opacity-50 disabled:pointer-events-none';

  const variants = {
    primary:
      'bg-[#0F766E] text-white hover:bg-[#0D625B] shadow-sm',
    navy: 'bg-navy-900 text-white hover:bg-navy-800 shadow-sm',
    secondary:
      'bg-white text-ink border border-[#D4DDD9] hover:border-[#0F766E]/40 hover:bg-[#F7F6F2] shadow-sm',
    danger: 'bg-rose-700 text-white hover:bg-rose-800 shadow-sm',
    ghost: 'text-ink-body hover:bg-canvas-subtle hover:text-ink',
  };

  const sizes = {
    sm: 'min-h-[38px] px-3 py-1.5 text-xs',
    md: 'min-h-[42px] px-4 py-2 text-sm',
    lg: 'min-h-[46px] px-5 py-2.5 text-base',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

