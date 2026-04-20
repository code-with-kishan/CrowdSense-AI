const palette = {
  slate: 'from-slate-50 to-slate-300 text-slate-900',
  green: 'from-emerald-50 to-emerald-300 text-emerald-900',
  amber: 'from-amber-50 to-amber-300 text-amber-900',
  red: 'from-rose-50 to-rose-300 text-rose-900',
};

export default function InsightCard({ label, value, hint, tone = 'slate' }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30 p-4 shadow-inner shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-slate-950/40">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className={`mt-2 inline-flex rounded-2xl bg-gradient-to-br px-3 py-2 text-sm font-semibold ${palette[tone] || palette.slate}`}>
        {value}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{hint}</p>
    </div>
  );
}
