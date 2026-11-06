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
  statusColor,
  onClick,
  className,
  ...props
}) {
  const isClickable = Boolean(onClick);
  const themeKey = statusColor || colorVariant;
  const theme = colorThemes[themeKey] || colorThemes.blue;

  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-3 sm:p-4 flex flex-col justify-between h-full min-h-[105px] sm:min-h-[135px] rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-xs transition-all duration-150',
        isClickable && 'cursor-pointer hover:border-blue-400 hover:shadow-sm',
        className
      )}
      {...props}
    >
      {/* Top Bar: Icon Container & Category Badge */}
      <div className="flex items-center justify-between gap-1.5">
        {Icon ? (
          <div className={cn('w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0', theme.iconBg)}>
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        ) : (
          <div />
        )}
        {badge && (
          <span
            className={cn(
              'inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase shrink-0 max-w-[100px] truncate',
              theme.badge
            )}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Middle Block: Prominent Metric & Clear Title */}
      <div className="my-1.5 sm:my-2 space-y-0.5">
        <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
          {value ?? '—'}
        </p>
        <p className="text-[10px] sm:text-xs font-semibold text-slate-700 tracking-normal uppercase leading-snug line-clamp-1">
          {title}
        </p>
      </div>

      {/* Bottom Row: Contextual Subtitle */}
      {subtitle && (
        <div
          className="pt-1.5 sm:pt-2 border-t border-slate-100 text-[10px] sm:text-[11px] text-slate-500 font-normal leading-normal truncate"
          title={subtitle}
        >
          {subtitle}
        </div>
      )}
    </Card>
  );
}

export default StatCard;

