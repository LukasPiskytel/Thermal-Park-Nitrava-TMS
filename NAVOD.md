# Návod: Spustenie projektu krok za krokom (macOS)

Tento návod je určený pre prípad, keď ešte nemáš nainštalovaný Node.js.

## 1. Otvor Terminál

Všetky príkazy nižšie spúšťaj v aplikácii Terminál.

## 2. Nainštaluj Homebrew (ak ho ešte nemáš)

Over, či je Homebrew nainštalovaný:

```bash
brew --version
```

Ak príkaz nefunguje, nainštaluj Homebrew:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Po inštalácii zatvor Terminál a otvor ho znova.

## 3. Nainštaluj Node.js (LTS)

Odporúčaná je LTS verzia (minimálne Node 20+).

```bash
brew install node
```

Overenie inštalácie:

```bash
node -v
npm -v
```

Ak sa zobrazia verzie, inštalácia prebehla úspešne.

## 4. Prejdi do koreňového priečinka projektu

```bash
cd /Users/lukaspiskytel/projects/thermal-nitrava-temp/Thermal-Park-Nitrava-Temperature-Monitoring-System
```

## 5. Nainštaluj závislosti backendu

```bash
cd backend
npm install
```

## 6. Nainštaluj závislosti frontendu

```bash
cd ../frontend
npm install
```

## 7. (Voliteľné) Nastav ASEKO API token a device ID

Konfiguračný súbor je v koreňovom priečinku projektu:

- `aseko-api-key.txt`

Príklad formátu:

```txt
TVOJ_ASEKO_TOKEN
zazitkovy-bazen-id=110181513
vyplavovy-bazen-id=110181534
virivka-id=110178320
detsky-bazen-id=110178006
```

Poznámky:
- prvý riadok je token,
- ďalšie riadky sú mapovanie `kľúč=deviceId`.

## 8. Spusti backend

V prvom okne Terminálu:

```bash
cd /Users/lukaspiskytel/projects/thermal-nitrava-temp/Thermal-Park-Nitrava-Temperature-Monitoring-System/backend
npm run dev
```

Backend bude dostupný na adrese:

- `http://localhost:3001`

## 9. Spusti frontend

V druhom okne Terminálu:

```bash
cd /Users/lukaspiskytel/projects/thermal-nitrava-temp/Thermal-Park-Nitrava-Temperature-Monitoring-System/frontend
npm run dev
```

Frontend bude štandardne dostupný na adrese:

- `http://localhost:5173`

Otvor tento odkaz v prehliadači.

## 10. Čo overiť po spustení

1. Na hlavnej stránke vidíš karty bazénov.
2. Pri každej karte sa zobrazuje teplota a trend.
3. Kliknutie na kartu otvorí detailnú stránku s grafom a logom.

## 11. Ukladanie dát po reštarte backendu

Projekt už obsahuje perzistentné ukladanie stavu. Po reštarte backendu preto:

- predtým načítané dáta zostanú zachované,
- server ich pri štarte načíta zo súboru,
- dáta staršie ako 24 hodín sa archivujú do JSON záloh.

Úložisko je v priečinku:

- `backend/data/`

## 12. Riešenie bežných problémov

### Chyba `429` z API

- nepoužívaj manuálny refresh príliš často,
- automatický fetch je nastavený na 5 minút,
- pri rate limite počkaj aspoň 5 minút a skús to znova.

### Port je obsadený

Ak je port 3001 alebo 5173 obsadený, zastav starý proces (`Ctrl + C`) a server spusti znova.

### Chyba `node: command not found`

Node.js nie je nainštalovaný alebo Terminál po inštalácii nevidí `PATH`.
Zatvor Terminál, otvor ho znova a over:

```bash
node -v
```

## 13. Produkčný build frontendu (voliteľné)

```bash
cd /Users/lukaspiskytel/projects/thermal-nitrava-temp/Thermal-Park-Nitrava-Temperature-Monitoring-System/frontend
npm run build
npm run preview
```

## 14. Spustenie backendu bez nodemon (voliteľné)

```bash
cd /Users/lukaspiskytel/projects/thermal-nitrava-temp/Thermal-Park-Nitrava-Temperature-Monitoring-System/backend
npm start
```
