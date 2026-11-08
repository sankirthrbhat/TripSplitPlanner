import { getInitials } from '../../utils/format';

const PALETTE = [
  'bg-[#0F766E] text-white',
  'bg-navy-900 text-white',
  'bg-[#B45309] text-white',
  'bg-[#9A3412] text-white',
  'bg-[#334E68] text-white',
];

export function AvatarStack({ members = [], max = 5 }) {
  const visible = members.slice(0, max);
  const extra = Math.max(0, members.length - max);

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((m, idx) => (
        <div
          key={m.userId || idx}
          title={`${m.displayName} (${m.role})`}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow-sm ${PALETTE[idx % PALETTE.length]}`}
        >
          {getInitials(m.displayName)}
        </div>
      ))}
      {extra > 0 ? (
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-canvas-subtle text-xs font-bold text-ink">
          +{extra}
        </div>
      ) : null}
    </div>
  );
}

