// hooks/useProactiveRiskCheck.ts
import { useEffect, useState } from 'react';
import { fetchEvents } from '../services/eventService';
import { fetchAlerts } from '../services/alertService';
import { fetchWeatherForecast } from '../services/weatherService';
import { EventStatus } from '../types';
import { addDays, isWithinInterval, format } from 'date-fns';

export interface RiskWarning {
  eventId: string;
  eventTitle: string;
  eventDate: Date;
  risks: string[];
  severity: 'warning' | 'danger';
}

export function useProactiveRiskCheck(enabled: boolean = true) {
  const [warnings, setWarnings] = useState<RiskWarning[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled) return;

    async function checkRisks() {
      try {
        const [events, alerts, forecast] = await Promise.all([
          fetchEvents(),
          fetchAlerts(),
          fetchWeatherForecast(50.0755, 14.4378, 7)
        ]);

        const upcomingEvents = events.filter(e =>
          e.status === EventStatus.PLANNED &&
          e.start_at > new Date() &&
          e.start_at < addDays(new Date(), 7)
        );

        const newWarnings: RiskWarning[] = [];

        for (const event of upcomingEvents) {
          const eventRisks: string[] = [];
          let severity: 'warning' | 'danger' = 'warning';

          // Check alerts
          const relevantAlerts = alerts.filter(a =>
            isWithinInterval(event.start_at, { start: a.valid_from, end: a.valid_to })
          );

          for (const alert of relevantAlerts) {
            if (alert.level === 'danger') {
              eventRisks.push(alert.title);
              severity = 'danger';
            } else if (alert.level === 'warning') {
              eventRisks.push(alert.title);
            }
          }

          // Check forecast
          const dayForecast = forecast.find(f =>
            format(f.date, 'yyyy-MM-dd') === format(event.start_at, 'yyyy-MM-dd')
          );

          if (dayForecast) {
            if (dayForecast.temperatureMin < -2) {
              eventRisks.push(`Mráz (${dayForecast.temperatureMin.toFixed(0)}°C)`);
              severity = 'danger';
            }
            if (dayForecast.soilMoisture0to1cm < 0.1) {
              eventRisks.push('Kriticky suchá půda');
              severity = 'danger';
            }
            if (dayForecast.precipitation > 15) {
              eventRisks.push(`Silné srážky (${dayForecast.precipitation.toFixed(0)}mm)`);
            }
          }

          if (eventRisks.length > 0) {
            newWarnings.push({
              eventId: event.id,
              eventTitle: event.title,
              eventDate: event.start_at,
              risks: eventRisks,
              severity
            });
          }
        }

        setWarnings(newWarnings);
        setLastCheck(new Date());
      } catch (error) {
        console.error('Risk check failed:', error);
      }
    }

    // Initial check after short delay
    const initialTimeout = setTimeout(checkRisks, 2000);

    // Check every 30 minutes
    const interval = setInterval(checkRisks, 30 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [enabled]);

  return { warnings, lastCheck };
}
