// Reusable KPI tile for the dashboard. Drop real values in from fetched data.
export default function StatCard({
  label = '[Your metric label]',
  value = '[Your metric here]',
  delta = '[+0%]',
  deltaTone = 'neutral', // 'positive' | 'negative' | 'neutral'
}) {
  const toneClasses = {
    positive: 'text-emerald-600',
    negative: 'text-rose-600',
    neutral: 'text-slate-500',
  }[deltaTone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight text-slate-900">
          {value}
        </div>
        <div className={`text-xs font-medium ${toneClasses}`}>{delta}</div>
      </div>
    </div>
  );
}
