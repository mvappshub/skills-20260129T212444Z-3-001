# Roadmap SilvaPlan

Tento dokument nastiňuje plán rozvoje aplikace z současného prototypu (MVP) na plně funkční produkční nástroj.

## Fáze 1: Backend a Persistence (Vysoká Priorita)
*Cíl: Umožnit trvalé ukládání dat a sdílení mezi uživateli.*

- [ ] **Databázový design**: Vytvořit schémata pro PostgreSQL (kopírující `types.ts`).
- [ ] **API Integrace**: Implementace Supabase nebo Firebase klienta.
- [ ] **Autentizace**: Přihlašování uživatelů (Google/Email).
- [ ] **CRUD operace**: Nahrazení `mockData` reálnými API voláními.

## Fáze 2: Geografické Funkce
*Cíl: Zpřesnit lokalizaci a vizualizaci.*

- [ ] **Reálná Mapa**: Integrace `react-leaflet` nebo Mapbox GL JS.
- [ ] **Geolokace**: Implementace tlačítka "Kde jsem" využívající GPS zařízení.
- [ ] **Clusters**: Shlukování bodů na mapě při větším oddálení.
- [ ] **Offline Mapy**: Cacheování mapových podkladů pro práci v terénu.

## Fáze 3: Multimédia a Důkazy
*Cíl: Zjednodušit sběr dat z terénu.*

- [ ] **Kamera API**: Přímé focení stromu z aplikace (HTML5 Capture API).
- [ ] **Upload fotek**: Komprese a nahrávání na Cloud Storage (např. S3/Supabase Storage).
- [ ] **Galerie**: Prohlížeč fotek s historií růstu stromu.

## Fáze 4: AI a Rozšířené Funkce
*Cíl: Využití moderních technologií pro přidanou hodnotu.*

- [ ] **Identifikace stromů**: AI rozpoznávání druhů z fotografií (Gemini Vision API).
- [ ] **Smart Alerts**: Automatické notifikace na sucho dle lokální předpovědi počasí.
- [ ] **Gamifikace**: Žebříčky sázejících, odznaky za údržbu.

## Technický Dluh a Optimalizace

- [ ] **PWA Support**: Manifest a Service Worker pro instalaci na mobil.
- [ ] **Testování**: Unit testy (Vitest) a E2E testy (Playwright).
- [ ] **i18n**: Podpora dalších jazyků (angličtina).
- [ ] **A11y**: Audit přístupnosti (ARIA labely, kontrast).
