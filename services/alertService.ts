// services/alertService.ts
import { supabase } from '../lib/supabase';
import { MeteoAlert, AlertLevel, SOIL_MOISTURE_THRESHOLDS } from '../types';
import { fetchCurrentWeather } from './weatherService';

// MeteoAlarm severity mapping
const METEOALARM_LEVEL_MAP: Record<string, AlertLevel> = {
  'Minor': AlertLevel.INFO,
  'Moderate': AlertLevel.WARNING,
  'Severe': AlertLevel.DANGER,
  'Extreme': AlertLevel.DANGER,
};

// MeteoAlarm event type mapping
const METEOALARM_TYPE_MAP: Record<string, 'drought' | 'storm' | 'heat' | 'frost'> = {
  'Wind': 'storm',
  'Thunderstorm': 'storm',
  'Rain': 'storm',
  'Flood': 'storm',
  'Snow/Ice': 'frost',
  'Extreme low temperature': 'frost',
  'Frost': 'frost',
  'Extreme high temperature': 'heat',
  'Heat wave': 'heat',
  'Forest fire': 'heat',
  'Coastal event': 'storm',
  'Fog': 'frost',
  'Avalanche': 'frost',
};

interface MeteoAlarmWarning {
  id: string;
  awareness_level: string;
  awareness_type: string;
  event: string;
  headline: string;
  description: string;
  onset: string;
  expires: string;
  geometry?: {
    type: string;
    coordinates: number[];
  };
}

/**
 * Fetch alerts from MeteoAlarm API for Czech Republic
 * NOTE: Disabled due to CORS issues and API unavailability (503)
 * TODO: Implement server-side proxy or use different API
 */
async function fetchMeteoAlarmAlerts(): Promise<MeteoAlert[]> {
  // MeteoAlarm API has CORS issues and is frequently unavailable
  // Return empty array to prevent console spam
  // When a server-side proxy is implemented, enable this function
  return [];

  /* Original implementation - disabled due to CORS:
  try {
    const response = await fetch(
      'https://feeds.meteoalarm.org/api/v1/warnings/feeds-czechia',
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      console.warn('MeteoAlarm API unavailable:', response.status);
      return [];
    }

    const data = await response.json();
    const warnings: MeteoAlarmWarning[] = data.warnings || [];

    return warnings.map((warning): MeteoAlert => {
      const type = METEOALARM_TYPE_MAP[warning.awareness_type] || 'storm';
      const level = METEOALARM_LEVEL_MAP[warning.awareness_level] || AlertLevel.INFO;

      let center = { lat: 49.8175, lng: 15.4730 };
      if (warning.geometry?.coordinates) {
        center = {
          lat: warning.geometry.coordinates[1],
          lng: warning.geometry.coordinates[0],
        };
      }

      return {
        id: `meteoalarm-${warning.id}`,
        type,
        level,
        title: warning.headline || `${warning.awareness_type} výstraha`,
        description: warning.description || '',
        valid_from: new Date(warning.onset),
        valid_to: new Date(warning.expires),
        affected_area_center: center,
      };
    });
  } catch (error) {
    console.warn('Failed to fetch MeteoAlarm alerts:', error);
    return [];
  }
  */
}

/**
 * Generate drought alert from soil moisture data
 */
async function generateDroughtAlert(
  lat: number,
  lng: number
): Promise<MeteoAlert | null> {
  const weather = await fetchCurrentWeather(lat, lng);

  if (!weather) return null;

  const moisture = weather.soilMoisture;

  if (moisture < SOIL_MOISTURE_THRESHOLDS.CRITICAL) {
    return {
      id: `drought-critical-${Date.now()}`,
      type: 'drought',
      level: AlertLevel.DANGER,
      title: 'Kritické sucho',
      description: `Vlhkost půdy je pouze ${(moisture * 100).toFixed(0)}%. Okamžitá zálivka nutná!`,
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      affected_area_center: { lat, lng },
    };
  }

  if (moisture < SOIL_MOISTURE_THRESHOLDS.LOW) {
    return {
      id: `drought-warning-${Date.now()}`,
      type: 'drought',
      level: AlertLevel.WARNING,
      title: 'Riziko sucha',
      description: `Vlhkost půdy klesla na ${(moisture * 100).toFixed(0)}%. Doporučena zálivka.`,
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 24 * 60 * 60 * 1000),
      affected_area_center: { lat, lng },
    };
  }

  if (moisture < SOIL_MOISTURE_THRESHOLDS.NORMAL) {
    return {
      id: `drought-info-${Date.now()}`,
      type: 'drought',
      level: AlertLevel.INFO,
      title: 'Nízká vlhkost půdy',
      description: `Vlhkost půdy je ${(moisture * 100).toFixed(0)}%. Sledujte vývoj.`,
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 24 * 60 * 60 * 1000),
      affected_area_center: { lat, lng },
    };
  }

  return null;
}

/**
 * Fetch alerts from Supabase cache (if exists)
 */
async function fetchCachedAlerts(): Promise<MeteoAlert[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('meteo_alerts')
    .select('*')
    .gte('valid_to', now)
    .order('valid_from', { ascending: true });

  if (error) {
    // Table doesn't exist yet - that's OK
    return [];
  }

  return (data || []).map((a) => ({
    id: a.id,
    type: a.type as 'drought' | 'storm' | 'heat' | 'frost',
    level: a.level as AlertLevel,
    title: a.title,
    description: a.description,
    valid_from: new Date(a.valid_from),
    valid_to: new Date(a.valid_to),
    affected_area_center: {
      lat: a.affected_lat,
      lng: a.affected_lng,
    },
  }));
}

/**
 * Main function to fetch all alerts
 * Combines: MeteoAlarm (official) + Drought detection + Supabase cache
 */
export async function fetchAlerts(
  userLat: number = 50.0755, // Default: Praha
  userLng: number = 14.4378
): Promise<MeteoAlert[]> {
  const [meteoAlarmAlerts, cachedAlerts, droughtAlert] = await Promise.all([
    fetchMeteoAlarmAlerts(),
    fetchCachedAlerts(),
    generateDroughtAlert(userLat, userLng),
  ]);

  // Combine all alerts, deduplicate by id
  const allAlerts = [...meteoAlarmAlerts, ...cachedAlerts];

  if (droughtAlert) {
    allAlerts.push(droughtAlert);
  }

  // Deduplicate
  const seen = new Set<string>();
  const uniqueAlerts = allAlerts.filter((alert) => {
    if (seen.has(alert.id)) return false;
    seen.add(alert.id);
    return true;
  });

  // Sort by severity (DANGER first) then by date
  return uniqueAlerts.sort((a, b) => {
    const levelOrder = { [AlertLevel.DANGER]: 0, [AlertLevel.WARNING]: 1, [AlertLevel.INFO]: 2 };
    const levelDiff = levelOrder[a.level] - levelOrder[b.level];
    if (levelDiff !== 0) return levelDiff;
    return a.valid_from.getTime() - b.valid_from.getTime();
  });
}
