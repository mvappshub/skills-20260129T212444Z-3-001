import React, { useMemo, useState } from 'react'
import { format, isSameDay, isPast, isFuture } from 'date-fns'
import { cs } from 'date-fns/locale'
import { CalendarEvent, TreeRecord, EventType, TreePhoto } from '../types'
import { Leaf, MapPin, Calendar as CalendarIcon, ChevronDown, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react'
import { PhotoCapture } from './PhotoCapture'
import { PhotoGallery } from './PhotoGallery'
import { uploadAndSavePhoto } from '../services/storageService'

interface HistorySidebarProps {
  events: CalendarEvent[]
  trees: TreeRecord[]
  onItemFocus: (lat: number, lng: number) => void
  onItemClick?: (item: { type: 'event' | 'tree'; id: string }) => void
  onTreeUpdate?: () => void // Callback to refresh tree data after photo upload
  selectedTreeId?: string | null // Controlled from parent
  onTreeSelect?: (id: string) => void // Notify parent when tree is selected
  onTreeClose?: () => void // Notify parent when tree detail is closed
  selectedEventId?: string | null // Controlled from parent
  onEventSelect?: (id: string) => void // Notify parent when event is selected
  onEventClose?: () => void // Notify parent when event detail is closed
}

// Combine events and trees into chronological list
interface TimelineItem {
  id: string
  type: 'event' | 'tree'
  date: Date
  title: string
  subtitle: string
  lat: number
  lng: number
  isPast: boolean
  eventData?: CalendarEvent
  treeData?: TreeRecord
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  events,
  trees,
  onItemFocus,
  onItemClick,
  onTreeUpdate,
  selectedTreeId: propSelectedTreeId,
  onTreeSelect,
  onTreeClose,
  selectedEventId: propSelectedEventId,
  onEventSelect,
  onEventClose,
}) => {
  const [filter, setFilter] = useState<'all' | 'trees' | 'events'>('all')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [internalSelectedTreeId, setInternalSelectedTreeId] = useState<string | null>(null)
  const [internalSelectedEventId, setInternalSelectedEventId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Use controlled or internal state
  const selectedTreeId = propSelectedTreeId !== undefined ? propSelectedTreeId : internalSelectedTreeId
  const selectedEventId = propSelectedEventId !== undefined ? propSelectedEventId : internalSelectedEventId
  const selectedTree = trees.find(t => t.id === selectedTreeId) || null
  const selectedEvent = events.find(e => e.id === selectedEventId) || null

  // Build timeline items
  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = []

    // Add events
    events.forEach(event => {
      items.push({
        id: event.id,
        type: 'event',
        date: event.start_at,
        title: event.title,
        subtitle: event.type === EventType.PLANTING ? 'Plánována výsadba' : 'Plánována údržba',
        lat: event.lat,
        lng: event.lng,
        isPast: isPast(event.start_at),
        eventData: event,
      })
    })

    // Add trees
    trees.forEach(tree => {
      items.push({
        id: tree.id,
        type: 'tree',
        date: tree.planted_at,
        title: tree.species_name_latin,
        subtitle: 'Vysazeno',
        lat: tree.lat,
        lng: tree.lng,
        isPast: true,
        treeData: tree,
      })
    })

    // Sort by date (newest first)
    return items.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [events, trees])

  // Group by date
  const groupedItems = useMemo(() => {
    const groups: Map<string, TimelineItem[]> = new Map()

    timelineItems.forEach(item => {
      const dateKey = format(item.date, 'yyyy-MM-dd')
      if (!groups.has(dateKey)) {
        groups.set(dateKey, [])
      }
      groups.get(dateKey)!.push(item)
    })

    return groups
  }, [timelineItems])

  // Filter items
  const filteredGroups = useMemo(() => {
    if (filter === 'all') return groupedItems

    const filtered = new Map<string, TimelineItem[]>()
    groupedItems.forEach((items, dateKey) => {
      const filteredItems = items.filter(item =>
        filter === 'trees' ? item.type === 'tree' : item.type === 'event'
      )
      if (filteredItems.length > 0) {
        filtered.set(dateKey, filteredItems)
      }
    })
    return filtered
  }, [groupedItems, filter])

  const toggleGroup = (dateKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(dateKey)) {
        next.delete(dateKey)
      } else {
        next.add(dateKey)
      }
      return next
    })
  }

  const handleItemClick = (item: TimelineItem) => {
    // Focus location on map BUT stay in history view
    onItemFocus(item.lat, item.lng)

    onItemClick?.({ type: item.type, id: item.id })

    // If it's a tree, show details in sidebar
    if (item.type === 'tree') {
      onTreeSelect?.(item.id)
      onEventClose?.() // close event detail if open
    } else {
      // If it's an event/plan, show details in sidebar
      onEventSelect?.(item.id)
      onTreeClose?.() // close tree detail if open
    }
  }

  const handleBackToTimeline = () => {
    onTreeClose?.()
    onEventClose?.()
  }

  const handlePhotoCapture = async (file: File) => {
    if (!selectedTree) return

    setIsUploading(true)
    setUploadError(null)

    try {
      await uploadAndSavePhoto(file, selectedTree.id)
      // Refresh tree data - parent will update trees prop
      await onTreeUpdate?.()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Nepodařilo se nahrát fotku')
    } finally {
      setIsUploading(false)
    }
  }

  // Auto-expand first group
  React.useEffect(() => {
    if (filteredGroups.size > 0 && expandedGroups.size === 0) {
      const firstDate = Array.from(filteredGroups.keys())[0]
      setExpandedGroups(new Set([firstDate]))
    }
  }, [filteredGroups, expandedGroups.size])

  const stats = {
    totalTrees: trees.length,
    plannedEvents: events.filter(e => isFuture(e.start_at)).length,
    pastEvents: events.filter(e => isPast(e.start_at)).length,
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      {selectedTree || selectedEvent ? (
        <div className="p-4 border-b border-slate-200">
          <button
            onClick={handleBackToTimeline}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-3 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Zpět na historii</span>
          </button>
          <h2 className="text-lg font-bold text-slate-800">
            {selectedTree ? 'Detail stromu' : 'Detail plánu'}
          </h2>
        </div>
      ) : (
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-3">Historie a plán</h2>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 bg-emerald-50 rounded">
              <div className="text-xl font-bold text-emerald-600">{stats.totalTrees}</div>
              <div className="text-xs text-slate-500">Stromů</div>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded">
              <div className="text-xl font-bold text-blue-600">{stats.plannedEvents}</div>
              <div className="text-xs text-slate-500">Plánů</div>
            </div>
            <div className="text-center p-2 bg-amber-50 rounded">
              <div className="text-xl font-bold text-amber-600">{stats.pastEvents}</div>
              <div className="text-xs text-slate-500">Hotovo</div>
            </div>
          </div>

          {/* Filter buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Vše
            </button>
            <button
              onClick={() => setFilter('trees')}
              className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filter === 'trees'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Stromy
            </button>
            <button
              onClick={() => setFilter('events')}
              className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filter === 'events'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Akce
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedTree ? (
          // Tree Detail View
          <div className="p-4 space-y-6">
            {/* Tree Info */}
            <div className="bg-emerald-50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Leaf size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800">{selectedTree.species_name_latin}</h3>
                  <p className="text-sm text-slate-600">
                    Vysazeno: {format(selectedTree.planted_at, 'd. MMMM yyyy', { locale: cs })}
                  </p>
                  {selectedTree.notes && (
                    <p className="text-sm text-slate-500 mt-2">{selectedTree.notes}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Photos Section */}
            <div>
              <h4 className="font-semibold text-slate-800 mb-3">Fotogalerie ({selectedTree.photos.length})</h4>
              <PhotoGallery photos={selectedTree.photos} />
            </div>

            {/* Add Photo Section */}
            <div>
              <h4 className="font-semibold text-slate-800 mb-3">Přidat fotku</h4>
              {uploadError && (
                <div className="mb-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  {uploadError}
                </div>
              )}
              <PhotoCapture
                onCapture={handlePhotoCapture}
                isUploading={isUploading}
                disabled={isUploading}
              />
              {isUploading && (
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="animate-spin" size={16} />
                  <span>Nahrávám fotku do Supabase Storage...</span>
                </div>
              )}
            </div>
          </div>
        ) : selectedEvent ? (
          // Event/Plan Detail View
          <div className="p-4 space-y-6">
            {/* Event/Plan Info */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <CalendarIcon size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800">{selectedEvent.title}</h3>
                  <p className="text-sm text-slate-600">
                    {format(selectedEvent.start_at, 'd. MMMM yyyy', { locale: cs })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Typ: {selectedEvent.type === 'planting' ? 'Výsadba' : 'Údržba'}
                  </p>
                  {selectedEvent.notes && (
                    <p className="text-sm text-slate-600 mt-2">{selectedEvent.notes}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-800 mb-2">Lokalita</h4>
              <p className="text-sm text-slate-600">
                {selectedEvent.lat.toFixed(6)}, {selectedEvent.lng.toFixed(6)}
              </p>
              <button
                onClick={() => onItemFocus(selectedEvent.lat, selectedEvent.lng)}
                className="text-sm text-emerald-600 hover:text-emerald-700 mt-2"
              >
                Zobrazit na mapě
              </button>
            </div>

            {/* Items (if planting plan) */}
            {selectedEvent.items && selectedEvent.items.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Plánované stromy</h4>
                <div className="space-y-2">
                  {selectedEvent.items.map((item, idx) => (
                    <div key={idx} className="p-2 bg-white border border-slate-200 rounded">
                      <p className="text-sm font-medium text-slate-800">{item.species_name_latin}</p>
                      <p className="text-xs text-slate-500">Počet: {item.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Timeline View
          <div className="p-4 space-y-4">
            {Array.from(filteredGroups.entries()).map(([dateKey, items]) => {
          const isExpanded = expandedGroups.has(dateKey)
          const date = new Date(dateKey)

          return (
            <div key={dateKey} className="border border-slate-200 rounded-lg overflow-hidden">
              {/* Date header */}
              <button
                onClick={() => toggleGroup(dateKey)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <CalendarIcon size={16} className="text-slate-400" />
                  <span className="font-medium text-slate-700">
                    {format(date, 'd. MMMM yyyy', { locale: cs })}
                  </span>
                  {isToday(date) && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Dnes</span>
                  )}
                </div>
                <span className="text-xs text-slate-500">{items.length} položek</span>
              </button>

              {/* Items */}
              {isExpanded && (
                <div className="divide-y divide-slate-100">
                  {items.map(item => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleItemClick(item)}
                      className="w-full px-3 py-3 hover:bg-slate-50 flex items-start gap-3 transition-colors text-left group"
                    >
                      <div className={`p-2 rounded ${
                        item.type === 'tree'
                          ? 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200'
                          : 'bg-blue-100 text-blue-600 group-hover:bg-blue-200'
                      } transition-colors`}>
                        {item.type === 'tree' ? <Leaf size={18} /> : <CalendarIcon size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate">{item.title}</div>
                        <div className="text-sm text-slate-500">{item.subtitle}</div>
                      </div>
                      <div className="p-1.5 rounded hover:bg-slate-200 transition-colors" title="Zobrazit na mapě">
                        <MapPin size={16} className="text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {filteredGroups.size === 0 && (
          <div className="text-center py-8 text-slate-400">
            {filter === 'all' ? 'Žádné záznamy' : filter === 'trees' ? 'Žádné stromy' : 'Žádné akce'}
          </div>
        )}
        </div>
        )}
      </div>
    </div>
  )
}

function isToday(date: Date): boolean {
  const today = new Date()
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
}
