# Navod: Spustenie projektu krok za krokom (macOS)

Tento navod je urceny pre situaciu, ked Node.js este nie je nainstalovany.

## 1. Otvor Terminal

Vsetky prikazy nizsie spustaj v Terminali.

## 2. Nainstaluj Homebrew (ak ho nemas)

Overenie:

```bash
brew --version
```

Ak prikaz nefunguje, nainstaluj Homebrew:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Po instalacii zatvor a znova otvor Terminal.

## 3. Nainstaluj Node.js (LTS)

Odporucana je LTS verzia (minimalne Node 20+).

```bash
brew install node
```

Overenie instalacie:

```bash
node -v
npm -v
```

Ak vidis verzie, instalacia je OK.

## 4. Prejdi do root priecinka projektu

```bash
cd /Users/lukaspiskytel/projects/thermal-nitrava-temp/Thermal-Park-Nitrava-Temperature-Monitoring-System
```

## 5. Nainstaluj zavislosti backendu

```bash
cd backend
npm install
```

## 6. Nainstaluj zavislosti frontendu

V novom prikaze alebo po navrate do rootu:

```bash
cd ../frontend
npm install
```

## 7. (Volitelne) Nastav ASEKO API kluc a device ID

Subor je v roote projektu:

- `aseko-api-key.txt`

Format suboru:

```txt
TVOJ_ASEKO_TOKEN
zazitkovy-bazen-id=110181513
vyplavovy-bazen-id=110181534
virivka-id=110178320
detsky-bazen-id=110178006
```

Poznamka:
- Prvy riadok je token.
- Dalsie riadky su mapovanie kluc=deviceId.

## 8. Spusti backend

V prvom terminali:

```bash
cd /Users/lukaspiskytel/projects/thermal-nitrava-temp/Thermal-Park-Nitrava-Temperature-Monitoring-System/backend
npm run dev
```

Backend pobezi na:

- `http://localhost:3001`

## 9. Spusti frontend

V druhom terminali:

```bash
cd /Users/lukaspiskytel/projects/thermal-nitrava-temp/Thermal-Park-Nitrava-Temperature-Monitoring-System/frontend
npm run dev
```

Frontend standardne pobezi na:

- `http://localhost:5173`

Otvor tento link v prehliadaci.

## 10. Co overit po spusteni

1. Na hlavnej stranke vidis karty bazenov.
2. Pri kazdej karte sa zobrazuje teplota a trend.
3. Klik na kartu otvori detailnu stranku s grafom a logom.

## 11. Ukladanie dat po restarte backendu

Projekt uz ma perzistenciu stavu. To znamena, ze po restarte backendu:

- predtym fetchnute data ostanu zachovane,
- server ich nacita zo suboru pri starte,
- stare data nad 24 hodin sa archivuju do JSON zaloh.

Ukladanie prebieha do priecinka:

- `backend/data/`

## 12. Riesenie beznych problemov

### Chyba `429` z API

- Nevolaj manual refresh prilis casto.
- Automaticky fetch je nastaveny na 5 minut.
- Pockaj aspon 5 minut medzi pokusmi, ak API rate-limituje poziadavky.

### Port je obsadeny

Ak je port 3001 alebo 5173 obsadeny, zastav stary proces (`Ctrl + C`) a spusti server znova.

### Chyba `node: command not found`

Node nie je nainstalovany alebo Terminal nevidi PATH po instalacii. Zatvor a znova otvor Terminal, potom skus:

```bash
node -v
```

## 13. Produkcny build frontendu (volitelne)

```bash
cd /Users/lukaspiskytel/projects/thermal-nitrava-temp/Thermal-Park-Nitrava-Temperature-Monitoring-System/frontend
npm run build
npm run preview
```

## 14. Spustenie backendu bez nodemon (volitelne)

```bash
cd /Users/lukaspiskytel/projects/thermal-nitrava-temp/Thermal-Park-Nitrava-Temperature-Monitoring-System/backend
npm start
```
