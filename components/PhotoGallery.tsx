import React, { useState } from 'react'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { Calendar, Image as ImageIcon, X, ZoomIn } from 'lucide-react'
import { TreePhoto } from '../types'

interface PhotoGalleryProps {
    photos: TreePhoto[]
    onPhotoClick?: (photo: TreePhoto) => void
    className?: string
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
    photos,
    onPhotoClick,
    className = ''
}) => {
    const [selectedPhoto, setSelectedPhoto] = useState<TreePhoto | null>(null)

    if (photos.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center p-6 bg-slate-50 rounded-lg ${className}`}>
                <ImageIcon size={32} className="text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Zatím žádné fotky</p>
            </div>
        )
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Photo Grid */}
            <div className="grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                    <button
                        key={photo.id}
                        onClick={() => {
                            setSelectedPhoto(photo)
                            onPhotoClick?.(photo)
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg bg-slate-100 hover:ring-2 hover:ring-emerald-400 transition-all group"
                    >
                        <img
                            src={photo.url}
                            alt={photo.caption || 'Fotka stromu'}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
                        </div>
                    </button>
                ))}
            </div>

            {/* Lightbox Modal */}
            {selectedPhoto && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedPhoto(null)}
                >
                    <div
                        className="relative max-w-4xl max-h-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedPhoto(null)}
                            className="absolute -top-10 right-0 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                            title="Zavřít"
                        >
                            <X size={24} />
                        </button>

                        <img
                            src={selectedPhoto.url}
                            alt={selectedPhoto.caption || 'Fotka stromu'}
                            className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
                        />

                        {/* Photo info */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
                            {selectedPhoto.caption && (
                                <p className="text-white text-lg font-medium">{selectedPhoto.caption}</p>
                            )}
                            <div className="flex items-center gap-1 text-white/70 text-sm mt-1">
                                <Calendar size={14} />
                                {format(selectedPhoto.taken_at, 'd. MMMM yyyy HH:mm', { locale: cs })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
