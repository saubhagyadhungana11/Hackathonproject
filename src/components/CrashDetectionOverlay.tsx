import { useEffect, useState } from 'react';
import { AlertTriangle, Shield, Siren, X } from 'lucide-react';
import type { CrashAnalysis } from '@/lib/crashDetection';
import { getRiskLevelText, getRiskLevelColor } from '@/lib/crashDetection';

interface CrashOverlayProps {
  analysis: CrashAnalysis | null;
  countdownSeconds: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CrashDetectionOverlay({
  analysis,
  countdownSeconds,
  onConfirm,
  onCancel,
}: CrashOverlayProps) {
  const [vibrate, setVibrate] = useState(true);

  useEffect(() => {
    // Vibrate pattern on supported devices
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500]);
    }
    const interval = setInterval(() => {
      if (navigator.vibrate) navigator.vibrate(400);
      setVibrate((v) => !v);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isHighConfidence = analysis && analysis.score >= 81;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-crash-overlay">
      <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" />
      <div className="relative w-full max-w-md mx-4 animate-crash-overlay">
        <div className={`rounded-3xl ${isHighConfidence ? 'animate-warning-flash' : 'bg-red-600'} p-1 shadow-2xl`}>
          <div className="rounded-[22px] bg-white p-6 space-y-5">
            {/* Warning header */}
            <div className="text-center">
              <div className={`w-20 h-20 rounded-full ${vibrate ? 'bg-red-100' : 'bg-red-200'} flex items-center justify-center mx-auto mb-3 transition-colors`}>
                <AlertTriangle className={`w-12 h-12 text-red-600 ${vibrate ? 'scale-110' : 'scale-100'} transition-transform`} />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Possible Crash Detected
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Are you okay?
              </p>
            </div>

            {/* Crash analysis display */}
            {analysis && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Crash Confidence</span>
                  <span className={`font-bold ${getRiskLevelColor(analysis.level)}`}>
                    {analysis.score}% — {getRiskLevelText(analysis.level)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      analysis.score >= 81 ? 'bg-red-500' :
                      analysis.score >= 61 ? 'bg-orange-500' :
                      'bg-amber-500'
                    }`}
                    style={{ width: `${analysis.score}%` }}
                  />
                </div>
                {analysis.signals.length > 0 && (
                  <div className="pt-1 space-y-1">
                    {analysis.signals.slice(0, 4).map((sig, i) => (
                      <div key={i} className="text-[11px] text-slate-500 flex items-start gap-1.5">
                        <span className="text-red-400 mt-0.5">•</span>
                        {sig}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Countdown */}
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">
                Emergency services will be contacted in
              </div>
              <div className="text-5xl font-extrabold text-red-600 animate-countdown">
                {countdownSeconds}s
              </div>
              <div className="text-xs text-slate-400 mt-1">
                unless you cancel
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2.5">
              <button
                onClick={onCancel}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 text-lg"
              >
                <Shield className="w-6 h-6" />
                I'M OK
              </button>
              <button
                onClick={onConfirm}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-red-600/20 text-lg"
              >
                <Siren className="w-6 h-6" />
                SEND EMERGENCY SOS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
