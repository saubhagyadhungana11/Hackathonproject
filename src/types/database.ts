export type IncidentType =
  | 'flood'
  | 'landslide'
  | 'earthquake'
  | 'fire'
  | 'roadblock'
  | 'avalanche'
  | 'rockfall'
  | 'other';

export type Severity = 'low' | 'moderate' | 'high' | 'critical';

export interface Profile {
  id: string;
  username: string;
  email: string;
  phone: string;
  is_admin: boolean;
  admin_role: string | null;
  created_at: string;
}

export interface Incident {
  id: string;
  user_id: string;
  type: IncidentType;
  severity: Severity;
  description: string | null;
  latitude: number;
  longitude: number;
  location_name: string | null;
  media_url: string | null;
  media_type: string | null;
  status: string;
  created_at: string;
}

export interface SosAlert {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
  severity: Severity;
  message: string | null;
  status: string;
  responder_count: number;
  incident_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SoilReading {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
  moisture_pct: number;
  rainfall_mm: number;
  slope_angle: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  notes: string | null;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  user_id: string | null;
  name: string;
  role: string;
  phone: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  is_official: boolean;
  created_at: string;
}

export interface HospitalNotification {
  id: string;
  user_id: string;
  hospital_name: string;
  hospital_lat: number;
  hospital_lng: number;
  patient_lat: number;
  patient_lng: number;
  severity: Severity;
  condition_description: string | null;
  estimated_eta_min: number | null;
  status: string;
  condition_tags: string | null;
  photo_urls: string[] | null;
  incident_type: string | null;
  created_at: string;
}

export interface EmergencyIncident {
  id: string;
  user_id: string;
  incident_type: IncidentType | 'vehicle_crash' | 'fall' | 'disaster' | 'manual_sos';
  latitude: number;
  longitude: number;
  location_name: string | null;
  crash_score: number;
  impact_severity: 'minor' | 'moderate' | 'severe' | 'critical' | null;
  verification_status: string;
  user_response: string | null;
  battery_level: number | null;
  speed_before: number | null;
  speed_after: number | null;
  device_orientation_change: number | null;
  num_people: number | null;
  medical_info: string | null;
  assigned_police: string | null;
  assigned_fire: string | null;
  assigned_ambulance: string | null;
  assigned_hospital: string | null;
  incident_status: string;
  responder_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserMedicalInfo {
  id: string;
  user_id: string;
  blood_type: string | null;
  allergies: string | null;
  medications: string | null;
  chronic_conditions: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact2_name: string | null;
  emergency_contact2_phone: string | null;
  updated_at: string;
}

export interface HospitalAlertPhoto {
  id: string;
  user_id: string;
  notification_id: string | null;
  photo_url: string;
  photo_description: string | null;
  condition_tags: string | null;
  created_at: string;
}

export interface IncidentAuditLog {
  id: string;
  incident_id: string;
  action: string;
  performed_by: string | null;
  details: string | null;
  created_at: string;
}

export interface GeocodeResult {
  displayName: string;
  latitude: number;
  longitude: number;
  raw: {
    place_id?: number;
    type?: string;
    address?: Record<string, string>;
  };
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  description: string;
  icon: string;
  precipitation: number;
  cloudCover: number;
  visibility: number;
  pressure: number;
  isDay: boolean;
}
