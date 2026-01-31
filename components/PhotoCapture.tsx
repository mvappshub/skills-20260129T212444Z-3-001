import React, { useRef, useState } from 'react'
import { Camera, Upload, Loader2, X, Check } from 'lucide-react'

interface PhotoCaptureProps {
    onCapture: (file: File) => void
    onUploadComplete?: (url: string) => void
    isUploading?: boolean
    disabled?: boolean
    className?: string
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
    onCapture,
    onUploadComplete,
    isUploading = false,
    disabled = false,
    className = ''
}) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null)
        const file = e.target.files?.[0]

        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Vyberte prosím obrázek')
            return
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setError('Obrázek je příliš velký (max 10MB)')
            return
        }

        // Create preview
        const reader = new FileReader()
        reader.onloadend = () => {
            setPreview(reader.result as string)
        }
        reader.readAsDataURL(file)

        // Pass file to parent
        onCapture(file)
    }

    const handleClear = () => {
        setPreview(null)
        setError(null)
        if (inputRef.current) {
            inputRef.current.value = ''
        }
    }

    return (
        <div className={`space-y-3 ${className}`}>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleChange}
                className="hidden"
                disabled={disabled || isUploading}
            />

            {!preview ? (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={disabled || isUploading}
                    className="w-full flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 hover:border-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Camera size={32} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">
                        Vyfotit nebo nahrát obrázek
                    </span>
                    <span className="text-xs text-slate-400">
                        Klikněte nebo přetáhněte soubor
                    </span>
                </button>
            ) : (
                <div className="relative">
                    <img
                        src={preview}
                        alt="Náhled"
                        className="w-full h-48 object-cover rounded-lg"
                    />

                    {isUploading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                            <div className="flex items-center gap-2 text-white">
                                <Loader2 className="animate-spin" size={24} />
                                <span>Nahrávám...</span>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            )}

            {error && (
                <p className="text-sm text-red-600">{error}</p>
            )}
        </div>
    )
}
