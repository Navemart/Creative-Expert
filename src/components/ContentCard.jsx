// Generic card wrapper — use it for sections, content tiles, or data panels.
export default function ContentCard({ title, action, children, className = '' }) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          {title && (
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
