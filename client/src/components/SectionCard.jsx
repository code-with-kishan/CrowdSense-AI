export default function SectionCard({ title, icon, children, className = '' }) {
  return (
    <section className={`group relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_60px_rgba(2,6,23,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[0_24px_80px_rgba(2,6,23,0.4)] ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-70" />
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {icon} {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
