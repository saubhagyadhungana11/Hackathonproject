import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Search, Loader2, MapPin, X } from 'lucide-react';
import { searchLocations } from '@/lib/api';
import type { GeocodeResult } from '@/types/database';

interface LocationSearchProps {
  label: string;
  placeholder?: string;
  onSelect: (result: GeocodeResult) => void;
  value?: string;
  icon?: ReactNode;
}

export default function LocationSearch({
  label,
  placeholder = 'Search any place in Nepal...',
  onSelect,
  value: externalValue,
  icon,
}: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalValue !== undefined) setQuery(externalValue);
  }, [externalValue]);

  useEffect(() => {
    if (!query.trim() || !open) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchLocations(query);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(r: GeocodeResult) {
    setQuery(r.displayName.split(',').slice(0, 3).join(', '));
    setOpen(false);
    setResults([]);
    onSelect(r);
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon ?? <Search className="w-4 h-4" />}
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
        )}
        {!loading && query && (
          <button
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-[1000] mt-1 w-full max-h-64 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-xl animate-fade-in">
          {results.map((r) => (
            <button
              key={r.raw.place_id ?? r.displayName}
              onClick={() => handleSelect(r)}
              className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
            >
              <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-slate-700 line-clamp-2">{r.displayName}</span>
            </button>
          ))}
        </div>
      )}
      {open && !loading && query.trim() && results.length === 0 && (
        <div className="absolute z-[1000] mt-1 w-full rounded-xl bg-white border border-slate-200 shadow-xl px-3 py-3 text-sm text-slate-500">
          No places found. Try a different name.
        </div>
      )}
    </div>
  );
}
