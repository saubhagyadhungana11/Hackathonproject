import { Languages } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';

interface LanguageToggleProps {
  dark?: boolean;
  compact?: boolean;
}

export default function LanguageToggle({ dark = false, compact = false }: LanguageToggleProps) {
  const { lang, toggle } = useLang();

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
        dark
          ? 'border-slate-600/50 text-slate-300 hover:bg-slate-800 hover:text-white'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
      aria-label="Toggle language"
    >
      <Languages className="w-3.5 h-3.5" />
      {!compact && <span>{lang === 'en' ? 'नेपाली' : 'English'}</span>}
      {compact && <span>{lang === 'en' ? 'ने' : 'EN'}</span>}
    </button>
  );
}
