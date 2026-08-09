// ===== CRASH DETECTION ENGINE =====
// Sensor-fusion system that combines accelerometer, gyroscope, GPS speed,
// and device orientation data to calculate a Crash Risk Score (0-100).
// Multi-stage verification prevents false alarms.

export type CrashSeverity = 'minor' | 'moderate' | 'severe' | 'critical';

export type IncidentType = 'vehicle_crash' | 'fall' | 'disaster' | 'manual_sos';

export interface SensorReading {
  timestamp: number;
  accelX: number;
  accelY: number;
  accelZ: number;
  rotationAlpha: number;
  rotationBeta: number;
  rotationGamma: number;
  speedKmh: number | null;
}

export interface CrashAnalysis {
  score: number;
  level: RiskLevel;
  impactMagnitude: number;
  speedDrop: number;
  orientationChange: number;
  postImpactStationary: boolean;
  signals: string[];
  severity: CrashSeverity | null;
}

export type RiskLevel = 'normal' | 'suspicious' | 'possible' | 'high_confidence';

export const EMERGENCY_THRESHOLD = 61;
export const HIGH_CONFIDENCE_THRESHOLD = 81;

const READING_WINDOW_MS = 5000;
const STATIONARY_SPEED_THRESHOLD = 3;
const GRAVITY = 9.81;
const HIGH_IMPACT_THRESHOLD = 25;
const SEVERE_IMPACT_THRESHOLD = 40;

export function calculateCrashScore(
  readings: SensorReading[],
): CrashAnalysis {
  const signals: string[] = [];

  if (readings.length < 2) {
    return {
      score: 0,
      level: 'normal',
      impactMagnitude: 0,
      speedDrop: 0,
      orientationChange: 0,
      postImpactStationary: false,
      signals: [],
      severity: null,
    };
  }

  const sorted = [...readings].sort((a, b) => a.timestamp - b.timestamp);
  const recent = sorted.slice(-Math.min(sorted.length, 30));

  // 1. Impact magnitude — total acceleration minus gravity
  let maxImpact = 0;
  let impactTimestamp = 0;
  for (const r of recent) {
    const totalAccel = Math.sqrt(r.accelX ** 2 + r.accelY ** 2 + r.accelZ ** 2);
    const impact = Math.abs(totalAccel - GRAVITY);
    if (impact > maxImpact) {
      maxImpact = impact;
      impactTimestamp = r.timestamp;
    }
  }

  if (maxImpact > 15) signals.push(`High impact detected (${maxImpact.toFixed(1)} m/s²)`);
  else if (maxImpact > 8) signals.push(`Moderate impact (${maxImpact.toFixed(1)} m/s²)`);

  // 2. Speed drop — sudden deceleration
  const speedReadings = recent.filter((r) => r.speedKmh !== null);
  let speedDrop = 0;
  let speedBefore: number | null = null;
  let speedAfter: number | null = null;

  if (speedReadings.length >= 2) {
    for (let i = 1; i < speedReadings.length; i++) {
      const drop = (speedReadings[i - 1].speedKmh ?? 0) - (speedReadings[i].speedKmh ?? 0);
      if (drop > speedDrop) {
        speedDrop = drop;
        speedBefore = speedReadings[i - 1].speedKmh;
        speedAfter = speedReadings[i].speedKmh;
      }
    }
  }

  if (speedDrop > 30) signals.push(`Sudden speed drop (${speedDrop.toFixed(0)} km/h)`);
  else if (speedDrop > 15) signals.push(`Notable deceleration (${speedDrop.toFixed(0)} km/h)`);

  // 3. Orientation change — device rotation during event
  let maxOrientationChange = 0;
  for (let i = 1; i < recent.length; i++) {
    const dAlpha = Math.abs(recent[i].rotationAlpha - recent[i - 1].rotationAlpha);
    const dBeta = Math.abs(recent[i].rotationBeta - recent[i - 1].rotationBeta);
    const dGamma = Math.abs(recent[i].rotationGamma - recent[i - 1].rotationGamma);
    const change = dAlpha + dBeta + dGamma;
    if (change > maxOrientationChange) maxOrientationChange = change;
  }

  if (maxOrientationChange > 120) signals.push(`Significant device rotation (${maxOrientationChange.toFixed(0)}°)`);
  else if (maxOrientationChange > 60) signals.push(`Moderate rotation (${maxOrientationChange.toFixed(0)}°)`);

  // 4. Post-impact stationarity — device stopped moving after impact
  const postImpactReadings = impactTimestamp > 0
    ? recent.filter((r) => r.timestamp > impactTimestamp)
    : [];

  let postImpactStationary = false;
  if (postImpactReadings.length >= 3) {
    const avgSpeed = speedReadings.length > 0
      ? postImpactReadings
          .filter((r) => r.speedKmh !== null)
          .reduce((sum, r, _, arr) => sum + (r.speedKmh ?? 0) / arr.length, 0)
      : 0;
    const avgAccelVar = postImpactReadings.reduce((sum, r, i, arr) => {
      if (i === 0) return 0;
      const prev = arr[i - 1];
      const dA = Math.abs(
        Math.sqrt(r.accelX ** 2 + r.accelY ** 2 + r.accelZ ** 2) -
        Math.sqrt(prev.accelX ** 2 + prev.accelY ** 2 + prev.accelZ ** 2),
      );
      return sum + dA;
    }, 0) / Math.max(1, postImpactReadings.length - 1);

    postImpactStationary = avgSpeed < STATIONARY_SPEED_THRESHOLD && avgAccelVar < 2;
    if (postImpactStationary) signals.push('Device stationary after impact');
  }

  // 5. Combined acceleration variance — abnormal movement pattern
  let accelVariance = 0;
  if (recent.length > 2) {
    const totalAccels = recent.map((r) =>
      Math.sqrt(r.accelX ** 2 + r.accelY ** 2 + r.accelZ ** 2),
    );
    const mean = totalAccels.reduce((a, b) => a + b, 0) / totalAccels.length;
    accelVariance = totalAccels.reduce((sum, a) => sum + (a - mean) ** 2, 0) / totalAccels.length;
    if (accelVariance > 50) signals.push('Abnormal movement pattern detected');
  }

  // ===== SENSOR FUSION SCORING =====
  // Each signal contributes a weighted score, but no single signal alone
  // can trigger an emergency — multiple signals must be present.

  let score = 0;
  let signalCount = 0;

  // Impact contribution (max 35 points)
  if (maxImpact > SEVERE_IMPACT_THRESHOLD) { score += 35; signalCount++; }
  else if (maxImpact > HIGH_IMPACT_THRESHOLD) { score += 25; signalCount++; }
  else if (maxImpact > 15) { score += 15; signalCount++; }
  else if (maxImpact > 8) { score += 8; }

  // Speed drop contribution (max 25 points)
  if (speedDrop > 40) { score += 25; signalCount++; }
  else if (speedDrop > 25) { score += 18; signalCount++; }
  else if (speedDrop > 15) { score += 10; }
  else if (speedDrop > 8) { score += 5; }

  // Orientation change contribution (max 20 points)
  if (maxOrientationChange > 120) { score += 20; signalCount++; }
  else if (maxOrientationChange > 60) { score += 12; signalCount++; }
  else if (maxOrientationChange > 30) { score += 5; }

  // Post-impact stationarity (max 15 points) — only if there was an impact
  if (postImpactStationary && maxImpact > 8) { score += 15; signalCount++; }

  // Acceleration variance (max 10 points)
  if (accelVariance > 50) { score += 10; signalCount++; }
  else if (accelVariance > 20) { score += 5; }

  // Multi-signal bonus: if 3+ signals fire simultaneously, boost score
  // This is the core of the false-alarm prevention — a single sensor reading
  // can contribute at most 35 points, which is below the emergency threshold.
  if (signalCount >= 4) score += 10;
  else if (signalCount >= 3) score += 5;

  score = Math.min(100, Math.round(score));

  let level: RiskLevel = 'normal';
  if (score >= HIGH_CONFIDENCE_THRESHOLD) level = 'high_confidence';
  else if (score >= EMERGENCY_THRESHOLD) level = 'possible';
  else if (score >= 31) level = 'suspicious';

  let severity: CrashSeverity | null = null;
  if (score >= HIGH_CONFIDENCE_THRESHOLD) {
    severity = maxImpact > SEVERE_IMPACT_THRESHOLD ? 'critical' : 'severe';
  } else if (score >= EMERGENCY_THRESHOLD) {
    severity = maxImpact > HIGH_IMPACT_THRESHOLD ? 'severe' : 'moderate';
  } else if (score >= 31) {
    severity = 'minor';
  }

  return {
    score,
    level,
    impactMagnitude: maxImpact,
    speedDrop,
    orientationChange: maxOrientationChange,
    postImpactStationary,
    signals,
    severity,
  };
}

export function getRiskLevelText(level: RiskLevel): string {
  switch (level) {
    case 'normal': return 'Normal activity';
    case 'suspicious': return 'Suspicious event';
    case 'possible': return 'Possible accident';
    case 'high_confidence': return 'High-confidence accident';
  }
}

export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'normal': return 'text-emerald-600';
    case 'suspicious': return 'text-amber-600';
    case 'possible': return 'text-orange-600';
    case 'high_confidence': return 'text-red-600';
  }
}

// ===== SENSOR MANAGER =====
// Manages device sensor access (DeviceMotion + Geolocation) and provides
// a stream of SensorReading objects to the crash detection engine.

export class SensorManager {
  private readings: SensorReading[] = [];
  private motionListener: ((e: DeviceMotionEvent) => void) | null = null;
  private orientationListener: ((e: DeviceOrientationEvent) => void) | null = null;
  private geoWatchId: number | null = null;
  private currentSpeed: number | null = null;
  private currentOrientation = { alpha: 0, beta: 0, gamma: 0 };
  private onReadingCallback: ((reading: SensorReading) => void) | null = null;
  private active = false;

  async requestPermissions(): Promise<boolean> {
    try {
      // iOS 13+ requires explicit permission for DeviceMotionEvent
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        const motionPerm = await (DeviceMotionEvent as any).requestPermission();
        if (motionPerm !== 'granted') return false;
      }
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const orientPerm = await (DeviceOrientationEvent as any).requestPermission();
        if (orientPerm !== 'granted') return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  start(onReading: (reading: SensorReading) => void) {
    if (this.active) return;
    this.active = true;
    this.onReadingCallback = onReading;

    this.motionListener = (e: DeviceMotionEvent) => {
      if (!e.accelerationIncludingGravity) return;
      const reading: SensorReading = {
        timestamp: Date.now(),
        accelX: e.accelerationIncludingGravity.x ?? 0,
        accelY: e.accelerationIncludingGravity.y ?? 0,
        accelZ: e.accelerationIncludingGravity.z ?? 0,
        rotationAlpha: this.currentOrientation.alpha,
        rotationBeta: this.currentOrientation.beta,
        rotationGamma: this.currentOrientation.gamma,
        speedKmh: this.currentSpeed,
      };
      this.readings.push(reading);
      // Keep only readings from the last 10 seconds
      const cutoff = Date.now() - READING_WINDOW_MS * 2;
      this.readings = this.readings.filter((r) => r.timestamp > cutoff);
      this.onReadingCallback?.(reading);
    };

    this.orientationListener = (e: DeviceOrientationEvent) => {
      this.currentOrientation = {
        alpha: e.alpha ?? 0,
        beta: e.beta ?? 0,
        gamma: e.gamma ?? 0,
      };
    };

    window.addEventListener('devicemotion', this.motionListener);
    window.addEventListener('deviceorientation', this.orientationListener);

    // Track GPS for speed data
    if (navigator.geolocation) {
      this.geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.currentSpeed = pos.coords.speed != null && pos.coords.speed >= 0
            ? pos.coords.speed * 3.6
            : null;
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 },
      );
    }
  }

  stop() {
    this.active = false;
    if (this.motionListener) {
      window.removeEventListener('devicemotion', this.motionListener);
      this.motionListener = null;
    }
    if (this.orientationListener) {
      window.removeEventListener('deviceorientation', this.orientationListener);
      this.orientationListener = null;
    }
    if (this.geoWatchId !== null) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
    this.readings = [];
    this.onReadingCallback = null;
  }

  getReadings(): SensorReading[] {
    return [...this.readings];
  }

  isActive(): boolean {
    return this.active;
  }

  getBatteryLevel(): Promise<number | null> {
    if ('getBattery' in navigator) {
      return (navigator as any).getBattery()
        .then((battery: any) => Math.round(battery.level * 100))
        .catch(() => null);
    }
    return Promise.resolve(null);
  }

  clearReadings() {
    this.readings = [];
  }
}

// ===== FALSE ALARM CLASSIFICATION =====
// Distinguishes normal events (phone dropped, sudden braking, running)
// from potential emergencies using sensor fusion.

export interface FalseAlarmCheck {
  isFalseAlarm: boolean;
  reason: string;
}

export function classifyFalseAlarm(analysis: CrashAnalysis): FalseAlarmCheck {
  // Phone drop: high impact but no speed change and device is stationary after
  if (analysis.impactMagnitude > 20 && analysis.speedDrop < 5 && analysis.postImpactStationary) {
    return { isFalseAlarm: true, reason: 'Likely phone dropped — impact without vehicle movement' };
  }

  // Sudden braking only: speed drop but no impact and no rotation
  if (analysis.speedDrop > 20 && analysis.impactMagnitude < 8 && analysis.orientationChange < 30) {
    return { isFalseAlarm: true, reason: 'Likely sudden braking — no impact or rotation detected' };
  }

  // Running/jumping: moderate impact with high acceleration variance but no speed drop
  if (analysis.impactMagnitude > 8 && analysis.impactMagnitude < 15 && analysis.speedDrop < 5 && analysis.orientationChange < 30) {
    return { isFalseAlarm: true, reason: 'Likely physical activity — running or jumping pattern' };
  }

  // Single sensor only — not enough confirmation
  if (analysis.signals.length <= 1 && analysis.score < HIGH_CONFIDENCE_THRESHOLD) {
    return { isFalseAlarm: true, reason: 'Insufficient sensor confirmation — single signal event' };
  }

  return { isFalseAlarm: false, reason: '' };
}

// ===== EMERGENCY MESSAGE BUILDER =====
export function buildEmergencyIncidentMessage(opts: {
  username: string;
  lat: number;
  lng: number;
  locationName?: string;
  crashScore: number;
  impactSeverity: CrashSeverity | null;
  incidentType: IncidentType;
  batteryLevel: number | null;
  speedBefore: number | null;
  medicalInfo?: string | null;
  nearbyHospitals: string[];
  nearbyPolice: string[];
  nearbyFire: string[];
  userResponse: string;
}): string {
  const mapsLink = `https://maps.google.com/?q=${opts.lat.toFixed(5)},${opts.lng.toFixed(5)}`;
  const lines = [
    'AUTOMATIC EMERGENCY ALERT',
    `Possible ${opts.incidentType.replace(/_/g, ' ')} detected.`,
    `Location: ${opts.lat.toFixed(5)},${opts.lng.toFixed(5)}`,
  ];
  if (opts.locationName) lines.push(`Area: ${opts.locationName}`);
  lines.push(`Time: ${new Date().toLocaleString()}`);
  lines.push(`Crash confidence: ${opts.crashScore}%`);
  if (opts.impactSeverity) lines.push(`Impact severity: ${opts.impactSeverity}`);
  lines.push(`User response: ${opts.userResponse}`);
  if (opts.batteryLevel !== null) lines.push(`Battery: ${opts.batteryLevel}%`);
  if (opts.speedBefore !== null) lines.push(`Speed before: ${opts.speedBefore.toFixed(0)} km/h`);
  if (opts.medicalInfo) lines.push(`Medical info: ${opts.medicalInfo}`);
  if (opts.nearbyHospitals.length > 0) lines.push(`Nearest hospital: ${opts.nearbyHospitals[0]}`);
  if (opts.nearbyPolice.length > 0) lines.push(`Nearest police: ${opts.nearbyPolice[0]}`);
  if (opts.nearbyFire.length > 0) lines.push(`Nearest fire station: ${opts.nearbyFire[0]}`);
  lines.push(`Map: ${mapsLink}`);
  return lines.join('\n');
}

// ===== INCIDENT STATUS FLOW =====
export const INCIDENT_STATUSES = [
  'detected',
  'verifying',
  'user_confirmed',
  'no_response',
  'confirmed',
  'authorities_notified',
  'rescue_dispatched',
  'rescue_arrived',
  'resolved',
] as const;

export function getNextStatus(current: string): string {
  const idx = INCIDENT_STATUSES.indexOf(current as any);
  if (idx >= 0 && idx < INCIDENT_STATUSES.length - 1) {
    return INCIDENT_STATUSES[idx + 1];
  }
  return current;
}

export function getStatusLabel(status: string): string {
  return status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    detected: 'bg-blue-100 text-blue-700',
    verifying: 'bg-amber-100 text-amber-700',
    user_confirmed: 'bg-orange-100 text-orange-700',
    no_response: 'bg-red-100 text-red-700',
    confirmed: 'bg-red-200 text-red-800',
    authorities_notified: 'bg-purple-100 text-purple-700',
    rescue_dispatched: 'bg-indigo-100 text-indigo-700',
    rescue_arrived: 'bg-teal-100 text-teal-700',
    resolved: 'bg-emerald-100 text-emerald-700',
  };
  return map[status] ?? 'bg-slate-100 text-slate-700';
}

// ===== AI CONDITION MATCHING =====
// Matches patient condition to appropriate hospital type/facility.

export interface ConditionMatch {
  condition: string;
  recommendedFacilityType: string;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
}

const CONDITION_DATABASE: ConditionMatch[] = [
  { condition: 'heart attack', recommendedFacilityType: 'Cardiac center', priority: 'high', tags: ['cardiac', 'emergency', 'icu'] },
  { condition: 'cardiac arrest', recommendedFacilityType: 'Cardiac center', priority: 'high', tags: ['cardiac', 'emergency', 'icu'] },
  { condition: 'chest pain', recommendedFacilityType: 'Cardiac center', priority: 'high', tags: ['cardiac', 'emergency'] },
  { condition: 'stroke', recommendedFacilityType: 'Stroke center', priority: 'high', tags: ['neuro', 'emergency', 'icu'] },
  { condition: 'head injury', recommendedFacilityType: 'Trauma center', priority: 'high', tags: ['trauma', 'neuro', 'emergency'] },
  { condition: 'brain injury', recommendedFacilityType: 'Trauma center', priority: 'high', tags: ['trauma', 'neuro', 'emergency'] },
  { condition: 'spinal injury', recommendedFacilityType: 'Trauma center', priority: 'high', tags: ['trauma', 'ortho', 'emergency'] },
  { condition: 'severe bleeding', recommendedFacilityType: 'Trauma center', priority: 'high', tags: ['trauma', 'emergency', 'surgery'] },
  { condition: 'heavy bleeding', recommendedFacilityType: 'Trauma center', priority: 'high', tags: ['trauma', 'emergency', 'surgery'] },
  { condition: 'fracture', recommendedFacilityType: 'Orthopedic hospital', priority: 'medium', tags: ['ortho', 'emergency'] },
  { condition: 'broken bone', recommendedFacilityType: 'Orthopedic hospital', priority: 'medium', tags: ['ortho', 'emergency'] },
  { condition: 'broken leg', recommendedFacilityType: 'Orthopedic hospital', priority: 'medium', tags: ['ortho', 'emergency'] },
  { condition: 'broken arm', recommendedFacilityType: 'Orthopedic hospital', priority: 'medium', tags: ['ortho', 'emergency'] },
  { condition: 'burn', recommendedFacilityType: 'Burn unit', priority: 'high', tags: ['burn', 'emergency', 'surgery'] },
  { condition: 'burns', recommendedFacilityType: 'Burn unit', priority: 'high', tags: ['burn', 'emergency', 'surgery'] },
  { condition: 'pregnancy', recommendedFacilityType: 'Maternity hospital', priority: 'high', tags: ['maternity', 'emergency'] },
  { condition: 'labor', recommendedFacilityType: 'Maternity hospital', priority: 'high', tags: ['maternity', 'emergency'] },
  { condition: 'childbirth', recommendedFacilityType: 'Maternity hospital', priority: 'high', tags: ['maternity', 'emergency'] },
  { condition: 'difficulty breathing', recommendedFacilityType: 'General hospital', priority: 'high', tags: ['respiratory', 'emergency'] },
  { condition: 'respiratory', recommendedFacilityType: 'General hospital', priority: 'high', tags: ['respiratory', 'emergency'] },
  { condition: 'asthma', recommendedFacilityType: 'General hospital', priority: 'medium', tags: ['respiratory'] },
  { condition: 'poisoning', recommendedFacilityType: 'General hospital', priority: 'high', tags: ['toxicology', 'emergency'] },
  { condition: 'snake bite', recommendedFacilityType: 'General hospital', priority: 'high', tags: ['toxicology', 'emergency'] },
  { condition: 'snakebite', recommendedFacilityType: 'General hospital', priority: 'high', tags: ['toxicology', 'emergency'] },
  { condition: 'fever', recommendedFacilityType: 'General hospital', priority: 'low', tags: ['general'] },
  { condition: 'infection', recommendedFacilityType: 'General hospital', priority: 'medium', tags: ['general', 'internal'] },
  { condition: 'unconscious', recommendedFacilityType: 'Trauma center', priority: 'high', tags: ['trauma', 'neuro', 'emergency', 'icu'] },
  { condition: 'seizure', recommendedFacilityType: 'General hospital', priority: 'high', tags: ['neuro', 'emergency'] },
  { condition: 'convulsion', recommendedFacilityType: 'General hospital', priority: 'high', tags: ['neuro', 'emergency'] },
  { condition: 'allergic reaction', recommendedFacilityType: 'General hospital', priority: 'high', tags: ['allergy', 'emergency'] },
  { condition: 'anaphylaxis', recommendedFacilityType: 'General hospital', priority: 'high', tags: ['allergy', 'emergency', 'icu'] },
  { condition: 'drowning', recommendedFacilityType: 'General hospital', priority: 'high', tags: ['respiratory', 'emergency', 'icu'] },
  { condition: 'electric shock', recommendedFacilityType: 'General hospital', priority: 'high', tags: ['cardiac', 'emergency'] },
  { condition: 'shock', recommendedFacilityType: 'General hospital', priority: 'high', tags: ['emergency', 'icu'] },
];

export function matchCondition(input: string): ConditionMatch | null {
  const lower = input.toLowerCase().trim();
  if (!lower) return null;

  // Exact match first
  const exact = CONDITION_DATABASE.find((c) => c.condition === lower);
  if (exact) return exact;

  // Partial match — condition text appears in the input
  const partial = CONDITION_DATABASE
    .filter((c) => lower.includes(c.condition) || c.condition.includes(lower))
    .sort((a, b) => b.condition.length - a.condition.length)[0];

  return partial ?? null;
}

export function getAllConditions(): string[] {
  return CONDITION_DATABASE.map((c) => c.condition).sort();
}
