// components/ForecastRow.tsx
import React from 'react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Droplets,
} from 'lucide-react';
import { WeatherForecast } from '../services/weatherService';

interface ForecastRowProps {
  forecast: WeatherForecast;
  isToday?: boolean;
}

function getWeatherIcon(code: number, size: string = 'w-5 h-5') {
  if (code === 0 || code === 1) return <Sun className={`${size} text-yellow-500`} />;
  if (code === 2 || code === 3) return <Cloud className={`${size} text-slate-400`} />;
  if (code >= 45 && code <= 48) return <CloudFog className={`${size} text-slate-400`} />;
  if (code >= 51 && code <= 67) return <CloudRain className={`${size} text-blue-500`} />;
  if (code >= 71 && code <= 86) return <CloudSnow className={`${size} text-blue-300`} />;
  if (code >= 95) return <CloudLightning className={`${size} text-purple-500`} />;
  return <Cloud className={`${size} text-slate-400`} />;
}

export const ForecastRow: React.FC<ForecastRowProps> = ({ forecast, isToday }) => {
  const dayName = isToday ? 'Dnes' : format(forecast.date, 'EEEE', { locale: cs });
  const dateStr = format(forecast.date, 'd.M.', { locale: cs });

  const moisturePercent = (forecast.soilMoisture0to1cm * 100).toFixed(0);
  const moistureColor =
    forecast.soilMoisture0to1cm < 0.1
      ? 'text-red-600 bg-red-50'
      : forecast.soilMoisture0to1cm < 0.2
      ? 'text-amber-600 bg-amber-50'
      : 'text-emerald-600 bg-emerald-50';

  return (
    <div
      className={`flex items-center justify-between py-2 px-3 rounded-lg ${
        isToday ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {getWeatherIcon(forecast.weatherCode)}
        <div className="min-w-0">
          <div className="font-medium text-slate-800 capitalize truncate">
            {dayName}
          </div>
          <div className="text-xs text-slate-500">{dateStr}</div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="text-right">
          <span className="font-semibold text-slate-800">
            {forecast.temperatureMax.toFixed(0)}°
          </span>
          <span className="text-slate-400 mx-1">/</span>
          <span className="text-slate-500">
            {forecast.temperatureMin.toFixed(0)}°
          </span>
        </div>

        {forecast.precipitation > 0 && (
          <div className="flex items-center gap-1 text-blue-600">
            <CloudRain className="w-4 h-4" />
            <span>{forecast.precipitation.toFixed(1)}</span>
          </div>
        )}

        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${moistureColor}`}
        >
          <Droplets className="w-3 h-3" />
          <span>{moisturePercent}%</span>
        </div>
      </div>
    </div>
  );
};
