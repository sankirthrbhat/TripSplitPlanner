import { getInitials } from '../../utils/format';

const PALETTE = [
  'bg-teal-700 text-white',
  'bg-navy-800 text-white',
  'bg-amber-700 text-white',
  'bg-emerald-700 text-white',
  'bg-slate-700 text-white',
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
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold ${PALETTE[idx % PALETTE.length]}`}
        >
          {getInitials(m.displayName)}
        </div>
      ))}
      {extra > 0 ? (
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-semibold text-slate-700">
          +{extra}
        </div>
      ) : null}
    </div>
  );
}

