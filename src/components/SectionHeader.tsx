import type { ReactNode } from 'react';
import { useLang } from '@/context/LanguageContext';

interface SectionHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  accent?: string;
  actions?: ReactNode;
}

export default function SectionHeader({
  icon,
  title,
  subtitle,
  accent = 'from-blue-500 to-cyan-500',
  actions,
}: SectionHeaderProps) {
  const { lang } = useLang();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3.5">
        <div
          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center shadow-lg flex-shrink-0`}
        >
          {icon}
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">{title}</h1>
          <p className="text-sm text-slate-500 mt-0.5 leading-snug">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
