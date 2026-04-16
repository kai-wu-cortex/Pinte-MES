import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  active?: boolean;
  onClick?: () => void;
}

export function MetricCard({ title, value, icon, trend, trendUp, className, active, onClick }: MetricCardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-slate-800/50 border border-blue-900/50 rounded-xl p-4 flex flex-col backdrop-blur-sm transition-all", 
        onClick && "cursor-pointer hover:bg-slate-800/80 hover:-translate-y-0.5 hover:shadow-lg",
        active && "ring-2 ring-blue-500 bg-slate-800/90 shadow-[0_0_15px_rgba(59,130,246,0.3)]",
        className
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-slate-400 text-sm font-medium">{title}</span>
        <div className="p-2 bg-blue-900/30 rounded-lg text-blue-400">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-100">{value}</span>
        {trend && (
          <span className={cn("text-xs font-medium", trendUp ? "text-emerald-400" : "text-rose-400")}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
    </div>
  );
}
