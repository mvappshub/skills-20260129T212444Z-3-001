import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  isWithinInterval
} from 'date-fns';
import { cs } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, Map as MapIcon, Menu, AlertTriangle, Plus, History, Bell } from 'lucide-react';
import { MapCanvas } from './components/MapCanvas';
import { DayDetailPanel } from './components/DayDetailPanel';
import { HistorySidebar } from './components/HistorySidebar';
import { PlanModal } from './components/PlanModal';
import { ChatPanel, ChatButton } from './components/ChatPanel';
import { SettingsModal } from './components/SettingsModal';
import { RiskBanner } from './components/RiskBanner';
import { NotificationPanel, NotificationBell } from './components/NotificationPanel';
import { useProactiveRiskCheck } from './hooks/useProactiveRiskCheck';
import { useNotifications } from './hooks/useNotifications';
import { fetchEvents, createEvent } from './services/eventService';
import { fetchTrees } from './services/treeService';
import { fetchAlerts } from './services/alertService';
import { reverseGeocode } from './services/geocodingService';
import {
  fetchWeatherForecast,
  fetchCurrentWeather,
  CurrentWeather,
  WeatherForecast
} from './services/weatherService';
import { CalendarEvent, TreeRecord, MeteoAlert, EventType, AlertLevel } from './types';

type ViewMode = 'calendar' | 'map';

// Utility for creating day summaries
const getDayModifiers = (date: Date, events: CalendarEvent[], trees: TreeRecord[], alerts: MeteoAlert[]) => {
  const dayEvents = events.filter(e => isSameDay(e.start_at, date));
  const dayTrees = trees.filter(t => isSameDay(t.planted_at, date));
  const dayAlerts = alerts.filter(a => isWithinInterval(date, { start: a.valid_from, end: a.valid_to }));

  return {
    hasPlan: dayEvents.length > 0,
    hasRealization: dayTrees.length > 0,
    hasAlert: dayAlerts.length > 0,
    alertLevel: dayAlerts.length > 0
      ? dayAlerts.reduce((prev, curr) => curr.level === AlertLevel.DANGER ? AlertLevel.DANGER : prev, AlertLevel.INFO)
      : undefined
  };
};

export default function App() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'map'>('map');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // --- Real Data State ---
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [trees, setTrees] = useState<TreeRecord[]>([]);
  const [alerts, setAlerts] = useState<MeteoAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // --- Weather State ---
  const [currentWeather, setCurrentWeather] = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // --- UI State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [pickedLocationAddress, setPickedLocationAddress] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const [focusLocation, setFocusLocation] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  // --- Chat State ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // --- Proactive Risk Check ---
  const { warnings: riskWarnings } = useProactiveRiskCheck(true);
  const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([]);
  const activeWarnings = riskWarnings.filter(w => !dismissedWarnings.includes(w.eventId));

  // --- Notifications ---
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    dismiss: dismissNotification,
    checkForAlerts
  } = useNotifications();

  // Default location (Praha)
  const DEFAULT_LAT = 50.0755;
  const DEFAULT_LNG = 14.4378;

  // --- Load data from Supabase ---
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [eventsData, treesData, alertsData] = await Promise.all([
          fetchEvents(),
          fetchTrees(),
          fetchAlerts(DEFAULT_LAT, DEFAULT_LNG)
        ]);
        setEvents(eventsData);
        setTrees(treesData);
        setAlerts(alertsData);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // --- Load weather data ---
  useEffect(() => {
    async function loadWeather() {
      setWeatherLoading(true);
      try {
        const [weather, forecastData] = await Promise.all([
          fetchCurrentWeather(DEFAULT_LAT, DEFAULT_LNG),
          fetchWeatherForecast(DEFAULT_LAT, DEFAULT_LNG, 7)
        ]);

        setCurrentWeather(weather);
        setForecast(forecastData);
      } catch (error) {
        console.error('Failed to load weather:', error);
      } finally {
        setWeatherLoading(false);
      }
    }

    loadWeather();

    // Refresh weather every 30 minutes
    const interval = setInterval(loadWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Data Filtering based on selected context ---
  const currentDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });
  }, [currentMonth]);

  // Data for the selected day (Passed to Detail Panel)
  const selectedDayData = useMemo(() => {
    return {
      events: events.filter(e => isSameDay(e.start_at, selectedDate)),
      trees: trees.filter(t => isSameDay(t.planted_at, selectedDate)),
      alerts: alerts.filter(a => isWithinInterval(selectedDate, { start: a.valid_from, end: a.valid_to }))
    };
  }, [selectedDate, events, trees, alerts]);

  // Data for the Map - based on view mode
  const mapData = useMemo(() => {
    if (viewMode === 'calendar') {
      // Show only current month
      return {
        events: events.filter(e => isSameMonth(e.start_at, currentMonth)),
        trees: trees.filter(t => isSameMonth(t.planted_at, currentMonth))
      };
    } else {
      // Show all data for history and map views
      return {
        events: events,
        trees: trees
      };
    }
  }, [viewMode, currentMonth, events, trees]);

  // --- Handlers ---
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const formatLatLng = (lat: number, lng: number) => `Souřadnice: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  const resolveAddress = async (lat: number, lng: number) => {
    if (geocodeAbortRef.current) {
      geocodeAbortRef.current.abort();
    }
    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    setIsGeocoding(true);
    setPickedLocationAddress(null);

    try {
      const resolved = await reverseGeocode(lat, lng, controller.signal);
      if (!controller.signal.aborted) {
        setPickedLocationAddress(resolved || formatLatLng(lat, lng));
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setPickedLocationAddress(formatLatLng(lat, lng));
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsGeocoding(false);
      }
    }
  };

  const setPickedLocationWithAddress = (lat: number, lng: number) => {
    setPickedLocation({ lat, lng });
    resolveAddress(lat, lng);
  };

  const handleMapFocus = (lat: number, lng: number, zoom?: number, switchToMap = true) => {
    console.log(`Focusing map on ${lat}, ${lng}`);
    setFocusLocation({ lat, lng, zoom });
    // Only switch to map view if requested
    if (switchToMap && viewMode !== 'map') {
      setViewMode('map');
    }
  };

  // For calendar/history sidebar - just select, don't switch view
  const handleSelectEvent = (id: string) => {
    setSelectedItemId(id);
  };

  // For calendar - switch to map
  const handleEventClick = (id: string) => {
    const event = events.find(e => e.id === id);
    if (event) {
      setSelectedItemId(id);
      setSelectedEventId(id);
      handleMapFocus(event.lat, event.lng, 16, true); // switch to map
    }
  };

  // For map markers - just select and show detail in sidebar
  const handleEventClickFromMap = (id: string) => {
    const event = events.find(e => e.id === id);
    if (event) {
      setSelectedItemId(id);
      setSelectedEventId(id);
      setSelectedTreeId(null); // clear tree selection
      // Don't switch view - we're already in map view
    }
  };

  const handleTreeClick = (id: string) => {
    const tree = trees.find(t => t.id === id);
    if (tree) {
      setSelectedItemId(id);
      setSelectedTreeId(id);
      setSelectedEventId(null); // clear event selection
      // Don't switch view - sidebar will show detail
    }
  };

  const handleOpenPlanModal = () => {
    setIsModalOpen(true);
    setPickedLocation(null);
    setPickedLocationAddress(null);
    setIsGeocoding(false);
    if (geocodeAbortRef.current) {
      geocodeAbortRef.current.abort();
    }
  };

  const handleStartPickingLocation = () => {
    setIsModalOpen(false);
    setIsPickingLocation(true);
    setPickedLocationAddress(null);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (isPickingLocation) {
      setIsPickingLocation(false);
      setIsModalOpen(true);
      setPickedLocationWithAddress(lat, lng);
    }
  };

  const handleCancelPickingLocation = () => {
    setIsPickingLocation(false);
    setIsModalOpen(true);
  };

  const handleSetLocation = (lat: number, lng: number) => {
    setPickedLocationWithAddress(lat, lng);
  };

  const handleSaveEvent = async (eventData: Partial<CalendarEvent>) => {
    try {
      const newEvent = await createEvent({
        title: eventData.title || 'Nová akce',
        type: eventData.type || EventType.OTHER,
        status: eventData.status!,
        start_at: eventData.start_at!,
        lat: eventData.lat!,
        lng: eventData.lng!,
        end_at: eventData.end_at,
        address: eventData.address || pickedLocationAddress || undefined,
        radius_m: eventData.radius_m,
        items: eventData.items || [],
        notes: eventData.notes
      });

      setEvents(prev => [...prev, newEvent]);
      setIsModalOpen(false);

      if (!isSameMonth(newEvent.start_at, currentMonth)) {
        setCurrentMonth(newEvent.start_at);
      }
      setSelectedDate(newEvent.start_at);
    } catch (err) {
      console.error('Failed to create event:', err);
      alert('Nepodařilo se vytvořit akci. Zkuste to znovu.');
    }
  };

  const handleSidebarItemClick = (item: { type: 'event' | 'tree'; id: string }) => {
    setSelectedItemId(item.id);
    // For history sidebar - set the appropriate selected ID
    if (item.type === 'event') {
      setSelectedEventId(item.id);
      setSelectedTreeId(null); // clear tree selection
    } else {
      setSelectedTreeId(item.id);
      setSelectedEventId(null); // clear event selection
    }
  };

  // Refresh tree data after photo upload
  const handleTreeUpdate = async () => {
    try {
      const treesData = await fetchTrees();
      setTrees(treesData);
    } catch (err) {
      console.error('Failed to refresh trees:', err);
    }
  };

  // Refresh events after AI creates/modifies event
  const handleAIEventChange = async () => {
    try {
      const [eventsData, alertsData] = await Promise.all([
        fetchEvents(),
        fetchAlerts(DEFAULT_LAT, DEFAULT_LNG)
      ]);
      setEvents(eventsData);
      setAlerts(alertsData);
    } catch (err) {
      console.error('Failed to refresh events:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Načítám data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center text-red-600">
          <p className="text-lg font-medium">Chyba při načítání dat</p>
          <p className="text-sm mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col text-slate-900 font-sans">

      {/* Risk Warning Banner */}
      <RiskBanner
        warnings={activeWarnings}
        onDismiss={(id) => setDismissedWarnings(prev => [...prev, id])}
        onOpenChat={() => setIsChatOpen(true)}
      />

      {/* Header with tabs */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-emerald-700 flex items-center gap-2">
            <Calendar className="text-emerald-600" /> SilvaPlan
          </h1>

          {/* View mode tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'calendar'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
                }`}
            >
              Kalendář
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'map'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
                }`}
            >
              Mapa
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell
            unreadCount={unreadCount}
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          />
          <button
            onClick={handleOpenPlanModal}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium shadow hover:bg-emerald-700 transition-colors"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Nová akce</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Main area - Map or Calendar */}
        <main className="flex-1 relative">
          {viewMode === 'calendar' ? (
            // Calendar view
            <div className="h-full flex flex-col">
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                      <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-xl font-semibold">
                      {format(currentMonth, 'LLLL yyyy', { locale: cs })}
                    </h2>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map(day => (
                      <div key={day} className="bg-slate-50 p-3 text-center text-sm font-semibold text-slate-500">
                        {day}
                      </div>
                    ))}

                    {Array.from({ length: (startOfMonth(currentMonth).getDay() + 6) % 7 }).map((_, i) => (
                      <div key={`empty-${i}`} className="bg-white min-h-[100px]" />
                    ))}

                    {currentDays.map((day) => {
                      const { hasPlan, hasRealization, hasAlert, alertLevel } = getDayModifiers(day, events, trees, alerts);
                      const isSelected = isSameDay(day, selectedDate);
                      const isTodayDate = isToday(day);

                      return (
                        <div
                          key={day.toISOString()}
                          onClick={() => setSelectedDate(day)}
                          className={`bg-white min-h-[100px] p-2 cursor-pointer transition-colors relative group
                            ${isSelected ? 'ring-2 ring-inset ring-emerald-500 bg-emerald-50/30' : 'hover:bg-slate-50'}
                          `}
                        >
                          <div className="flex justify-between items-start">
                            <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                              ${isTodayDate ? 'bg-emerald-600 text-white' : 'text-slate-700'}
                            `}>
                              {format(day, 'd')}
                            </span>

                            {hasAlert && (
                              <div className={`p-1 rounded-full ${alertLevel === AlertLevel.DANGER ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                }`} title="Výstraha">
                                <AlertTriangle size={12} />
                              </div>
                            )}
                          </div>

                          <div className="mt-2 space-y-1">
                            {hasPlan && (
                              <div className="flex items-center text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 truncate">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></div>
                                <span className="truncate">Plán</span>
                              </div>
                            )}
                            {hasRealization && (
                              <div className="flex items-center text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 truncate">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></div>
                                <span className="truncate">Výsadba</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Map view (history or map mode)
            <div className="h-full">
              <MapCanvas
                events={mapData.events}
                trees={mapData.trees}
                className="w-full h-full"
                onEventClick={handleEventClickFromMap}
                onTreeClick={handleTreeClick}
                onMapClick={handleMapClick}
                isPickingLocation={isPickingLocation}
                tempPinLocation={pickedLocation}
                focusLocation={focusLocation}
                onCancelPick={handleCancelPickingLocation}
              />
            </div>
          )}

          {/* Picking Location Banner */}
          {isPickingLocation && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg">
              <p className="font-bold">Klikněte do mapy pro výběr místa</p>
            </div>
          )}
        </main>

        {/* RIGHT: Sidebar */}
        <aside className="w-96 border-l border-slate-200 bg-white flex flex-col">
          {viewMode === 'map' && (
            <HistorySidebar
              events={events}
              trees={trees}
              onItemFocus={handleMapFocus}
              onItemClick={handleSidebarItemClick}
              onTreeUpdate={handleTreeUpdate}
              selectedTreeId={selectedTreeId}
              onTreeSelect={(id) => setSelectedTreeId(id)}
              onTreeClose={() => setSelectedTreeId(null)}
              selectedEventId={selectedEventId}
              onEventSelect={(id) => setSelectedEventId(id)}
              onEventClose={() => setSelectedEventId(null)}
            />
          )}

          {viewMode === 'calendar' && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800">Detail dne</h3>
                <p className="text-sm text-slate-500">{format(selectedDate, 'd. MMMM yyyy', { locale: cs })}</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                <DayDetailPanel
                  date={selectedDate}
                  events={selectedDayData.events}
                  trees={selectedDayData.trees}
                  alerts={selectedDayData.alerts}
                  currentWeather={currentWeather}
                  forecast={forecast}
                  weatherLoading={weatherLoading}
                  onFocusMap={handleMapFocus}
                  onPlanClick={handleOpenPlanModal}
                />
              </div>
            </div>
          )}
        </aside>

      </div>

      <PlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEvent}
        onPickLocation={handleStartPickingLocation}
        onSetLocation={handleSetLocation}
        initialDate={selectedDate}
        pickedLocation={pickedLocation}
        address={pickedLocationAddress}
        isGeocoding={isGeocoding}
      />

      {/* AI Chat Assistant */}
      {(() => {
        const mapContextValue = {
          viewState: focusLocation,
          pickedLocation: pickedLocation
        };
        console.warn('🏠 [App.tsx] RENDERING ChatPanel with mapContext:', JSON.stringify(mapContextValue, null, 2));
        return (
          <ChatPanel
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            onEventCreated={handleAIEventChange}
            onOpenSettings={() => setIsSettingsOpen(true)}
            mapContext={mapContextValue}
          />
        );
      })()}
      {!isChatOpen && (
        <ChatButton
          onClick={() => setIsChatOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Notification Panel */}
      <NotificationPanel
        notifications={notifications}
        unreadCount={unreadCount}
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onDismiss={dismissNotification}
      />

    </div>
  );
}
