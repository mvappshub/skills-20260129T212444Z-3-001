// services/ai/mapContext.ts
/**
 * Bridge between React app state and AI tool handlers.
 * Provides access to current map view, picked location, and user GPS.
 */

export interface MapContextData {
    currentView: { lat: number; lng: number; zoom: number } | null;
    pickedLocation: { lat: number; lng: number } | null;
    userGPS: { lat: number; lng: number } | null;
}

class MapContextBridge {
    private context: MapContextData = {
        currentView: null,
        pickedLocation: null,
        userGPS: null
    };

    /**
     * Update context from React components
     */
    setContext(data: Partial<MapContextData>) {
        this.context = { ...this.context, ...data };
    }

    /**
     * Get current context for AI tool handlers
     */
    getContext(): MapContextData {
        return { ...this.context };
    }

    /**
     * Get best available location (picked > GPS > currentView center)
     */
    getBestLocation(): { lat: number; lng: number; source: string } | null {
        if (this.context.pickedLocation) {
            return { ...this.context.pickedLocation, source: 'picked' };
        }
        if (this.context.userGPS) {
            return { ...this.context.userGPS, source: 'gps' };
        }
        if (this.context.currentView) {
            return {
                lat: this.context.currentView.lat,
                lng: this.context.currentView.lng,
                source: 'view'
            };
        }
        return null;
    }

    /**
     * Clear picked location (after event creation)
     */
    clearPickedLocation() {
        this.context.pickedLocation = null;
    }
}

export const globalMapContext = new MapContextBridge();
