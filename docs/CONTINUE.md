# POKRAČOVÁNÍ - SilvaPlan Development

**Datum:** 30. ledna 2026
**Stav:** Refactoring UI - zjednodušení struktur

---

## ✅ DOKONČENO

- ✅ Supabase backend
- ✅ MapLibre GL mapa
- ✅ GPS geolokace
- ✅ PhotoGallery + PhotoCapture
- ✅ HistorySidebar s detaily
- ✅ Storage bucket `tree-photos`

---

## 🔄 PRÁVĚ DĚLÁM

**Refactoring UI struktur:**
- Z 3 záložek → 2 záložky (Kalendář, Mapa)
- Historie je součástí Mapy (sidebar vpravo)
- Oprava handlerů pro kliknutí na mapě

**Struktura po refactoru:**
- **Kalendář** → Kalendář vlevo + Detail dne vpravo
- **Mapa** → Mapa vlevo + HistorySidebar vpravo

**Logika kliknutí:**
- Mapa marker → Vybere + zobrazí detail v sidebaru (nepřepíná view)
- HistorySidebar položka → Vybere + zobrazí detail + focusne na mapě
- Kalendář položka → Přepne na mapu + focusne

---

## 📂 DŮLEŽITÉ SOUBORY

- `App.tsx` - hlavní logika, handlery
- `components/HistorySidebar.tsx` - timeline + detaily
- `components/MapCanvas.tsx` - mapa s markery
- `components/PhotoGallery.tsx` - galerie fotek
- `components/PhotoCapture.tsx` - upload fotek

---

## 🐛 KNOWN ISSUES

- Po refactoru kliknutí na mapě nic nedělá → OPRAVOVÁNO

---

## 🎯 DALŠÍ KROKY

Po dokončení refactoru:
1. Satelitní vrstva na mapu
2. Redesign: "Vysadit strom" vs "Naplánovat výsadbu"
3. Databáze stromů (autocomplete)
