import { Inbox } from 'lucide-react';

// A friendly "nothing here yet" placeholder. Drop inside any card or table cell.
export default function EmptyState({
  title = '[Your data here]',
  description = 'Connect your data source or add an item to see it here.',
  icon: Icon = Inbox,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'rgb(var(--bg-elevated))', color: 'rgba(255,255,255,0.4)' }}>
        <Icon size={20} />
      </div>
      <div className="text-sm font-medium text-slate-900">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}
