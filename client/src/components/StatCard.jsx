import { useEffect, useState } from 'react';
import Skeleton from './Skeleton.jsx';

const sparklinePaths = [
  'M2 18 C8 17, 8 8, 14 12 S22 17, 30 5',
  'M2 17 C7 18, 9 10, 15 13 S23 8, 30 4',
  'M2 15 C8 16, 8 7, 15 10 S24 14, 30 4',
  'M2 18 C8 14, 11 17, 16 11 S24 8, 30 5'
];

export default function StatCard({ label, value, note, accent = 'text-slate-950', icon: Icon, index = 0, loading = false }) {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));
  const [displayValue, setDisplayValue] = useState(
    typeof value === 'number' && !reducedMotion ? 0 : value
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateReducedMotion = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateReducedMotion);
    return () => mediaQuery.removeEventListener('change', updateReducedMotion);
  }, []);

  useEffect(() => {
    if (typeof value !== 'number' || reducedMotion) {
      setDisplayValue(value);
      return undefined;
    }

    setDisplayValue(0);
    let frame;
    let startTime;
    const delay = window.setTimeout(() => {
      const animate = timestamp => {
        if (startTime === undefined) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / 700, 1);
        const eased = 1 - ((1 - progress) ** 3);
        setDisplayValue(Math.round(value * eased));
        if (progress < 1) frame = window.requestAnimationFrame(animate);
      };
      frame = window.requestAnimationFrame(animate);
    }, index * 90);

    return () => {
      window.clearTimeout(delay);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [index, reducedMotion, value]);

  return (
    <section className="stat-card surface-card p-5" style={{ '--stat-delay': `${index * 70}ms` }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-slate-500">{label}</p>
        {Icon && (
          <span className="stat-card__icon flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-indigo-50 text-brand-800 ring-1 ring-brand-100">
            <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        {loading
          ? <Skeleton className="h-8 w-16" />
          : <p className={`stat-card__value text-[30px] font-semibold leading-none tracking-tight ${accent}`}>
            {typeof displayValue === 'number' ? displayValue.toLocaleString() : displayValue}
          </p>}
        <svg className="stat-card__sparkline" viewBox="0 0 32 22" aria-hidden="true">
          <path d={sparklinePaths[index % sparklinePaths.length]} />
        </svg>
      </div>
      <p className="mt-2.5 text-xs leading-5 text-slate-500">{note}</p>
    </section>
  );
}