// services/weatherService.ts
import { fetchWeatherApi } from 'openmeteo';
import { getCache, setCache } from './cacheService';

export interface WeatherForecast {
  date: Date;
  temperatureMax: number;
  temperatureMin: number;
  precipitation: number;
  precipitationProbability: number;
  soilMoisture0to1cm: number;
  soilTemperature0cm: number;
  weatherCode: number;
}

export interface CurrentWeather {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  precipitation: number;
  soilMoisture: number;
}

const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: 'Jasno',
  1: 'Převážně jasno',
  2: 'Polojasno',
  3: 'Zataženo',
  45: 'Mlha',
  48: 'Námraza',
  51: 'Mrholení - slabé',
  53: 'Mrholení - mírné',
  55: 'Mrholení - silné',
  61: 'Déšť - slabý',
  63: 'Déšť - mírný',
  65: 'Déšť - silný',
  66: 'Mrznoucí déšť - slabý',
  67: 'Mrznoucí déšť - silný',
  71: 'Sněžení - slabé',
  73: 'Sněžení - mírné',
  75: 'Sněžení - silné',
  77: 'Sněhové krupky',
  80: 'Přeháňky - slabé',
  81: 'Přeháňky - mírné',
  82: 'Přeháňky - silné',
  85: 'Sněhové přeháňky - slabé',
  86: 'Sněhové přeháňky - silné',
  95: 'Bouřka',
  96: 'Bouřka s krupobitím - slabá',
  99: 'Bouřka s krupobitím - silná',
};

export function getWeatherDescription(code: number): string {
  return WEATHER_CODE_DESCRIPTIONS[code] || 'Neznámé';
}

export async function fetchWeatherForecast(
  lat: number,
  lng: number,
  days: number = 7
): Promise<WeatherForecast[]> {
  // Check cache first
  const cacheKey = `forecast_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  const cached = getCache<WeatherForecast[]>(cacheKey);

  if (cached) {
    // Convert date strings back to Date objects
    return cached.map(f => ({ ...f, date: new Date(f.date) }));
  }

  const params = {
    latitude: [lat],
    longitude: [lng],
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'weather_code',
    ],
    hourly: [
      'soil_moisture_0_to_1cm',
      'soil_temperature_0cm',
    ],
    timezone: 'Europe/Prague',
    forecast_days: days,
  };

  try {
    const responses = await fetchWeatherApi(
      'https://api.open-meteo.com/v1/forecast',
      params
    );

    const response = responses[0];
    const daily = response.daily()!;
    const hourly = response.hourly()!;

    const forecasts: WeatherForecast[] = [];
    const dailyLength = daily.variables(0)!.valuesArray()!.length;

    for (let i = 0; i < dailyLength; i++) {
      // Average soil moisture for the day (from hourly data)
      const hourlyStartIndex = i * 24;
      let soilMoistureSum = 0;
      let soilTempSum = 0;
      let count = 0;

      const soilMoistureArray = hourly.variables(0)!.valuesArray()!;
      const soilTempArray = hourly.variables(1)!.valuesArray()!;

      for (let h = hourlyStartIndex; h < hourlyStartIndex + 24 && h < soilMoistureArray.length; h++) {
        const moisture = soilMoistureArray[h];
        const temp = soilTempArray[h];
        if (!isNaN(moisture)) {
          soilMoistureSum += moisture;
          soilTempSum += temp;
          count++;
        }
      }

      const dailyTime = Number(daily.time());
      forecasts.push({
        date: new Date((dailyTime + i * 86400) * 1000),
        temperatureMax: daily.variables(0)!.valuesArray()![i],
        temperatureMin: daily.variables(1)!.valuesArray()![i],
        precipitation: daily.variables(2)!.valuesArray()![i],
        precipitationProbability: daily.variables(3)!.valuesArray()![i],
        weatherCode: daily.variables(4)!.valuesArray()![i],
        soilMoisture0to1cm: count > 0 ? soilMoistureSum / count : 0,
        soilTemperature0cm: count > 0 ? soilTempSum / count : 0,
      });
    }

    // Cache for 1 hour
    setCache(cacheKey, forecasts, 60);

    return forecasts;
  } catch (error) {
    console.error('Failed to fetch weather forecast:', error);
    return [];
  }
}

export async function fetchCurrentWeather(
  lat: number,
  lng: number
): Promise<CurrentWeather | null> {
  // Check cache first
  const cacheKey = `current_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  const cached = getCache<CurrentWeather>(cacheKey);

  if (cached) {
    return cached;
  }

  const params = {
    latitude: [lat],
    longitude: [lng],
    current: [
      'temperature_2m',
      'weather_code',
      'wind_speed_10m',
      'precipitation',
    ],
    hourly: ['soil_moisture_0_to_1cm'],
    timezone: 'Europe/Prague',
    forecast_days: 1,
  };

  try {
    const responses = await fetchWeatherApi(
      'https://api.open-meteo.com/v1/forecast',
      params
    );

    const response = responses[0];
    const current = response.current()!;
    const hourly = response.hourly()!;

    // Get current hour's soil moisture
    const now = new Date();
    const hourIndex = now.getHours();
    const soilMoistureValues = hourly.variables(0)!.valuesArray()!;
    const soilMoisture = soilMoistureValues[hourIndex] || soilMoistureValues[0] || 0;

    const result: CurrentWeather = {
      temperature: current.variables(0)!.value(),
      weatherCode: current.variables(1)!.value(),
      windSpeed: current.variables(2)!.value(),
      precipitation: current.variables(3)!.value(),
      soilMoisture,
    };

    // Cache for 15 minutes
    setCache(cacheKey, result, 15);

    return result;
  } catch (error) {
    console.error('Failed to fetch current weather:', error);
    return null;
  }
}
