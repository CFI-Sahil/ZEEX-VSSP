import React from 'react';
import { cn } from '../../utils/cn';
import Card from './Card';

const colorThemes = {
  blue: {
    iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
    badge: 'bg-blue-50 text-blue-700 border border-blue-200/60',
  },
  emerald: {
    iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
  },
  rose: {
    iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
    badge: 'bg-rose-50 text-rose-700 border border-rose-200/60',
  },
  amber: {
    iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200/60',
  },
  indigo: {
    iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
    badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200/60',
  },
  neutral: {
    iconBg: 'bg-slate-100 text-slate-600 border border-slate-200',
    badge: 'bg-slate-100 text-slate-700 border border-slate-200',
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  colorVariant = 'blue',
  onClick,
  className,
  ...props
}) {
  const isClickable = Boolean(onClick);
  const theme = colorThemes[colorVariant] || colorThemes.blue;

  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-4 sm:p-4.5 flex flex-col justify-between h-full min-h-[148px] rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-xs transition-all duration-150',
        isClickable && 'cursor-pointer hover:border-blue-400 hover:shadow-sm',
        className
      )}
      {...props}
    >
      {/* Top Bar: Icon Container & Category Badge */}
      <div className="flex items-center justify-between gap-2">
        {Icon ? (
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', theme.iconBg)}>
            <Icon className="w-4 h-4" />
          </div>
        ) : (
          <div />
        )}
        {badge && (
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase shrink-0',
              theme.badge
            )}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Middle Block: Prominent Metric & Clear Title */}
      <div className="my-2 space-y-0.5">
        <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
          {value ?? '—'}
        </p>
        <p className="text-xs font-semibold text-slate-700 tracking-normal uppercase leading-snug">
          {title}
        </p>
      </div>

      {/* Bottom Row: Contextual Subtitle */}
      {subtitle && (
        <div
          className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-normal leading-normal truncate"
          title={subtitle}
        >
          {subtitle}
        </div>
      )}
    </Card>
  );
}

export default StatCard;

