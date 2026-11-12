import React from 'react';
import { AlertCircle, ShieldAlert, Sparkles, Terminal } from 'lucide-react';
import { cn } from '../../utils/cn';

export function TrainingModeBanner({ className, compact = false }) {
  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 text-xs font-medium',
          className
        )}
      >
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        <span className="font-semibold tracking-wider uppercase text-[11px] text-amber-800">
          Training Sandbox
        </span>
        <span className="text-amber-600 hidden sm:inline">| Isolated Simulation Mode</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/60 border border-amber-300/80 p-4 shadow-xs',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-700 shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-200 text-amber-900 border border-amber-300">
                TRAINING MODE
              </span>
              <span className="text-xs font-semibold text-amber-950">
                Simulated Safety Incident Environment
              </span>
            </div>
            <p className="text-xs text-amber-800/90 mt-0.5">
              Actions in this sandbox are isolated from live operations. No operational alerts, cameras, notifications, or escalation timers are impacted.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-amber-900 bg-white/70 px-3 py-1.5 rounded-lg border border-amber-200/80 shadow-2xs shrink-0 self-stretch sm:self-auto justify-center">
          <Terminal className="w-3.5 h-3.5 text-amber-600" />
          <span>Operational Data Isolated</span>
        </div>
      </div>
    </div>
  );
}

export default TrainingModeBanner;

