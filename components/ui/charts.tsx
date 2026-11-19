import { formatPercent } from '@/lib/utils/format';

const MIN_BAR_WIDTH_PERCENT = 2;

export interface BarDatum {
  label: string;
  value: number;
}

/** Values sit outside the bar, so short bars stay readable. */
export function HorizontalBarChart({ data }: { data: readonly BarDatum[] }) {
  const maxValue = Math.max(...data.map((datum) => datum.value), 1);
  return (
    <ul className="flex flex-col gap-2">
      {data.map(({ label, value }) => (
        <li key={label} className="flex items-center gap-3">
          <span title={label} className="w-24 shrink-0 truncate text-right text-sm text-zinc-400 sm:w-36">
            {label}
          </span>
          <div aria-hidden className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-800/80">
            <div
              className="h-full rounded-full bg-spotify"
              style={{ width: `${Math.max((value / maxValue) * 100, MIN_BAR_WIDTH_PERCENT)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-medium text-zinc-200 tabular-nums">{value}</span>
        </li>
      ))}
    </ul>
  );
}

interface RatioBarProps {
  label: string;
  ratio: number;
  color: string;
}

export function RatioBar({ label, ratio, color }: RatioBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-zinc-300 sm:w-32">{label}</span>
      <div aria-hidden className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800/80">
        <div className="h-full rounded-full" style={{ width: formatPercent(ratio), background: color }} />
      </div>
      <span className="w-12 shrink-0 text-right text-sm font-medium text-zinc-200 tabular-nums">
        {formatPercent(ratio)}
      </span>
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="font-display text-xl leading-tight font-semibold text-white tabular-nums">{value}</span>
    </div>
  );
}
