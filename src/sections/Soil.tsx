import { useEffect, useState, type FormEvent } from 'react';
import {
  Droplets,
  MapPin,
  Loader2,
  AlertTriangle,
  Crosshair,
  Mountain,
  CloudRain,
  Ruler,
  Clock,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { reverseGeocode, formatRelativeTime } from '@/lib/api';
import type { SoilReading } from '@/types/database';
import LeafletMap, { type MapMarker, type MarkerColor } from '@/components/LeafletMap';
import LocationSearch from '@/components/LocationSearch';
import SectionHeader from '@/components/SectionHeader';
import type { GeocodeResult } from '@/types/database';

function computeRisk(moisture: number, rainfall: number, slope: number): SoilReading['risk_level'] {
  let score = 0;
  if (moisture > 80) score += 3;
  else if (moisture > 60) score += 2;
  else if (moisture > 40) score += 1;
  if (rainfall > 50) score += 3;
  else if (rainfall > 25) score += 2;
  else if (rainfall > 10) score += 1;
  if (slope > 35) score += 3;
  else if (slope > 20) score += 2;
  else if (slope > 10) score += 1;
  if (score >= 7) return 'critical';
  if (score >= 5) return 'high';
  if (score >= 3) return 'moderate';
  return 'low';
}

const riskColors: Record<SoilReading['risk_level'], { bg: string; text: string; border: string; hex: string }> = {
  low: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', hex: '#22c55e' },
  moderate: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', hex: '#eab308' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', hex: '#f97316' },
  critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', hex: '#ef4444' },
};

export default function Soil() {
  const [readings, setReadings] = useState<SoilReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [moisture, setMoisture] = useState(50);
  const [rainfall, setRainfall] = useState(0);
  const [slope, setSlope] = useState(15);
  const [notes, setNotes] = useState('');

  const previewRisk = computeRisk(moisture, rainfall, slope);

  useEffect(() => {
    loadReadings();
  }, []);

  async function loadReadings() {
    setLoading(true);
    const { data } = await supabase
      .from('soil_readings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setReadings((data as SoilReading[]) ?? []);
    setLoading(false);
  }

  function useMyLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, name });
        setLocating(false);
      },
      (err) => {
        setError(`Could not get your location: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function handleSelect(r: GeocodeResult) {
    setLocation({
      lat: r.latitude,
      lng: r.longitude,
      name: r.displayName.split(',').slice(0, 3).join(', '),
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!location) {
      setError('Please set a monitoring location.');
      return;
    }
    setSubmitting(true);
    try {
      const risk = computeRisk(moisture, rainfall, slope);
      const { error: insertError } = await supabase.from('soil_readings').insert({
        latitude: location.lat,
        longitude: location.lng,
        location_name: location.name,
        moisture_pct: moisture,
        rainfall_mm: rainfall,
        slope_angle: slope,
        risk_level: risk,
        notes: notes || null,
      });
      if (insertError) throw insertError;
      setNotes('');
      loadReadings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit reading.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteReading(id: string) {
    await supabase.from('soil_readings').delete().eq('id', id);
    loadReadings();
  }

  const highRiskCount = readings.filter((r) => r.risk_level === 'high' || r.risk_level === 'critical').length;
  const markers: MapMarker[] = readings.map((r) => ({
    id: r.id,
    position: [r.latitude, r.longitude],
    color: (
      r.risk_level === 'critical'
        ? 'red'
        : r.risk_level === 'high'
          ? 'orange'
          : r.risk_level === 'moderate'
            ? 'yellow'
            : 'green'
    ) as MarkerColor,
    icon: 'square',
    popup: `<b>${r.location_name ?? 'Soil reading'}</b><br/>Moisture: ${r.moisture_pct}%<br/>Risk: ${r.risk_level}`,
  }));

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Droplets className="w-6 h-6 text-white" />}
        title="Soil Moisture & Landslide Risk"
        subtitle="Monitor soil conditions to predict landslide and rockfall risk"
        accent="from-emerald-500 to-teal-500"
        actions={
          highRiskCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span className="text-xs font-semibold text-red-700">{highRiskCount} high-risk zones</span>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submit form */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Log Soil Reading</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <LocationSearch
                label="Monitoring location"
                placeholder="Search road or hillside location..."
                onSelect={handleSelect}
                value={location?.name}
                icon={<MapPin className="w-4 h-4 text-emerald-600" />}
              />
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-medium py-2 rounded-xl transition-all text-sm border border-slate-200"
              >
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                Use my current location
              </button>
            </div>

            {/* Moisture slider */}
            <SliderInput
              icon={<Droplets className="w-4 h-4 text-cyan-600" />}
              label="Soil Moisture"
              value={moisture}
              min={0}
              max={100}
              unit="%"
              onChange={setMoisture}
            />
            {/* Rainfall slider */}
            <SliderInput
              icon={<CloudRain className="w-4 h-4 text-blue-600" />}
              label="Recent Rainfall (24h)"
              value={rainfall}
              min={0}
              max={150}
              unit="mm"
              onChange={setRainfall}
            />
            {/* Slope slider */}
            <SliderInput
              icon={<Mountain className="w-4 h-4 text-amber-600" />}
              label="Slope Angle"
              value={slope}
              min={0}
              max={60}
              unit="°"
              onChange={setSlope}
            />

            {/* Risk preview */}
            <div className={`rounded-xl ${riskColors[previewRisk].bg} border ${riskColors[previewRisk].border} p-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className={`w-5 h-5 ${riskColors[previewRisk].text}`} />
                  <span className="text-sm font-bold text-slate-900">Predicted Risk Level</span>
                </div>
                <span className={`text-lg font-extrabold uppercase ${riskColors[previewRisk].text}`}>
                  {previewRisk}
                </span>
              </div>
              {(previewRisk === 'high' || previewRisk === 'critical') && (
                <p className="text-xs text-slate-600 mt-2">
                  High moisture, rainfall, and slope angle combination suggests elevated landslide or rockfall risk.
                  Authorities should be alerted to secure the road.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Visible cracks, water seepage, recent rockfall, etc."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all resize-none"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !location}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Droplets className="w-5 h-5" />}
              {submitting ? 'Submitting...' : 'Submit Reading'}
            </button>
          </form>
        </div>

        {/* Readings list */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-3">Recent Readings</h2>
            {loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
              </div>
            ) : readings.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No readings logged yet.</p>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto">
                {readings.map((r) => {
                  const c = riskColors[r.risk_level];
                  return (
                    <div key={r.id} className="rounded-xl bg-slate-50 border border-slate-200 p-4 group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-900 truncate flex-1">
                          {r.location_name ?? `${r.latitude.toFixed(2)}, ${r.longitude.toFixed(2)}`}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${c.bg} ${c.text} ml-2`}>
                          {r.risk_level}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-slate-500">
                          <Droplets className="w-3 h-3 text-cyan-600" />
                          {r.moisture_pct}% moisture
                        </div>
                        <div className="flex items-center gap-1 text-slate-500">
                          <CloudRain className="w-3 h-3 text-blue-600" />
                          {r.rainfall_mm}mm rain
                        </div>
                        <div className="flex items-center gap-1 text-slate-500">
                          <Ruler className="w-3 h-3 text-amber-600" />
                          {r.slope_angle}° slope
                        </div>
                      </div>
                      {r.notes && <p className="text-xs text-slate-500 mt-2">{r.notes}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(r.created_at)}
                        </span>
                        <button
                          onClick={() => deleteReading(r.id)}
                          className="text-[11px] text-slate-400 hover:text-red-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Risk map */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden h-80 shadow-sm">
        <LeafletMap
          center={[28.0, 84.0]}
          zoom={7}
          markers={markers}
          fitBounds={markers.length > 0}
        />
      </div>
    </div>
  );
}

function SliderInput({
  icon,
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
          {icon}
          {label}
        </label>
        <span className="text-sm font-bold text-slate-900">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-emerald-500"
      />
    </div>
  );
}
