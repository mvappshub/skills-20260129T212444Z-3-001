# Roadmap SilvaPlan

Tento dokument nastiňuje plán rozvoje aplikace z současného prototypu (MVP) na plně funkční produkční nástroj.

**Poslední aktualizace:** 31. ledna 2026

---

## ✅ Fáze 1: Backend a Persistence (DOKONČENO)
*Cíl: Umožnit trvalé ukládání dat a sdílení mezi uživateli.*

- [x] **Databázový design**: PostgreSQL schémata (events, trees, tree_photos)
- [x] **API Integrace**: Supabase klient implementován
- [ ] **Autentizace**: Přihlašování uživatelů (Google/Email)
- [x] **CRUD operace**: Reálná API volání pro events a trees

---

## ✅ Fáze 2: Geografické Funkce (DOKONČENO)
*Cíl: Zpřesnit lokalizaci a vizualizaci.*

- [x] **Reálná Mapa**: MapLibre GL JS (WebGL, CartoDB Positron)
- [x] **Geolokace**: GPS hook implementován (`useGeolocation.ts`)
- [ ] **Clusters**: Shlukování bodů při větším oddálení
- [ ] **Offline Mapy**: Cacheování mapových podkladů

---

## ✅ Fáze 3: Multimédia a Důkazy (DOKONČENO)
*Cíl: Zjednodušit sběr dat z terénu.*

- [x] **Kamera API**: PhotoCapture komponenta (HTML5 Capture API)
- [x] **Upload fotek**: Supabase Storage bucket `tree-photos`
- [x] **Galerie**: PhotoGallery s lightbox modalem

---

## ✅ Fáze 4: AI a Rozšířené Funkce (DOKONČENO)
*Cíl: Využití moderních technologií pro přidanou hodnotu.*

- [x] **AI Assistant**: ChatPanel s OpenRouter + Gemini support
- [x] **Smart Alerts**: MeteoAlarm + drought detection
- [ ] **Identifikace stromů**: AI rozpoznávání druhů (Gemini Vision)
- [ ] **Gamifikace**: Žebříčky sázejících, odznaky

---

## 🔄 Fáze 5: Technický Dluh a Optimalizace (PROBÍHÁ)

- [ ] **PWA Support**: Manifest a Service Worker
- [ ] **Testování**: Unit testy (Vitest) a E2E testy (Playwright)
- [ ] **Autentizace**: Row Level Security v Supabase
- [ ] **i18n**: Podpora angličtiny
- [ ] **A11y**: Audit přístupnosti

---

## Prioritizace dalších kroků

| Úkol | Priorita | Odhad |
|------|----------|-------|
| Unit testy (Vitest) | 🟡 STŘEDNÍ | 2-4h |
| Autentizace | 🟡 STŘEDNÍ | 4-8h |
| PWA manifest | 🟢 NÍZKÁ | 2-3h |
| Marker clustering | 🟢 NÍZKÁ | 2h |
