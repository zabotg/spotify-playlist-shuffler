import { formatPercent } from '@/lib/utils/format';

const MIN_BAR_WIDTH_PERCENT = 2;

export interface BarDatum {
  label: string;
  value: number;
}

export function HorizontalBarChart({ data }: { data: readonly BarDatum[] }) {
  const maxValue = Math.max(...data.map((datum) => datum.value), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {data.map(({ label, value }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-right text-xs text-zinc-500">{label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="flex h-5 items-center justify-end rounded-full bg-spotify pr-2"
              style={{ width: `${Math.max((value / maxValue) * 100, MIN_BAR_WIDTH_PERCENT)}%` }}
            >
              <span className="text-[10px] font-medium text-black">{value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
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
      <span className="w-28 shrink-0 text-xs text-zinc-400">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-2.5 rounded-full" style={{ width: formatPercent(ratio), background: color }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-zinc-300">{formatPercent(ratio)}</span>
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-lg leading-tight font-bold">{value}</span>
    </div>
  );
}
