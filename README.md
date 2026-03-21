# 📼 OKIŁ VHS Player

> *Przewiń taśmę. Naciśnij PLAY. Wróć do lat 90.*

Przeglądarkowy symulator magnetowidu VHS z pełnym interfejsem retro-telewizora. Odtwarza pliki wideo z efektami degradacji taśmy w czasie rzeczywistym — śnieg, chromatic aberration, head switching noise, tracking error i dziesiątki innych artefaktów znanych z kaset VHS. Działa jako serwer lokalny w sieci LAN, więc telefonem możesz sterować odtwarzaczem przez przeglądarkę jak prawdziwym pilotem.

---

## Jak to wygląda

```
┌──────────────────────────────────────────────┐
│  OKIŁ   COLOR TV · 32"             ⚙  ⛶    │
│ ╔════════════════════════════════════════╗   │
│ ║  ░▒▓ [efekty VHS na żywo] ▓▒░        ║   │
│ ║  CH 4 · TVN · FAKTY · 19:00–19:30    ║   │
│ ╚════════════════════════════════════════╝   │
│  [▰▰▰ zandberg.mp4 ▰▰] │ PLAY │ 0:04:22    │
│  ⏮  ▶  ■  ⏸  ⏭  ⏺  ⏏  │ CH− [CH 4] CH+  │
└──────────────────────────────────────────────┘
```

---

## Funkcje

### Odtwarzacz
- Wygląd kineskopowego telewizora z ramką i magnetowidem VCR
- Drag & drop pliku wideo lub wgranie przez przycisk
- Tryby taśmy **SP / LP / EP** — każdy z inną jakością i natężeniem efektów
- Pełny transport: Play, Stop, Pause, Rewind ×10, Fast Forward ×10, Record, Eject
- Szpulki kasety animowane w czasie rzeczywistym (wielkość zależna od postępu taśmy)
- Skróty klawiszowe + obsługa gamepada (standard gamepad layout)

### Efekty VHS (canvas, per-piksel)
| Efekt | Opis |
|---|---|
| Chromatic aberration | Kanał R przesuwa się w prawo, B w lewo |
| Chroma smear | Kolory "krwawią" poziomo |
| Grain | Szum ważony luminancją — ciemne obszary mają więcej szumu |
| Line jitter | Losowe poziome przesunięcia linii (utrata synchronizacji) |
| Head switching noise | Artefakt w dolnym 4% kadru, autentyczny dla VHS |
| Dropout | Krótkie białe/czarne linie — uszkodzone miejsca na taśmie |
| Tape Warp | Falowanie pionowe obrazu w pasmach |
| Tracking error band | Jasny pasek błędu śledzenia |
| Wow/Flutter | Modulacja Web Audio API — falujący pitch jak zużyta taśma |

### Efekty CRT (CSS + SVG)
- Scanlines, winietowanie, barrel distortion (skrzywienie ekranu)
- Poświata fosforu (SVG Gaussian Blur)
- Flickering, interlacing, H-Roll, efekt magnetyzmu
- 4 typy fosforu: biały, zielony, bursztynowy, niebieski
- Temperatura barw (ciepło ↔ zimno)

### System kanałów z ramówką
- Symulacja żywej telewizji — wideo startuje od właściwego miejsca zgodnie z godziną
- Panel administracyjny (`/admin.html`) z siatką EPG (24h × n kanałów)
- Ramówka persystowana w `schedule.json`, edytowalna w czasie działania
- **Symulacja daty i czasu** — możliwość ustawienia dowolnej daty, np. Wigilia 2012
- Automatyczna zmiana programu bez odświeżania strony
- Proceduralne kanały: plansza testowa SMPTE/EBU, prognoza pogody (mapa Polski), studio wiadomości z teleprompterem i live tickerem

### Pilot mobilny
- Wejdź na `http://<ip-serwera>:3000/remote.html` z telefonu
- Pełna kontrola: kanały, transport, głośność, EPG, ustawienia
- Synchronizacja stanu przez WebSocket w czasie rzeczywistym
- Wibracja haptyczna przy każdym przycisku

---

## Uruchomienie

```bash
git clone https://github.com/Xaox01/vhs-sim.git
cd vhs-sim
npm install
node server.js
```

Serwer wypisze adresy:

```
══════════════════════════════════════════
  OKIŁ VHS Player — serwer lokalny
══════════════════════════════════════════
  Odtwarzacz:  http://localhost:3000
  Ramówka:     http://localhost:3000/admin.html
  Pilot (tel): http://192.168.1.x:3000/remote.html
══════════════════════════════════════════
```

Wrzuć pliki wideo do katalogu `video/` lub wgraj je przez panel admin.

---

## Skróty klawiszowe

| Klawisz | Akcja |
|---|---|
| `Space` | Play / Pause |
| `S` | Stop |
| `R` | Rewind |
| `F` | Fast Forward |
| `E` | Eject |
| `O` | Wgraj plik |
| `G` | Przewodnik programowy (EPG) |
| `,` | Ustawienia ekranu |
| `←` / `→` | Seek ±5s |
| `↑` / `↓` | Głośność |

---

## Stos technologiczny

- **Backend:** Node.js, `http` (bez frameworka), `ws` (WebSocket)
- **Frontend:** Vanilla JS, Canvas API, Web Audio API, WebSocket, Gamepad API
- **Efekty:** SVG filters, CSS custom properties, `ImageData` per-pixel processing

Zero zależności frontendowych. Zero bundlera. Działa w przeglądarce jak jest.

---

## Struktura projektu

```
vhs-sim/
├── server.js        ← HTTP + WebSocket server
├── index.html       ← Główny odtwarzacz (TV + VCR)
├── admin.html       ← Panel ramówki EPG
├── remote.html      ← Pilot mobilny
├── script.js        ← Cała logika frontendu (~1800 linii)
├── style.css        ← Style TV, VCR, CRT
├── schedule.json    ← Ramówka (auto-tworzona przy pierwszym uruchomieniu)
└── video/           ← Katalog na pliki wideo
```

---

*Projekt stworzony dla zabawy. Najlepiej oglądać w nocy, z herbatą, z kasetą VHS opartą o monitor.*
