import React from 'react';
import { CalendarEvent, TreeRecord, MeteoAlert, EventType, AlertLevel } from '../types';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  CalendarDays,
  TreeDeciduous,
  AlertTriangle,
  MapPin,
  Camera,
  Leaf,
  Droplets,
  Thermometer,
  CloudSun,
  Trash2
} from 'lucide-react';
import { WeatherCard } from './WeatherCard';
import { ForecastRow } from './ForecastRow';
import { CurrentWeather, WeatherForecast } from '../services/weatherService';

interface DayDetailPanelProps {
  date: Date;
  events: CalendarEvent[];
  trees: TreeRecord[];
  alerts: MeteoAlert[];
  currentWeather: CurrentWeather | null;
  forecast: WeatherForecast[];
  weatherLoading?: boolean;
  onFocusMap: (lat: number, lng: number) => void;
  onPlanClick: () => void;
  onDeleteEvent?: (id: string) => void;
}

export const DayDetailPanel: React.FC<DayDetailPanelProps> = ({
  date,
  events,
  trees,
  alerts,
  currentWeather,
  forecast,
  weatherLoading,
  onFocusMap,
  onPlanClick,
  onDeleteEvent
}) => {
  const formattedDate = format(date, 'd. MMMM yyyy', { locale: cs });
  const dayName = format(date, 'EEEE', { locale: cs });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'drought': return <Droplets className="w-4 h-4" />;
      case 'heat': return <Thermometer className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50">
        <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">{dayName}</div>
        <h2 className="text-2xl font-bold text-slate-800">{formattedDate}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* Weather Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-blue-600 font-semibold uppercase text-xs tracking-wider">
            <CloudSun className="w-4 h-4" />
            <span>Pocasi</span>
          </div>

          <WeatherCard weather={currentWeather} loading={weatherLoading} />

          {forecast.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-xs text-slate-500 mb-2">Predpoved na 7 dni:</p>
              {forecast.slice(0, 7).map((day, index) => (
                <ForecastRow
                  key={day.date.toISOString()}
                  forecast={day}
                  isToday={index === 0}
                />
              ))}
            </div>
          )}
        </section>

        <hr className="border-slate-100" />

        {/* Layer 1: CO SE DĚJE (Alerts/Risks) */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-amber-600 font-semibold uppercase text-xs tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            <span>Co se děje</span>
          </div>
          
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Žádné výstrahy pro tento den.</p>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => (
                <div key={alert.id} className={`p-3 rounded-lg border ${
                  alert.level === AlertLevel.WARNING ? 'bg-amber-50 border-amber-200 text-amber-900' :
                  alert.level === AlertLevel.DANGER ? 'bg-red-50 border-red-200 text-red-900' :
                  'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
                    <div>
                      <h4 className="font-semibold text-sm">{alert.title}</h4>
                      <p className="text-xs mt-1 opacity-90">{alert.description}</p>
                      <button 
                        onClick={() => onFocusMap(alert.affected_area_center.lat, alert.affected_area_center.lng)}
                        className="text-xs font-medium underline mt-2 hover:opacity-75"
                      >
                        Zobrazit oblast
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <hr className="border-slate-100" />

        {/* Layer 2: CO BUDE (Plans) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-blue-600 font-semibold uppercase text-xs tracking-wider">
              <CalendarDays className="w-4 h-4" />
              <span>Co bude</span>
            </div>
            <button 
              onClick={onPlanClick}
              className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
            >
              + Naplánovat
            </button>
          </div>

          {events.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Žádné plány.</p>
          ) : (
            <div className="space-y-3">
              {events.map(event => (
                <div key={event.id} className="group bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onFocusMap(event.lat, event.lng)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase mb-1 ${
                        event.type === EventType.PLANTING ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {event.type === EventType.PLANTING ? 'Výsadba' : 'Údržba'}
                      </span>
                      <h4 className="font-medium text-slate-800">{event.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteEvent?.(event.id); }}
                        className="p-1 rounded hover:bg-red-50 text-red-600 hover:text-red-700"
                        title="Smazat pl?n"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <MapPin className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                  
                  {event.items.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {event.items.map(item => (
                        <div key={item.id} className="flex items-center text-xs text-slate-600">
                          <Leaf className="w-3 h-3 mr-1.5 opacity-50" />
                          <span className="font-semibold mr-1">{item.quantity}x</span>
                          <span className="italic">{item.species_name_latin}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <hr className="border-slate-100" />

        {/* Layer 3: CO BYLO (Realization/Proof) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold uppercase text-xs tracking-wider">
              <Camera className="w-4 h-4" />
              <span>Co bylo (Důkaz)</span>
            </div>
          </div>

          {trees.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Žádné záznamy o výsadbě.</p>
          ) : (
            <div className="space-y-4">
              {trees.map(tree => (
                <div key={tree.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center cursor-pointer"
                     onClick={() => onFocusMap(tree.lat, tree.lng)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <TreeDeciduous size={14} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{tree.species_name_latin}</div>
                      </div>
                    </div>
                    <MapPin className="w-3 h-3 text-slate-400" />
                  </div>
                  
                  {/* Photo Gallery Grid */}
                  {tree.photos.length > 0 && (
                    <div className="grid grid-cols-2 gap-0.5">
                      {tree.photos.map(photo => (
                        <div key={photo.id} className="relative aspect-square group">
                          <img 
                            src={photo.url} 
                            alt={photo.caption || 'Strom'} 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            {/* In a real app, this would open a lightbox */}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {tree.notes && (
                    <div className="p-2 text-xs text-slate-500 italic border-t border-slate-100">
                      "{tree.notes}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
};