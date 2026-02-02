import React, { useState, useEffect } from 'react';
import { EventType, CalendarEvent } from '../types';
import { X, MapPin, Calendar as CalendarIcon, Leaf, Pickaxe, Save, Navigation, Loader2 } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { buildPlanEvent } from '../services/planEvent';

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Partial<CalendarEvent>) => void;
  onPickLocation: () => void;
  onSetLocation?: (lat: number, lng: number) => void;
  initialDate?: Date;
  pickedLocation?: { lat: number; lng: number } | null;
  address?: string | null;
  isGeocoding?: boolean;
}

export const PlanModal: React.FC<PlanModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onPickLocation,
  onSetLocation,
  initialDate,
  pickedLocation,
  address,
  isGeocoding = false
}) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>(EventType.PLANTING);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // GPS hook
  const { latitude, longitude, loading: geoLoading, error: geoError, getCurrentPosition } = useGeolocation();

  // Planting specific
  const [species, setSpecies] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Maintenance specific
  const [notes, setNotes] = useState('');

  // Reset form when opening or when location is picked
  useEffect(() => {
    if (isOpen) {
      if (initialDate) {
        setDate(initialDate.toISOString().split('T')[0]);
      }
    }
  }, [isOpen, initialDate]);

  // Update location when GPS returns coordinates
  useEffect(() => {
    if (latitude && longitude && onSetLocation) {
      onSetLocation(latitude, longitude);
    }
  }, [latitude, longitude, onSetLocation]);

    const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let newEvent: Partial<CalendarEvent>;
    try {
      newEvent = buildPlanEvent({
        title,
        type,
        date,
        pickedLocation,
        address,
        notes,
        species,
        quantity
      });
    } catch (err) {
      alert('Vyberte prosim platne misto na mape.');
      return;
    }

    onSave(newEvent);
    // Reset fields
    setTitle('');
    setSpecies('');
    setQuantity(1);
    setNotes('');
  };

  const isLocationSelected = Boolean(pickedLocation);
  const canSubmit = isLocationSelected && !isGeocoding && Boolean(address);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {type === EventType.PLANTING ? <Leaf className="text-emerald-600" /> : <Pickaxe className="text-amber-600" />}
            Nová akce
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">

          {/* Type Selection */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setType(EventType.PLANTING)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${type === EventType.PLANTING
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold'
                : 'border-slate-200 hover:border-emerald-200 text-slate-600'
                }`}
            >
              Výsadba
            </button>
            <button
              type="button"
              onClick={() => setType(EventType.MAINTENANCE)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${type === EventType.MAINTENANCE
                ? 'border-amber-500 bg-amber-50 text-amber-700 font-bold'
                : 'border-slate-200 hover:border-amber-200 text-slate-600'
                }`}
            >
              Údržba
            </button>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Název akce</label>
              <input
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={type === EventType.PLANTING ? "Např. Alej svobody" : "Např. Zálivka stromů"}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Datum realizace</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Adresa / popis místa</label>
              <input
                type="text"
                value={isGeocoding ? 'Načítám adresu...' : (address || '')}
                placeholder="Adresa se doplní automaticky podle mapy"
                disabled
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-700 focus:outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Adresa se doplňuje automaticky podle zvoleného místa.</p>
            </div>
          </div>

          {/* Location Picker */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label className="block text-sm font-medium text-slate-700 mb-2">Místo konání</label>
            <div className="flex flex-col gap-3">
              <div className="text-sm text-slate-600">
                {pickedLocation ? (
                  <span className="text-emerald-600 font-mono font-medium">
                    {pickedLocation.lat.toFixed(5)}, {pickedLocation.lng.toFixed(5)}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Lokace nevybrána</span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={onPickLocation}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 shadow-sm rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                >
                  <MapPin size={16} />
                  {pickedLocation ? 'Změnit na mapě' : 'Vybrat na mapě'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    getCurrentPosition();
                  }}
                  disabled={geoLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-300 shadow-sm rounded-md text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                >
                  {geoLoading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                  {geoLoading ? 'Načítám...' : 'Moje poloha'}
                </button>
              </div>
              {geoError && (
                <p className="text-xs text-red-600">{geoError}</p>
              )}
            </div>
          </div>

          {/* Conditional Fields: Planting */}
          {type === EventType.PLANTING && (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <h3 className="font-medium text-slate-900">Co budeme sázet?</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Dřevina (Latinský název)</label>
                  <input
                    type="text"
                    value={species}
                    onChange={(e) => setSpecies(e.target.value)}
                    placeholder="Např. Tilia cordata"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Počet (ks)</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Conditional Fields: Maintenance */}
          {type === EventType.MAINTENANCE && (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Poznámka k údržbě</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Popis činnosti..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`px-6 py-2 rounded-lg font-bold text-white shadow-lg flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${type === EventType.PLANTING
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-amber-600 hover:bg-amber-700'
                }`}
            >
              <Save size={18} />
              Uložit akci
            </button>
          </div>
          {!isLocationSelected && (
            <p className="text-xs text-amber-600">Vyberte místo na mapě nebo použijte GPS.</p>
          )}
          {isGeocoding && (
            <p className="text-xs text-slate-500">Načítám adresu, prosím počkejte...</p>
          )}
        </form>

      </div>
    </div>
  );
};
