# Začínáme se SilvaPlan

Tento průvodce vám pomůže zprovoznit aplikaci SilvaPlan na vašem lokálním stroji pro vývojové účely.

## Prerekvizity

Před spuštěním se ujistěte, že máte nainstalováno:
- **Node.js** (verze 18 nebo novější)
- **npm** (součást Node.js) nebo **pnpm** /**yarn**

## Instalace

1. **Naklonujte repozitář** (pokud již nemáte):
   ```bash
   git clone <url-repozitare>
   cd silvaplan---správa-výsadby
   ```

2. **Nainstalujte závislosti:**
   ```bash
   npm install
   ```
   *Poznámka: Projekt využívá React 19, TypeScript a Vite.*

3. **Konfigurace prostředí:**
   Vytvořte kopii `.env.local` (pokud neexistuje) nebo použijte přibalený vzor. Pro lokální vývoj s mock daty není nutné nastavovat reálné API klíče.
   ```bash
   # Soubor .env.local by měl obsahovat:
   GEMINI_API_KEY=PLACEHOLDER_API_KEY
   ```

## Spuštění pro vývoj

Pro spuštění lokálního vývojového serveru s Hot Module Replacement (HMR):

```bash
npm run dev
```

Aplikace bude dostupná na adrese: `http://localhost:3000`

## Build pro produkci

Pro vytvoření optimalizovaného produkčního buildu:

```bash
npm run build
```

Výsledné soubory budou ve složce `dist/`. Tyto soubory lze nahrát na jakýkoliv statický hosting (Vercel, Netlify, GitHub Pages).

## Struktura skriptů (package.json)

- `dev`: Spustí Vite dev server.
- `build`: Kompiluje TypeScript a vytvoří produkční build.
- `preview`: Spustí lokální server pro náhled vybudované aplikace (z `dist/`).

## Známá omezení (Mock Data)

V aktuální verzi (MVP) aplikace **neukládá data trvale**.
- Veškeré změny (přidané události) se ukládají pouze do paměti prohlížeče (React State) a po obnovení stránky (F5) se ztratí.
- Výchozí stav je definován v souboru `src/mockData.ts`.
- Pokud chcete trvale změnit výchozí data pro demo, upravte přímo `mockData.ts`.
