import { useEffect, useState, useCallback } from 'react';
import {
  CloudSun,
  MapPin,
  Loader2,
  RefreshCw,
  Thermometer,
  Droplets,
  Wind,
  Eye,
  Gauge,
  CloudRain,
  Navigation,
  AlertTriangle,
  Crosshair,
} from 'lucide-react';
import { fetchWeather, reverseGeocode } from '@/lib/api';
import type { WeatherData, GeocodeResult } from '@/types/database';
import LeafletMap from '@/components/LeafletMap';
import LocationSearch from '@/components/LocationSearch';
import SectionHeader from '@/components/SectionHeader';
import WeatherIcon from '@/components/WeatherIcon';

const KATHMANDU: [number, number] = [27.7172, 85.324];

export default function Weather() {
  const [location, setLocation] = useState<{ lat: number; lng: number; name: string }>({
    lat: KATHMANDU[0],
    lng: KATHMANDU[1],
    name: 'Kathmandu, Nepal',
  });
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [locating, setLocating] = useState(false);

  const loadWeather = useCallback(async (lat: number, lng: number, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const w = await fetchWeather(lat, lng);
      setWeather(w);
      setLocation({ lat, lng, name });
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weather data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadWeather(KATHMANDU[0], KATHMANDU[1], 'Kathmandu, Nepal');
  }, [loadWeather]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadWeather(location.lat, location.lng, location.name);
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, location, loadWeather]);

  function useMyLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const name = await reverseGeocode(latitude, longitude);
        loadWeather(latitude, longitude, name);
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
    const name = r.displayName.split(',').slice(0, 3).join(', ');
    loadWeather(r.latitude, r.longitude, name);
  }

  const isHazardous =
    weather &&
    (weather.weatherCode >= 95 ||
      (weather.weatherCode >= 61 && weather.weatherCode <= 67) ||
      weather.weatherCode === 45 ||
      weather.weatherCode === 48);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<CloudSun className="w-6 h-6 text-white" />}
        title="Weather & Live Location"
        subtitle="Real-time weather conditions with automatic updates"
        accent="from-cyan-500 to-blue-500"
        actions={
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${
              autoRefresh
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: search + controls */}
        <div className="space-y-4">
          <LocationSearch
            label="Search any location"
            placeholder="Search any place in Nepal..."
            onSelect={handleSelect}
            icon={<MapPin className="w-4 h-4" />}
          />
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-all text-sm"
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
            Use My Live Location
          </button>

          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="text-xs text-slate-500 mb-2">Current Location</div>
            <div className="text-sm font-semibold text-slate-900 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">{location.name}</span>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              {location.lat.toFixed(4)}°N, {location.lng.toFixed(4)}°E
            </div>
            {lastUpdated && (
              <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Updated {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>

          {isHazardous && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-800">Weather Hazard Alert</span>
              </div>
              <p className="text-xs text-amber-700">
                Current conditions may pose risks for travel or outdoor activity. Exercise caution.
              </p>
            </div>
          )}
        </div>

        {/* Right: weather card + map */}
        <div className="lg:col-span-2 space-y-6">
          {loading && !weather ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-6">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">{error}</span>
              </div>
            </div>
          ) : weather ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm animate-fade-in">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-sm text-slate-500">Current conditions</div>
                  <div className="text-5xl font-extrabold text-slate-900 mt-1">
                    {Math.round(weather.temperature)}°C
                  </div>
                  <div className="text-sm text-slate-600 mt-1">{weather.description}</div>
                  <div className="text-xs text-slate-400 mt-1">Feels like {Math.round(weather.feelsLike)}°C</div>
                </div>
                <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <WeatherIcon name={weather.icon} className="w-12 h-12 text-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Metric icon={<Droplets className="w-4 h-4" />} label="Humidity" value={`${weather.humidity}%`} color="text-cyan-600" />
                <Metric icon={<Wind className="w-4 h-4" />} label="Wind" value={`${Math.round(weather.windSpeed)} km/h`} color="text-blue-600" />
                <Metric icon={<CloudRain className="w-4 h-4" />} label="Rain" value={`${weather.precipitation} mm`} color="text-sky-600" />
                <Metric icon={<Eye className="w-4 h-4" />} label="Visibility" value={`${Math.round(weather.visibility / 1000)} km`} color="text-slate-600" />
                <Metric icon={<Gauge className="w-4 h-4" />} label="Pressure" value={`${Math.round(weather.pressure)} hPa`} color="text-slate-600" />
                <Metric icon={<Thermometer className="w-4 h-4" />} label="Cloud" value={`${weather.cloudCover}%`} color="text-slate-600" />
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden h-72">
            <LeafletMap
              center={[location.lat, location.lng]}
              zoom={11}
              markers={[
                {
                  id: 'current',
                  position: [location.lat, location.lng],
                  color: 'blue',
                  icon: 'dot',
                  popup: `<b>Selected Location</b><br/>${location.name}`,
                },
              ]}
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Navigation className="w-3.5 h-3.5" />
            Weather data updates automatically every 60 seconds. Powered by Open-Meteo.
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
      <div className={`flex items-center gap-1.5 ${color} mb-1`}>
        {icon}
        <span className="text-[11px] font-medium text-slate-500">{label}</span>
      </div>
      <div className="text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}
