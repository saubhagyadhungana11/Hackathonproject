import { useEffect, useState, useRef, useCallback } from 'react';
import {
  SensorManager,
  calculateCrashScore,
  classifyFalseAlarm,
  EMERGENCY_THRESHOLD,
  HIGH_CONFIDENCE_THRESHOLD,
  type CrashAnalysis,
  type SensorReading,
  type IncidentType,
} from '@/lib/crashDetection';

export type CrashDetectionState = 'idle' | 'monitoring' | 'alert' | 'countdown' | 'escalated';

export interface CrashDetectionHook {
  state: CrashDetectionState;
  analysis: CrashAnalysis | null;
  currentScore: number;
  readings: SensorReading[];
  sensorActive: boolean;
  error: string | null;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => void;
  confirmEmergency: () => void;
  cancelEmergency: () => void;
  triggerManualSOS: () => void;
  countdownSeconds: number;
}

const COUNTDOWN_DURATION = 20;
const ANALYSIS_INTERVAL_MS = 1000;
const READING_WINDOW_MS = 5000;

export function useCrashDetection(onEmergencyConfirmed: (analysis: CrashAnalysis) => void): CrashDetectionHook {
  const [state, setState] = useState<CrashDetectionState>('idle');
  const [analysis, setAnalysis] = useState<CrashAnalysis | null>(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [sensorActive, setSensorActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(COUNTDOWN_DURATION);

  const sensorManagerRef = useRef<SensorManager | null>(null);
  const analysisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onConfirmedRef = useRef(onEmergencyConfirmed);
  onConfirmedRef.current = onEmergencyConfirmed;

  const performAnalysis = useCallback(() => {
    const manager = sensorManagerRef.current;
    if (!manager) return;

    const allReadings = manager.getReadings();
    setReadings(allReadings.slice(-10));

    const now = Date.now();
    const recentReadings = allReadings.filter((r) => r.timestamp > now - READING_WINDOW_MS);

    if (recentReadings.length < 3) return;

    const result = calculateCrashScore(recentReadings);
    setAnalysis(result);
    setCurrentScore(result.score);

    // Only trigger alert if score is at or above emergency threshold
    if (result.score >= EMERGENCY_THRESHOLD && state === 'monitoring') {
      const falseAlarmCheck = classifyFalseAlarm(result);
      if (!falseAlarmCheck.isFalseAlarm) {
        setState('alert');
      }
    }
  }, [state]);

  const startMonitoring = useCallback(async () => {
    setError(null);

    if (!sensorManagerRef.current) {
      sensorManagerRef.current = new SensorManager();
    }
    const manager = sensorManagerRef.current;

    const hasSensors = 'DeviceMotionEvent' in window;
    if (!hasSensors) {
      setError('Device sensors not available. Crash detection requires a mobile device with motion sensors.');
      return;
    }

    const granted = await manager.requestPermissions();
    if (!granted) {
      setError('Sensor permission denied. Please allow motion and orientation access for crash detection.');
      return;
    }

    manager.clearReadings();
    manager.start((reading) => {
      // Readings are collected by the manager, we analyze on interval
    });

    setSensorActive(true);
    setState('monitoring');
    setCurrentScore(0);
    setAnalysis(null);

    if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
    analysisIntervalRef.current = setInterval(performAnalysis, ANALYSIS_INTERVAL_MS);
  }, [performAnalysis]);

  const stopMonitoring = useCallback(() => {
    if (sensorManagerRef.current) {
      sensorManagerRef.current.stop();
    }
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setSensorActive(false);
    setState('idle');
    setCurrentScore(0);
    setAnalysis(null);
    setReadings([]);
    setCountdownSeconds(COUNTDOWN_DURATION);
  }, []);

  const startCountdown = useCallback(() => {
    setCountdownSeconds(COUNTDOWN_DURATION);
    setState('countdown');

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          // Time's up — escalate automatically
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          setState('escalated');
          if (analysis) {
            onConfirmedRef.current(analysis);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [analysis]);

  // When state becomes 'alert', automatically start countdown
  useEffect(() => {
    if (state === 'alert' && analysis) {
      // If high confidence, start countdown immediately
      if (analysis.score >= HIGH_CONFIDENCE_THRESHOLD) {
        startCountdown();
      } else {
        // For lower confidence, also start countdown but give more time
        startCountdown();
      }
    }
  }, [state, analysis, startCountdown]);

  const confirmEmergency = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setState('escalated');
    if (analysis) {
      onConfirmedRef.current(analysis);
    }
  }, [analysis]);

  const cancelEmergency = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    // Go back to monitoring, but clear readings to avoid immediate re-trigger
    if (sensorManagerRef.current) {
      sensorManagerRef.current.clearReadings();
    }
    setState('monitoring');
    setAnalysis(null);
    setCurrentScore(0);
    setCountdownSeconds(COUNTDOWN_DURATION);
  }, []);

  const triggerManualSOS = useCallback(() => {
    const manualAnalysis: CrashAnalysis = {
      score: 100,
      level: 'high_confidence',
      impactMagnitude: 0,
      speedDrop: 0,
      orientationChange: 0,
      postImpactStationary: false,
      signals: ['Manual SOS triggered by user'],
      severity: 'critical',
    };
    setAnalysis(manualAnalysis);
    setState('escalated');
    onConfirmedRef.current(manualAnalysis);
  }, []);

  useEffect(() => {
    return () => {
      if (sensorManagerRef.current) sensorManagerRef.current.stop();
      if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  return {
    state,
    analysis,
    currentScore,
    readings,
    sensorActive,
    error,
    startMonitoring,
    stopMonitoring,
    confirmEmergency,
    cancelEmergency,
    triggerManualSOS,
    countdownSeconds,
  };
}
