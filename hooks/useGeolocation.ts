import { useState, useCallback } from 'react'

interface GeolocationState {
    latitude: number | null
    longitude: number | null
    accuracy: number | null
    error: string | null
    loading: boolean
}

export function useGeolocation() {
    const [state, setState] = useState<GeolocationState>({
        latitude: null,
        longitude: null,
        accuracy: null,
        error: null,
        loading: false,
    })

    const getCurrentPosition = useCallback(() => {
        if (!navigator.geolocation) {
            setState(prev => ({ ...prev, error: 'Geolokace není podporována vaším prohlížečem' }))
            return
        }

        setState(prev => ({ ...prev, loading: true, error: null }))

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setState({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    error: null,
                    loading: false,
                })
            },
            (error) => {
                let errorMessage = 'Nepodařilo se získat polohu'
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Přístup k poloze byl zamítnut'
                        break
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Poloha není dostupná'
                        break
                    case error.TIMEOUT:
                        errorMessage = 'Časový limit pro získání polohy vypršel'
                        break
                }
                setState(prev => ({
                    ...prev,
                    loading: false,
                    error: errorMessage,
                }))
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000,
            }
        )
    }, [])

    const reset = useCallback(() => {
        setState({
            latitude: null,
            longitude: null,
            accuracy: null,
            error: null,
            loading: false,
        })
    }, [])

    return { ...state, getCurrentPosition, reset }
}
