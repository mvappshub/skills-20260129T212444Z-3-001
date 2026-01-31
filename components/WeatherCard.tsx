// components/WeatherCard.tsx
import React from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Wind,
  Droplets,
} from 'lucide-react';
import { CurrentWeather, getWeatherDescription } from '../services/weatherService';

interface WeatherCardProps {
  weather: CurrentWeather | null;
  loading?: boolean;
}

function getWeatherIcon(code: number) {
  if (code === 0 || code === 1) return <Sun className="w-8 h-8 text-yellow-500" />;
  if (code === 2 || code === 3) return <Cloud className="w-8 h-8 text-slate-400" />;
  if (code >= 45 && code <= 48) return <CloudFog className="w-8 h-8 text-slate-400" />;
  if (code >= 51 && code <= 67) return <CloudRain className="w-8 h-8 text-blue-500" />;
  if (code >= 71 && code <= 86) return <CloudSnow className="w-8 h-8 text-blue-300" />;
  if (code >= 95) return <CloudLightning className="w-8 h-8 text-purple-500" />;
  return <Cloud className="w-8 h-8 text-slate-400" />;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({ weather, loading }) => {
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg p-4 border border-slate-200 animate-pulse">
        <div className="h-8 w-8 bg-slate-200 rounded-full mb-2" />
        <div className="h-6 w-20 bg-slate-200 rounded mb-1" />
        <div className="h-4 w-24 bg-slate-200 rounded" />
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
        <p className="text-sm text-slate-400">Pocasi nedostupne</p>
      </div>
    );
  }

  const moisturePercent = (weather.soilMoisture * 100).toFixed(0);
  const moistureColor =
    weather.soilMoisture < 0.1
      ? 'text-red-600'
      : weather.soilMoisture < 0.2
      ? 'text-amber-600'
      : 'text-emerald-600';

  return (
    <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg p-4 border border-slate-200">
      <div className="flex items-start justify-between">
        <div>
          {getWeatherIcon(weather.weatherCode)}
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-800">
              {weather.temperature.toFixed(1)}°C
            </span>
          </div>
          <p className="text-sm text-slate-600">
            {getWeatherDescription(weather.weatherCode)}
          </p>
        </div>

        <div className="text-right space-y-2">
          <div className="flex items-center justify-end gap-1 text-sm text-slate-600">
            <Wind className="w-4 h-4" />
            <span>{weather.windSpeed.toFixed(0)} km/h</span>
          </div>
          <div className="flex items-center justify-end gap-1 text-sm text-slate-600">
            <CloudRain className="w-4 h-4" />
            <span>{weather.precipitation.toFixed(1)} mm</span>
          </div>
          <div className={`flex items-center justify-end gap-1 text-sm font-medium ${moistureColor}`}>
            <Droplets className="w-4 h-4" />
            <span>Puda: {moisturePercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
