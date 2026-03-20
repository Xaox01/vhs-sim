// ─── OKIŁ VHS Player ──────────────────────────────────────────────────────────

const canvas  = document.getElementById('vhsCanvas');
const ctx     = canvas.getContext('2d', { willReadFrequently: true });
const videoEl = document.getElementById('videoEl');

// ── UI refs ───────────────────────────────────────────────────────────────────
const screen         = document.getElementById('screen');
const tvOffScreen    = document.getElementById('tvOffScreen');
const tvLed          = document.getElementById('tvLed');
const crtHalo        = document.getElementById('crtHalo');
const noiseLayer     = document.getElementById('noiseLayer');
const crtFlicker     = document.getElementById('crtFlicker');
const crtInterlace   = document.getElementById('crtInterlace');
const crtHRollEl     = document.getElementById('crtHRoll');
const crtBloom       = document.getElementById('crtBloom');
const osdRec         = document.getElementById('recIndicator');
const osdCh          = document.getElementById('channelLabel');
const osdTime        = document.getElementById('timestamp');
const osdMode        = document.getElementById('tapeModeLabel');
const displayMode    = document.getElementById('displayMode');
const displayTime    = document.getElementById('displayTime');
const tapeFill       = document.getElementById('tapeFill');
const tapeBar        = document.getElementById('tapeBar');
const tapePct        = document.getElementById('tapePct');
const seekTrack      = document.getElementById('seekTrack');
const seekFill       = document.getElementById('seekFill');
const seekThumb      = document.getElementById('seekThumb');
const seekCur        = document.getElementById('seekCur');
const seekDur        = document.getElementById('seekDur');
const vcrClock       = document.getElementById('vcrClock');
const vcrSlot        = document.getElementById('vcr-slot');
const slotLoaded     = document.getElementById('slotLoaded');
const slotName       = document.getElementById('slotName');
const reelL          = document.getElementById('reelL');
const reelR          = document.getElementById('reelR');
const dropOverlay    = document.getElementById('dropOverlay');
const fileInput      = document.getElementById('fileInput');
const settingsDrawer = document.getElementById('settingsDrawer');
const chDisplay      = document.getElementById('chDisplay');

const btns = {
  rew:   document.getElementById('btnRew'),
  play:  document.getElementById('btnPlay'),
  stop:  document.getElementById('btnStop'),
  pause: document.getElementById('btnPause'),
  ff:    document.getElementById('btnFF'),
  rec:   document.getElementById('btnRec'),
  eject: document.getElementById('btnEject'),
};

// ── Ustawienia ekranu ─────────────────────────────────────────────────────────
const DEFAULTS = {
  brightness: 100, contrast: 105, saturation: 115, sharpness: 30,
  curvature: 30, phosphor: 20, vignette: 55, scanlines: 40,
  flicker: false, interlace: false,
  phosphorColor: 'white',
  colorTemp: 0,
  noise: 12, chroma: 8, tracking: 97, blur: 6,
  hroll: false, magnetic: false,
  warp: 0, wowFlutter: false,
  tapeMode: 'SP',
};
let S = { ...DEFAULTS };

// Mapa: id elementu → klucz w S
const sliderMap = [
  ['sBrightness','brightness'], ['sContrast','contrast'],
  ['sSaturation','saturation'], ['sSharpness','sharpness'],
  ['sCurvature','curvature'],   ['sPhosphor','phosphor'],
  ['sVignette','vignette'],     ['sScanlines','scanlines'],
  ['sColorTemp','colorTemp'],
  ['fxNoise','noise'], ['fxChroma','chroma'],
  ['fxTracking','tracking'], ['fxBlur','blur'],
  ['fxWarp','warp'],
];
const valDisplayMap = {
  sBrightness:'sBrightnessVal', sContrast:'sContrastVal',
  sSaturation:'sSaturationVal', sSharpness:'sSharpnessVal',
  sCurvature:'sCurvatureVal',   sPhosphor:'sPhosphorVal',
  sVignette:'sVignetteVal',     sScanlines:'sScanlinesVal',
  sColorTemp:'sColorTempVal',
  fxNoise:'fxNoiseVal', fxChroma:'fxChromaVal',
  fxTracking:'fxTrackingVal', fxBlur:'fxBlurVal',
  fxWarp:'fxWarpVal',
};

sliderMap.forEach(([id, key]) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = S[key];
  if (valDisplayMap[id]) document.getElementById(valDisplayMap[id]).textContent = el.value;
  el.addEventListener('input', () => {
    S[key] = parseFloat(el.value);
    if (valDisplayMap[id]) document.getElementById(valDisplayMap[id]).textContent = Math.round(S[key]);
    applyScreenSettings();
  });
});

// Toggle buttons
['sFlicker','sInterlace','sHRoll','sMagnetic','sWowFlutter'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', () => {
    const on = el.dataset.on === 'true';
    el.dataset.on = (!on).toString();
    el.textContent = on ? 'OFF' : 'ON';
    const keyMap = { sFlicker:'flicker', sInterlace:'interlace', sHRoll:'hroll', sMagnetic:'magnetic', sWowFlutter:'wowFlutter' };
    S[keyMap[id]] = !on;
    applyScreenSettings();
  });
});

// Fosfor
document.querySelectorAll('.phos-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.phos-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.phosphorColor = btn.dataset.phos;
    applyScreenSettings();
  });
});

// Tape mode
document.querySelectorAll('.tape-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tape-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.tapeMode = btn.dataset.mode;
    osdMode.textContent = S.tapeMode;
    osdTime.textContent = `${S.tapeMode} ${fmt(videoEl.currentTime||0)}`;
  });
});

// Symulacja czasu
function updateSimTimeDisplay() {
  const info = document.getElementById('sSimTimeInfo');
  const disp = document.getElementById('sSimTimeDisplay');
  if (simTimeOffset === 0) { info.style.display = 'none'; return; }
  const n = simulatedNow();
  disp.textContent = `${n.getHours().toString().padStart(2,'0')}:${n.getMinutes().toString().padStart(2,'0')}:${n.getSeconds().toString().padStart(2,'0')}`;
  info.style.display = '';
}
setInterval(updateSimTimeDisplay, 1000);

document.getElementById('sSimTimeSet').addEventListener('click', () => {
  const val = document.getElementById('sSimTime').value;
  if (!val) return;
  const [h, m] = val.split(':').map(Number);
  const real = new Date();
  const targetSecs  = h * 3600 + m * 60;
  const currentSecs = real.getHours() * 3600 + real.getMinutes() * 60 + real.getSeconds();
  simTimeOffset = targetSecs - currentSecs;
  updateSimTimeDisplay();
  updateCh();
});

document.getElementById('sSimTimeReset').addEventListener('click', () => {
  simTimeOffset = 0;
  document.getElementById('sSimTime').value = '';
  updateSimTimeDisplay();
  updateCh();
});

// Reset
document.getElementById('sReset').addEventListener('click', () => {
  S = { ...DEFAULTS };
  sliderMap.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) { el.value = S[key]; }
    if (valDisplayMap[id]) document.getElementById(valDisplayMap[id]).textContent = Math.round(S[key]);
  });
  ['sFlicker','sInterlace','sHRoll','sMagnetic','sWowFlutter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.dataset.on = 'false'; el.textContent = 'OFF'; }
  });
  document.querySelectorAll('.phos-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.phos === 'white');
  });
  document.querySelectorAll('.tape-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === 'SP');
  });
  applyScreenSettings();
});

// Jakość trybów taśmy — mnożniki efektów VHS
const TAPE_QUALITY = {
  SP: { noiseMult: 1.0, chromaMult: 1.0, trackingMult: 1.0, blurMult: 1.0, warpMult: 1.0 },
  LP: { noiseMult: 1.6, chromaMult: 1.4, trackingMult: 0.88, blurMult: 1.4, warpMult: 1.5 },
  EP: { noiseMult: 2.8, chromaMult: 2.4, trackingMult: 0.65, blurMult: 2.3, warpMult: 2.8 },
};

// ── Audio Wow/Flutter ─────────────────────────────────────────────────────────
let audioCtx = null;
let delayNode = null;

function ensureAudio() {
  if (audioCtx) { audioCtx.state === 'suspended' && audioCtx.resume(); return; }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaElementSource(videoEl);
    delayNode = audioCtx.createDelay(1.0);
    delayNode.delayTime.value = 0.01;
    src.connect(delayNode);
    delayNode.connect(audioCtx.destination);
  } catch(e) { console.warn('AudioContext failed:', e); }
}

// Kolory fosforu
const PHOSPHOR_COLORS = {
  white:  '1.05 0 0 0 0  0 1.02 0 0 0  0 0 0.92 0 0  0 0 0 1 0',
  green:  '0 0.3 0 0 0   0 1.2  0 0 0  0 0.1 0   0 0  0 0 0 1 0',
  amber:  '1.3  0.6 0 0 0  0.3 0.4 0 0 0  0 0   0 0 0  0 0 0 1 0',
  blue:   '0.4  0.6 1.4 0 0  0.2  0.7 1.0 0 0  0.5 0.8 1.6 0 0  0 0 0 1 0',
};

function applyScreenSettings() {
  const root = document.documentElement.style;

  // CSS vars
  root.setProperty('--scanline-opacity',  (S.scanlines / 100 * 0.28).toFixed(3));
  root.setProperty('--vignette-strength', (S.vignette  / 100 * 0.75).toFixed(3));
  root.setProperty('--curvature',         (S.curvature / 100 * 24).toFixed(1) + 'px');
  root.setProperty('--flicker-opacity',   S.flicker ? '0.04' : '0');

  // Interlace
  root.setProperty('--interlace-opacity', S.interlace ? '0.55' : '0');

  // Flicker class
  crtFlicker.classList.toggle('on', S.flicker);

  // H-Roll
  hrollActive = S.hroll;

  // Magnetic
  crtMagneticActive = S.magnetic;

  // Canvas CSS filter (brightness, contrast, saturation)
  canvas.style.filter = [
    `url(#crt)`,
    `brightness(${S.brightness / 100})`,
    `contrast(${S.contrast / 100})`,
    `saturate(${S.saturation / 100})`,
    S.sharpness > 0 ? `contrast(${1 + S.sharpness/200})` : '',
  ].join(' ');

  // SVG filter: color matrix (fosfor + color temp)
  const baseMatrix = PHOSPHOR_COLORS[S.phosphorColor] || PHOSPHOR_COLORS.white;
  document.getElementById('fltColorMatrix').setAttribute('values', applyColorTemp(baseMatrix, S.colorTemp));

  // Phosphor glow
  const phStd = (S.phosphor / 100 * 1.2).toFixed(2);
  document.getElementById('fltPhosphor').setAttribute('stdDeviation', phStd);

  // CRT halo color
  if (S.phosphorColor === 'green')  crtHalo.style.boxShadow = crtHalo.classList.contains('on') ? '0 0 50px 4px rgba(0,220,80,.2)' : '';
  else if (S.phosphorColor === 'amber') crtHalo.style.boxShadow = crtHalo.classList.contains('on') ? '0 0 50px 4px rgba(255,140,0,.18)' : '';
  else if (S.phosphorColor === 'blue')  crtHalo.style.boxShadow = crtHalo.classList.contains('on') ? '0 0 50px 4px rgba(80,150,255,.18)' : '';
  else crtHalo.style.boxShadow = '';
}

function applyColorTemp(matrix, temp) {
  // Temperatura: -100=ciepło(+R-B), +100=zimno(-R+B)
  const vals = matrix.split(/\s+/).map(Number);
  const r = 1 - temp / 400;   // R
  const b = 1 + temp / 400;   // B
  vals[0]  *= r;
  vals[10] *= b;
  return vals.join(' ');
}

// ── State ─────────────────────────────────────────────────────────────────────
const ST = { STOP:'STOP', PLAY:'PLAY', PAUSE:'PAUSE', REW:'REW', FF:'FF >>', REC:'REC' };
let state        = ST.STOP;
let tapeInserted = false;
let hasVideo     = false;
let channel      = 3;
let reelAngle    = 0;
let lastTime     = 0;
let sceneTime    = 0;
let prevFrame    = null;
let frameCount   = 0;
let hrollActive      = false;
let crtMagneticActive= false;
let hrollOffset  = 0;
let magneticHue  = 0;

applyScreenSettings();

// ── Ghost canvas ──────────────────────────────────────────────────────────────
const ghost    = document.createElement('canvas');
const ghostCtx = ghost.getContext('2d');

function resize() {
  canvas.width  = screen.offsetWidth  || 800;
  canvas.height = screen.offsetHeight || 600;
  ghost.width   = canvas.width;
  ghost.height  = canvas.height;
}
resize();
new ResizeObserver(resize).observe(screen);

// ── Ustawienia drawer ─────────────────────────────────────────────────────────
function openSettings()  { settingsDrawer.classList.add('open'); }
function closeSettings() { settingsDrawer.classList.remove('open'); }
function toggleSettings() { settingsDrawer.classList.toggle('open'); }

['settingsBtn','settingsBtnVcr','floatSettingsBtn'].forEach(id =>
  document.getElementById(id).addEventListener('click', e => { e.stopPropagation(); toggleSettings(); })
);
document.getElementById('settingsClose').addEventListener('click', closeSettings);
document.addEventListener('click', e => {
  if (settingsDrawer.classList.contains('open') && !settingsDrawer.contains(e.target)) closeSettings();
});

// ── Plik wideo ────────────────────────────────────────────────────────────────
const VIDEO_EXTS = /\.(mp4|webm|mov|avi|mkv|m4v|ogv|flv|wmv|ts|m2ts|3gp)$/i;
function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith('video/') && !VIDEO_EXTS.test(file.name)) return;
  if (videoEl.src) URL.revokeObjectURL(videoEl.src);
  videoEl.src    = URL.createObjectURL(file);
  videoEl.volume = 0.85;
  videoEl.load();
  hasVideo = true;
  const name = file.name.replace(/\.[^.]+$/, '').toUpperCase().slice(0, 20);
  slotName.textContent = name;
  hideDropOverlay();
  if (!tapeInserted) insertTape();
}

// Drag & drop
document.addEventListener('dragover', e => { e.preventDefault(); showDropOverlay(); dropOverlay.classList.add('drag-over'); });
document.addEventListener('dragleave', e => { if (!dropOverlay.contains(e.relatedTarget)) { dropOverlay.classList.remove('drag-over'); if (!dropOverlay._co) hideDropOverlay(); } });
document.addEventListener('drop', e => { e.preventDefault(); dropOverlay.classList.remove('drag-over'); loadFile(e.dataTransfer.files[0]); });
function openFilePicker() {
  fileInput.style.display = 'block';
  fileInput.addEventListener('change', onFileChosen, { once: true });
  fileInput.addEventListener('cancel',  onFileCancel, { once: true });
  // fallback: jeśli focus wróci bez wyboru pliku, chowamy input
  window.addEventListener('focus', onWindowFocus, { once: true });
}
function onFileChosen() {
  fileInput.style.display = 'none';
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
  fileInput.value = '';
}
function onFileCancel() { fileInput.style.display = 'none'; }
function onWindowFocus() { setTimeout(() => { fileInput.style.display = 'none'; }, 300); }

document.getElementById('loadBtn').addEventListener('click',    openFilePicker);
dropOverlay.addEventListener('click', e => { if (e.target === dropOverlay) hideDropOverlay(); });
dropOverlay.querySelector('.drop-box').addEventListener('click', openFilePicker);

function showDropOverlay() { dropOverlay.classList.add('active'); dropOverlay._co = true; }
function hideDropOverlay() { dropOverlay.classList.remove('active','drag-over'); dropOverlay._co = false; }

// ── Kaseta ────────────────────────────────────────────────────────────────────
function insertTape() {
  if (tapeInserted) return;
  tapeInserted = true;
  slotLoaded.classList.add('show');
  displayMode.textContent = '---';
  // Krótki błysk LED przy włączeniu
  setTimeout(() => {
    tvLed.classList.add('on');
    // Biały błysk ekranu — jak włączenie kineskopowego TV
    tvOffScreen.style.background = '#fff';
    tvOffScreen.style.opacity = '0.9';
    setTimeout(() => {
      tvOffScreen.style.background = '#000';
      tvOffScreen.style.opacity = '0.6';
      crtHalo.classList.add('on');
      displayMode.textContent = 'LOAD';
      setTimeout(() => {
        tvOffScreen.style.opacity = '0';
        setTimeout(() => {
          tvOffScreen.style.display = 'none';
          // Nie resetuj jeśli kanał już zaczął odtwarzanie (schedule auto-play)
          if (state !== ST.PLAY && state !== ST.REC) setState(ST.STOP);
        }, 400);
      }, 600);
    }, 80);
  }, 350);
}

function ejectTape() {
  if (!tapeInserted) return;
  setState(ST.STOP);
  slotLoaded.classList.remove('show');
  channelActive = false;
  setTimeout(() => {
    tapeInserted = false; hasVideo = false;
    tvOffScreen.style.display = 'flex';
    tvOffScreen.style.opacity = '1';
    tvLed.classList.remove('on');
    crtHalo.classList.remove('on');
    screen.classList.remove('playing');
    const dot = tvOffScreen.querySelector('.tv-off-dot');
    dot.style.animation='none'; dot.offsetHeight; dot.style.animation='';
  }, 300);
}

vcrSlot.addEventListener('click', () => { if (!tapeInserted) openFilePicker(); });

// ── Seek ──────────────────────────────────────────────────────────────────────
let seeking = false;

// ── Kanały ────────────────────────────────────────────────────────────────────
const CHANNELS = {
  1: { src:  'video/YTDown.com_YouTube_Stare-Reklamy-Telewizyjne-31_Media_ye_3ItiEykM_003_480p.mp4',
       name: 'TVX 1', program: 'Stare Reklamy' },
  2: { draw: 'colorBars', name: 'TVX 2', program: 'Plansza Techniczna' },
  5: { draw: 'weather',   name: 'TVX METEO', program: 'Prognoza Pogody' },
  7: { draw: 'news',      name: 'TVX INFO',  program: 'Wiadomości' },
};

// ── Ramówka ───────────────────────────────────────────────────────────────────
let scheduleData = { channels: [], entries: [] };

function schedMins(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ── Symulacja czasu ───────────────────────────────────────────────────────────
let simTimeOffset = 0; // sekundy przesunięcia względem czasu rzeczywistego
function simulatedNow() { return new Date(Date.now() + simTimeOffset * 1000); }

function getSimulatedDow() {
  // Jeśli ustawiona data symulacji, użyj jej dnia tygodnia zamiast realnego
  if (scheduleData.simulationDate) {
    const [y, m, d] = scheduleData.simulationDate.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  }
  return new Date().getDay();
}

function getCurrentEntry(channelId) {
  const now  = simulatedNow();
  const mins = now.getHours() * 60 + now.getMinutes();
  const dow  = getSimulatedDow();
  return scheduleData.entries.find(e =>
    e.channelId === channelId &&
    (!Array.isArray(e.days) || e.days.length === 0 || e.days.includes(dow)) &&
    schedMins(e.startTime) <= mins &&
    schedMins(e.endTime)   >  mins
  ) || null;
}

function schedChannelCount() {
  return scheduleData.channels.length || 12;
}

async function loadSchedule() {
  if (location.protocol === 'file:') return;
  try { scheduleData = await fetch('/api/schedule').then(r => r.json()); }
  catch(e) { /* serwer niedostępny, fallback na CHANNELS */ }
  updateCh();
}

const channelFrame = document.getElementById('channelFrame');
let channelActive = false;
let channelDraw   = null;   // nazwa funkcji rysującej kanał proceduralny
let chSwitching   = 0;      // licznik klatek śniegu przy zmianie kanału
let chSwitchMax   = 38;

document.getElementById('chUp').addEventListener('click', () => { channel = channel >= schedChannelCount() ? 1 : channel + 1; updateCh(); });
document.getElementById('chDn').addEventListener('click', () => { channel = channel <= 1 ? schedChannelCount() : channel - 1; updateCh(); });

function updateCh() {
  osdCh.textContent     = `CH ${channel}`;
  chDisplay.textContent = `CH ${channel}`;

  // Zatrzymaj poprzednie
  videoEl.pause();
  videoEl.src  = '';
  videoEl.loop = false;
  hasVideo      = false;
  channelDraw   = null;
  channelActive = false;
  chSwitching   = 38;  // ~630ms śniegu przy zmianie kanału
  chSwitchMax   = 38;

  // Sprawdź ramówkę
  const schedCh = scheduleData.channels.find(c => c.id === channel);
  if (schedCh) {
    const entry = getCurrentEntry(channel);
    _lastEntryId = entry?.id ?? null;
    const entryTitle = entry?.title || (entry?.videoFile ? entry.videoFile.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '') : '') || 'Brak programu';
    showChBanner(channel, { name: schedCh.name, program: entryTitle, color: schedCh.color, logo: schedCh.logo || '' }, entry);
    if (!tapeInserted) insertTape();
    slotName.textContent = schedCh.name;

    if (entry?.videoFile) {
      setTimeout(() => {
        videoEl.src    = entry.videoFile;
        videoEl.loop   = false;
        videoEl.volume = 0.85;
        videoEl.load();
        hasVideo      = true;
        channelActive = true;
        videoEl.addEventListener('canplay', () => {
          const now       = simulatedNow();
          const nowSecs   = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
          const offsetSec = nowSecs - schedMins(entry.startTime) * 60;
          if (offsetSec > 0 && isFinite(videoEl.duration) && offsetSec < videoEl.duration) {
            videoEl.currentTime = offsetSec;
          }
          setState(ST.PLAY);
        }, { once: true });
      }, 380);
    } else {
      // Kanał istnieje ale brak programu o tej godzinie → plansza testowa
      setTimeout(() => {
        channelDraw   = 'colorBars';
        channelActive = true;
        if (state !== ST.PLAY) setState(ST.PLAY);
      }, 380);
    }
    return;
  }

  // Fallback: hardcoded CHANNELS
  const ch = CHANNELS[channel];
  showChBanner(channel, ch);
  if (!ch) return;
  if (!tapeInserted) insertTape();
  slotName.textContent = ch.name;

  setTimeout(() => {
    if (ch.src) {
      videoEl.src    = ch.src;
      videoEl.loop   = true;
      videoEl.volume = 0.85;
      videoEl.load();
      hasVideo = true;
      channelActive = true;
      videoEl.addEventListener('canplay', () => setState(ST.PLAY), { once: true });
    } else if (ch.draw) {
      channelDraw   = ch.draw;
      channelActive = true;
      if (state === ST.STOP) setState(ST.PLAY);
    }
  }, 380);
}

// ── Fullscreen ────────────────────────────────────────────────────────────────
document.getElementById('fullscreenBtn').addEventListener('click', toggleFS);
document.addEventListener('keydown', e => { if(e.key==='F11'){e.preventDefault();toggleFS();} });
function toggleFS() { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); }

// ── Pętla główna ──────────────────────────────────────────────────────────────
function loop(ts) {
  const dt = Math.min((ts - lastTime)/1000, 0.1);
  lastTime = ts;
  pollGamepad();
  update(dt);
  renderFrame(dt);
  requestAnimationFrame(loop);
}

function update(dt) {
  if (!tapeInserted) return;
  if (state===ST.REW && hasVideo) {
    videoEl.currentTime = Math.max(0, videoEl.currentTime - dt*10);
    if (videoEl.currentTime<=0) setState(ST.STOP);
  } else if (state===ST.FF && hasVideo) {
    videoEl.currentTime = Math.min(videoEl.duration||0, videoEl.currentTime + dt*10);
    if (videoEl.currentTime>=(videoEl.duration||0)) setState(ST.STOP);
  }

  const moving = [ST.PLAY, ST.REC, ST.REW, ST.FF].includes(state);
  if (moving) reelAngle += ([ST.REW,ST.FF].includes(state) ? 10 : 2.5) * dt * 60;

  // H-Roll animacja
  if (hrollActive) {
    hrollOffset = Math.sin(Date.now()*0.0008) * 6 + Math.sin(Date.now()*0.003)*2;
    document.documentElement.style.setProperty('--hroll-offset', hrollOffset.toFixed(1)+'px');
  } else {
    document.documentElement.style.setProperty('--hroll-offset','0px');
  }

  // Magnetyzm
  if (crtMagneticActive) {
    magneticHue = Math.sin(Date.now()*0.001)*25;
    document.documentElement.style.setProperty('--magnetic-hue', magneticHue.toFixed(1)+'deg');
  } else {
    document.documentElement.style.setProperty('--magnetic-hue','0deg');
  }

  // Wow/Flutter audio — modulacja czasu opóźnienia = falujący pitch
  if (delayNode && audioCtx) {
    const t = Date.now() * 0.001;
    if (S.wowFlutter && [ST.PLAY, ST.REC].includes(state)) {
      const wow     = Math.sin(t * 0.55) * 0.014 + Math.sin(t * 1.1) * 0.004;
      const flutter = Math.sin(t * 9.5)  * 0.003 + Math.sin(t * 13.7) * 0.0015;
      delayNode.delayTime.setTargetAtTime(Math.max(0.001, 0.01 + wow + flutter), audioCtx.currentTime, 0.01);
    } else {
      delayNode.delayTime.setTargetAtTime(0.01, audioCtx.currentTime, 0.08);
    }
  }

  // Subtelny poziomy sync wobble — jak niestabilna synchronizacja kineskopowa
  if (tapeInserted && state !== ST.STOP) {
    const wobble = Math.sin(Date.now()*0.00043)*0.4 + Math.sin(Date.now()*0.00091)*0.15;
    canvas.style.transform = `translateX(${wobble.toFixed(2)}px)`;
  } else {
    canvas.style.transform = '';
  }

}

function renderFrame(dt) {
  frameCount++;
  const W = canvas.width, H = canvas.height;

  if (!tapeInserted || state===ST.STOP) {
    drawNoise(W,H);
  } else if (chSwitching > 0) {
    const phase = 1 - chSwitching / chSwitchMax;
    chSwitching--;
    drawChSnow(W, H, phase);
  } else if (state===ST.PAUSE) {
    drawPause(W,H);
  } else if (state===ST.REW || state===ST.FF) {
    drawRewind(W,H);
  } else {
    if (channelDraw && CHANNEL_DRAWS[channelDraw]) {
      sceneTime += dt;
      CHANNEL_DRAWS[channelDraw](W, H, sceneTime);
    } else if (hasVideo && videoEl.readyState>=2) {
      ctx.drawImage(videoEl,0,0,W,H);
    } else {
      sceneTime+=dt; drawScene(W,H);
    }
    if (S.warp > 0 && frameCount % 2 === 0) applyTapeWarp(W,H);
    if (frameCount % 2 === 0) applyVHS(W,H);
    if (frameCount % 3 === 0) prevFrame = ctx.getImageData(0,0,W,H);
  }

  // Progress
  const dur  = hasVideo&&videoEl.duration ? videoEl.duration : 0;
  const cur  = hasVideo ? videoEl.currentTime||0 : 0;
  const prog = dur ? cur/dur : 0;
  const pct  = (prog*100).toFixed(1);
  tapeFill.style.width = seekFill.style.width = pct+'%';
  seekThumb.style.left = pct+'%';
  tapePct.textContent  = Math.round(prog*100)+'%';
  seekCur.textContent  = fmt(cur);
  seekDur.textContent  = fmt(dur);
  displayTime.textContent = fmt(cur);
  osdTime.textContent  = `${S.tapeMode} ${fmt(cur)}`;

  // Noise
  noiseLayer.style.opacity = (!tapeInserted||state===ST.STOP)?'0.5':
    [ST.REW,ST.FF].includes(state)?'0.28':'0';

  // Szpulki
  const ls = 12+(1-prog)*12, rs = 12+prog*12;
  const lA = state===ST.FF  ? reelAngle*.12 : reelAngle;
  const rA = state===ST.REW ? reelAngle*.12 : reelAngle;
  reelL.style.cssText=`width:${ls}px;height:${ls}px;transform:rotate(${lA}deg)`;
  reelR.style.cssText=`width:${rs}px;height:${rs}px;transform:rotate(${rA}deg)`;
}

// ── VHS efekty na canvasie ────────────────────────────────────────────────────
function applyTapeWarp(W,H) {
  const tq = TAPE_QUALITY[S.tapeMode] || TAPE_QUALITY.SP;
  const warpAmt = (S.warp / 100) * 5 * tq.warpMult;
  if (warpAmt < 0.1) return;
  ghostCtx.clearRect(0,0,W,H);
  ghostCtx.drawImage(canvas,0,0);
  ctx.clearRect(0,0,W,H);
  const t = Date.now() * 0.001;
  const strips = 64;
  const sw = Math.ceil(W / strips);
  for (let i = 0; i < strips; i++) {
    const x = i * sw;
    const yOff = Math.sin(x * 0.016 + t * 1.3) * warpAmt
               + Math.sin(x * 0.041 + t * 0.72) * warpAmt * 0.38;
    ctx.drawImage(ghost, x, 0, sw, H, x, yOff, sw, H);
  }
}

function applyVHS(W,H) {
  let img = ctx.getImageData(0,0,W,H);
  const d = img.data;
  const tq = TAPE_QUALITY[S.tapeMode] || TAPE_QUALITY.SP;
  const fx = {
    noise:    Math.min(1, S.noise/100    * tq.noiseMult),
    chroma:   Math.min(1, S.chroma/100   * tq.chromaMult),
    tracking: Math.max(0, S.tracking/100 * tq.trackingMult),
    blur:     Math.min(1, S.blur/100     * tq.blurMult),
  };
  const bad = 1 - fx.tracking;

  // Chromatic aberration — R przesuwa prawo, B przesuwa lewo
  const abR = Math.round(fx.chroma * 11);
  const abB = Math.round(fx.chroma * 5);
  if (abR > 0) {
    for (let y=0;y<H;y++) {
      for (let x=W-1;x>=0;x--) {
        const dst = (y*W+x)*4;
        // R przesuwa w prawo
        const srcR = (y*W + Math.max(0, x-abR))*4;
        d[dst] = d[srcR];
        // B przesuwa w lewo
        const srcB = (y*W + Math.min(W-1, x+abB))*4;
        d[dst+2] = d[srcB+2];
      }
    }
  }

  // Chroma smear — kolory krwawią w prawo bardziej niż jasność
  const smear = Math.round(fx.chroma * 6);
  if (smear > 0) {
    for (let y=0;y<H;y++) {
      for (let x=W-1;x>=smear;x--) {
        const dst=(y*W+x)*4, prev=(y*W+x-smear)*4;
        d[dst]   = (d[dst]   * 0.75 + d[prev]   * 0.25)|0;
        d[dst+2] = (d[dst+2] * 0.70 + d[prev+2] * 0.30)|0;
      }
    }
  }

  // Grain ważony luminancją — szum bardziej widoczny w ciemnych obszarach (jak VHS)
  const gr = fx.noise * 42;
  if (gr > 1) {
    for (let i=0;i<d.length;i+=4) {
      const luma = (d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114) / 255;
      const weight = 1.4 - luma * 0.9; // ciemne piksele = więcej szumu
      const n = (Math.random()-0.5) * gr * weight;
      // Lekki kolorowy szum (jak chrominancja VHS)
      const nc = (Math.random()-0.5) * gr * 0.3;
      d[i]   = clamp(d[i]   + n + nc);
      d[i+1] = clamp(d[i+1] + n);
      d[i+2] = clamp(d[i+2] + n - nc * 0.5);
    }
  }

  // Line jitter — poziomy sync jitter
  const shifts = Math.round(bad * 12);
  for (let n=0;n<shifts;n++) {
    const y = Math.random()*H|0;
    const sh = ((Math.random()-0.5)*bad*30)|0;
    if (!sh) continue;
    const row = d.slice(y*W*4,(y+1)*W*4);
    for (let x=0;x<W;x++) {
      const s=((x+sh+W)%W)*4, dst=(y*W+x)*4;
      d[dst]=row[s]; d[dst+1]=row[s+1]; d[dst+2]=row[s+2];
    }
  }

  // Head switching noise — dolny pasek (autentyczny artefakt VHS głowicy)
  const headZone = Math.floor(H * 0.96);
  for (let y=headZone;y<H;y++) {
    const intensity = (y-headZone)/(H-headZone);
    const sh = ((Math.sin(Date.now()*0.03 + y)*bad*18 + (Math.random()-0.5)*bad*12)*intensity)|0;
    if (Math.abs(sh) < 1) continue;
    const row = d.slice(y*W*4,(y+1)*W*4);
    for (let x=0;x<W;x++) {
      const s=((x+sh+W)%W)*4, dst=(y*W+x)*4;
      d[dst]=row[s]; d[dst+1]=row[s+1]; d[dst+2]=row[s+2];
      // Dodatkowe przebarwienie w strefie głowicy
      d[dst] = clamp(d[dst] + intensity*30*(Math.random()-0.3));
      d[dst+2] = clamp(d[dst+2] - intensity*20);
    }
  }

  // Dropout — losowe krótkie linie (uszkodzone miejsca na taśmie)
  const dropouts = Math.round(fx.noise * 3 + bad * 5);
  for (let n=0;n<dropouts;n++) {
    if (Math.random() > 0.3) continue;
    const dy = Math.random()*H|0;
    const dx = Math.random()*W|0;
    const dw = (5 + Math.random()*40)|0;
    const bright = Math.random() > 0.5;
    for (let x=dx;x<Math.min(dx+dw,W);x++) {
      const i=(dy*W+x)*4;
      const v = bright ? 200+Math.random()*55 : Math.random()*30;
      d[i]=d[i+1]=d[i+2]=v|0;
    }
  }

  ctx.putImageData(img,0,0);

  // Soft blur — rozmycie poziome (VHS ma ograniczone pasmo)
  const bl = fx.blur * 3.0;
  if (bl > 0.2) {
    ghostCtx.clearRect(0,0,W,H);
    ghostCtx.drawImage(canvas,0,0);
    ctx.globalAlpha = 0.07; ctx.filter = `blur(${bl}px)`;
    ctx.drawImage(ghost, 1.5, 0);
    ctx.globalAlpha = 1; ctx.filter = 'none';
  }

  // Tracking error band — szeroki pasek błędu śledzenia
  if (bad > 0.05 && Math.random() < bad * 0.5) {
    const ey = Math.random()*H*0.9;
    const eh = 2 + Math.random()*22;
    const alpha = (0.04 + Math.random()*0.12*bad).toFixed(3);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(0, ey, W, eh);
    // Kolorowy edge na pasku
    ctx.fillStyle = `rgba(180,0,255,${(parseFloat(alpha)*0.5).toFixed(3)})`;
    ctx.fillRect(0, ey+eh, W, 1);
  }

  // Ciepły odcień fosforu — lekki żółto-amber jak stary TV
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(255,200,100,.028)';
  ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation = 'source-over';
}

function clamp(v) { return v<0?0:v>255?255:v|0; }

// ── Śnieg przy zmianie kanału ─────────────────────────────────────────────────
function drawChSnow(W, H, t) {
  // t: 0 = właśnie przełączono, 1 = koniec efektu

  // Faza 1 (0–0.1): biały błysk
  if (t < 0.1) {
    const alpha = 1 - t / 0.1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(220,220,220,${(alpha * 0.4).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  // Faza 2 (0.1–1): śnieg malejący + utrata synchronizacji poziomej
  const noise  = Math.pow(1 - Math.min(1, (t - 0.1) / 0.75), 1.4); // 1→0
  const bright = 20 + noise * 235;

  const img = ctx.createImageData(W, H);
  const d   = img.data;

  for (let y = 0; y < H; y++) {
    // Przesunięcie linii — typowa utrata sync poziomej
    const syncLoss = noise > 0.25
      ? Math.sin(y * 0.25 + t * 18) * noise * 38 + (Math.random() - 0.5) * noise * 24
      : 0;
    const shi = Math.round(syncLoss);

    for (let x = 0; x < W; x++) {
      const sx = ((x + shi) % W + W) % W;
      const i  = (y * W + sx) * 4;
      const v  = Math.random() * bright | 0;
      // Lekko kolorowy szum (chrominancja)
      d[i]   = clamp(v + (Math.random() * noise * 60 | 0));
      d[i+1] = clamp(v);
      d[i+2] = clamp(v + (Math.random() * noise * 80 | 0));
      d[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Jasne poziome paski (head-switch artefakt)
  const strips = Math.round(noise * 6);
  for (let s = 0; s < strips; s++) {
    const by = Math.random() * H;
    ctx.fillStyle = `rgba(255,255,255,${(noise * 0.55 * Math.random()).toFixed(3)})`;
    ctx.fillRect(0, by, W, 1 + Math.random() * 5);
  }

  // Ciemnienie na końcu (sygnał stabilizuje się)
  if (t > 0.7) {
    ctx.fillStyle = `rgba(0,0,0,${((t - 0.7) / 0.3 * 0.6).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawNoise(W,H) {
  // Autentyczny szum VHS — kolorowy (chrominancja) z poziomymi pasmami
  const img=ctx.createImageData(W,H), d=img.data;
  const base=S.noise*.5+6;
  const t=Date.now();
  for (let y=0;y<H;y++) {
    const lineShift=((Math.sin(y*0.08+t*0.001)*3+Math.random()*2))|0;
    for (let x=0;x<W;x++) {
      const i=(y*W+x)*4;
      const v=Math.random()*base|0;
      // Lekko kolorowy szum (jak brak sygnału chrominancji)
      d[i]   = clamp(v + (Math.random()*base*0.4|0) + lineShift);
      d[i+1] = clamp(v - (Math.random()*base*0.2|0));
      d[i+2] = clamp(v + (Math.random()*base*0.6|0) - lineShift);
      d[i+3] = 255;
    }
  }
  ctx.putImageData(img,0,0);
  // Poziome paski jak brak pionowej synchronizacji
  const bands=3+Math.random()*4|0;
  for(let b=0;b<bands;b++) {
    const by=Math.random()*H;
    ctx.fillStyle=`rgba(${Math.random()>0.5?200:0},0,${Math.random()>0.5?180:0},${0.03+Math.random()*0.06})`;
    ctx.fillRect(0,by,W,1+Math.random()*3);
  }
}

function drawPause(W,H) {
  if (prevFrame) ctx.putImageData(prevFrame,0,0);
  // Linia śledzenia przewijająca się w górę (jak prawdziwa pauza VHS)
  const t=(Date.now()%2800)/2800;
  ctx.fillStyle='rgba(255,255,255,.18)'; ctx.fillRect(0,t*H,W,2);
  ctx.fillStyle='rgba(255,255,255,.06)'; ctx.fillRect(0,t*H+2,W,4);
  // Losowe zakłócenia linii
  if (prevFrame && Math.random()<0.2) {
    const y=Math.random()*H|0, h=1+Math.random()*8|0;
    const sh=((Math.random()-0.5)*16)|0;
    const slice=ctx.getImageData(0,y,W,h);
    ctx.putImageData(slice,sh,y);
    // Kolorowe przebarwienie na zakłóconej linii
    ctx.fillStyle=`rgba(200,0,100,${(Math.random()*0.08).toFixed(3)})`;
    ctx.fillRect(sh>0?0:W+sh,y,Math.abs(sh),h);
  }
  // Szum w strefie śledzenia
  const noiseY=(t*H+H-20)%H;
  for(let x=0;x<W;x+=2) {
    const v=Math.random()*80|0;
    ctx.fillStyle=`rgb(${v},${v*0.8|0},${v*1.2|0})`;
    ctx.fillRect(x,noiseY,2,2);
  }
}

function drawRewind(W,H) {
  ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  const dir=state===ST.REW?-1:1;
  const t=((Date.now()*.003*dir)%1+1)%1;
  // Białe paski przewijania
  for (let i=0;i<12;i++) {
    const a=0.02+Math.random()*0.06;
    ctx.fillStyle=`rgba(255,255,255,${a})`;
    ctx.fillRect(0,((i/12+t)%1)*H,W,H/12*0.4);
  }
  // Kolorowe artefakty chrominancji podczas przewijania
  for (let i=0;i<80;i++) {
    const r=Math.random()*255|0, g=Math.random()*40|0, b=Math.random()*220|0;
    ctx.fillStyle=`rgba(${r},${g},${b},.07)`;
    ctx.fillRect(0,Math.random()*H,W*(.1+Math.random()*.9),1+Math.random()*4);
  }
  // Poziomy sync szum
  ctx.fillStyle='rgba(255,255,255,.04)';
  for(let y=0;y<H;y+=3) {
    if(Math.random()<0.15) ctx.fillRect(Math.random()*W*0.3,y,W*(0.5+Math.random()*0.5),1);
  }
}

// ── Scena generatywna ─────────────────────────────────────────────────────────
function drawScene(W,H) {
  const t=sceneTime;
  const r=(30+Math.sin(t*.05)*50+50)|0, g=(60+Math.sin(t*.03)*28+28)|0, b=(105+Math.sin(t*.04)*40)|0;
  const sky=ctx.createLinearGradient(0,0,0,H*.62);
  sky.addColorStop(0,`rgb(${r},${g},${b})`); sky.addColorStop(1,`rgb(${r+40},${g+22},${b-22})`);
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,H*.62);
  ctx.fillStyle='#265410'; ctx.fillRect(0,H*.62,W,H*.38);

  ctx.beginPath(); ctx.moveTo(0,H*.62);
  for(let x=0;x<=W;x+=12){
    const y=H*.46-Math.abs(Math.sin((x+t*4)*.017))*H*.22-Math.abs(Math.sin((x+t*2.5)*.031))*H*.1;
    ctx.lineTo(x,y);
  }
  ctx.lineTo(W,H*.62); ctx.closePath(); ctx.fillStyle='rgba(38,58,78,.82)'; ctx.fill();

  for(let i=0;i<9;i++){ const x=((i*155+t*18)%(W+90))-45; drawTree(x,H*.62,46+Math.sin(i*37)*20); }

  const sx=W*.68+Math.sin(t*.02)*W*.07, sy=H*.17+Math.cos(t*.015)*H*.05;
  const sg=ctx.createRadialGradient(sx,sy,0,sx,sy,30);
  sg.addColorStop(0,'rgba(255,238,80,1)'); sg.addColorStop(.5,'rgba(255,148,0,.7)'); sg.addColorStop(1,'transparent');
  ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(sx,sy,30,0,Math.PI*2); ctx.fill();

  for(let i=0;i<5;i++){
    const bx=((i*210+t*32)%(W+50))-25, by=H*.12+Math.sin(t*1.1+i)*H*.04;
    const w=.55+Math.sin(t*3+i)*.28;
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.quadraticCurveTo(bx-7,by-5*w,bx-14,by);
    ctx.moveTo(bx,by); ctx.quadraticCurveTo(bx+7,by-5*w,bx+14,by);
    ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.lineWidth=1.4; ctx.stroke();
  }

  ctx.font=`bold ${clamp(Math.round(W*.016)+8)}px monospace`;
  ctx.fillStyle='rgba(255,255,200,.32)';
  ctx.fillText('[ DEMO — przeciągnij lub wgraj plik wideo ]',12,H-16);
}

function drawTree(x,bY,h) {
  ctx.fillStyle='#281103'; ctx.fillRect(x-3,bY-h*.26,6,h*.26);
  ctx.beginPath(); ctx.moveTo(x,bY-h); ctx.lineTo(x-h*.3,bY-h*.26); ctx.lineTo(x+h*.3,bY-h*.26); ctx.closePath(); ctx.fillStyle='#134a0d'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x,bY-h*1.22); ctx.lineTo(x-h*.22,bY-h*.6); ctx.lineTo(x+h*.22,bY-h*.6); ctx.closePath(); ctx.fillStyle='#1b5e14'; ctx.fill();
}

// ── Stan magnetowidu ──────────────────────────────────────────────────────────
function setState(newState) {
  state=newState;
  Object.values(btns).forEach(b=>b.classList.remove('active'));
  displayMode.textContent=newState;
  displayMode.classList.remove('rec-blink');
  osdRec.style.display='none';
  screen.classList.remove('playing');

  const bMap={[ST.PLAY]:btns.play,[ST.STOP]:btns.stop,[ST.PAUSE]:btns.pause,
              [ST.REW]:btns.rew,[ST.FF]:btns.ff,[ST.REC]:btns.rec};
  if (bMap[newState]) bMap[newState].classList.add('active');

  switch(newState) {
    case ST.PLAY:
      screen.classList.add('playing');
      ensureAudio();
      if (hasVideo) { videoEl.playbackRate=1; videoEl.play(); }
      break;
    case ST.PAUSE:
      screen.classList.add('playing');
      if (hasVideo) videoEl.pause();
      break;
    case ST.STOP:
      if (hasVideo) videoEl.pause();
      break;
    case ST.REW: case ST.FF:
      screen.classList.add('playing');
      if (hasVideo) videoEl.pause();
      break;
    case ST.REC:
      screen.classList.add('playing');
      ensureAudio();
      osdRec.style.display='block'; osdRec.classList.add('rec-blink');
      displayMode.classList.add('rec-blink');
      if (hasVideo) { videoEl.playbackRate=1; videoEl.play(); }
      break;
  }
}

videoEl.addEventListener('ended', () => {
  if (channelActive && scheduleData.channels.find(c => c.id === channel)) {
    updateCh(); // następny program w ramówce
  } else {
    setState(ST.STOP);
  }
});

// ── Automatyczna zmiana programu (pilnuje zmiany slotu w czasie) ───────────────
let _lastEntryId = null;
setInterval(() => {
  if (!channelActive) return;
  const entry = getCurrentEntry(channel);
  const id    = entry?.id ?? null;
  if (id !== _lastEntryId) {
    _lastEntryId = id;
    updateCh();
  }
}, 30000);

// ── Przyciski ─────────────────────────────────────────────────────────────────
btns.play.addEventListener('click',  ()=>{ if(tapeInserted) setState(ST.PLAY);  else openFilePicker(); });
btns.stop.addEventListener('click',  ()=>{ if(tapeInserted) setState(ST.STOP);  });
btns.rew.addEventListener('click',   ()=>{ if(tapeInserted) setState(ST.REW);   });
btns.ff.addEventListener('click',    ()=>{ if(tapeInserted) setState(ST.FF);    });
btns.eject.addEventListener('click', ()=>ejectTape());
btns.pause.addEventListener('click', ()=>{
  if (!tapeInserted) return;
  if ([ST.PLAY,ST.REC].includes(state)) setState(ST.PAUSE);
  else if (state===ST.PAUSE) setState(ST.PLAY);
});
btns.rec.addEventListener('click',   ()=>{
  if (!tapeInserted) return;
  if (state===ST.REC) setState(ST.STOP); else setState(ST.REC);
});

// ── Klawiatura ────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e=>{
  if (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
  switch(e.key) {
    case ' ': e.preventDefault();
      [ST.PLAY,ST.REC].includes(state)?btns.pause.click():btns.play.click(); break;
    case 's':case'S': btns.stop.click();  break;
    case 'r':case'R': btns.rew.click();   break;
    case 'f':case'F': btns.ff.click();    break;
    case 'e':case'E': btns.eject.click(); break;
    case 'o':case'O': openFilePicker();  break;
    case ',': openSettings(); break;
    case 'ArrowRight': if(hasVideo&&videoEl.duration) videoEl.currentTime=Math.min(videoEl.duration,videoEl.currentTime+5); break;
    case 'ArrowLeft':  if(hasVideo) videoEl.currentTime=Math.max(0,videoEl.currentTime-5); break;
    case 'ArrowUp':    videoEl.volume=Math.min(1,(videoEl.volume||.8)+.05); break;
    case 'ArrowDown':  videoEl.volume=Math.max(0,(videoEl.volume||.8)-.05); break;
  }
});

// ── Zegar ─────────────────────────────────────────────────────────────────────
function tick() {
  const n=new Date();
  vcrClock.textContent=`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}
tick(); setInterval(tick,30000);

function fmt(s) {
  if (!s||isNaN(s)) return '0:00';
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60);
  return h>0?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${m}:${String(sec).padStart(2,'0')}`;
}

// ── Baner zmiany kanału ───────────────────────────────────────────────────────
const chBannerCSS = `
  .ch-osd {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    z-index: 50; pointer-events: none;
    font-family: 'VT323', monospace;
    transform: translateY(100%);
    transition: transform .2s cubic-bezier(.22,.68,0,1.15);
  }
  .ch-osd.visible { transform: translateY(0); }

  .ch-osd-accent {
    height: 3px;
    background: var(--osd-color, #c8870a);
    transition: background .3s;
  }

  .ch-osd-inner {
    background: rgba(5,4,3,.95);
    padding: 10px 20px 8px;
    display: flex; align-items: center; gap: 16px;
    position: relative; overflow: hidden;
  }
  /* Linie skanujące */
  .ch-osd-inner::after {
    content:''; position:absolute; inset:0; pointer-events:none;
    background: repeating-linear-gradient(
      to bottom, transparent 0, transparent 3px, rgba(0,0,0,.14) 3px, rgba(0,0,0,.14) 4px
    );
  }

  /* Numer kanału */
  .ch-osd-num {
    flex-shrink: 0;
    background: var(--osd-color, #c8870a);
    color: #000;
    font-size: 2.4rem; line-height: 1;
    padding: 3px 14px 1px 10px;
    letter-spacing: .04em;
    clip-path: polygon(0 0, 100% 0, 88% 100%, 0 100%);
    min-width: 82px; text-align: center;
  }
  /* Logo kanału */
  .ch-osd-logo {
    flex-shrink: 0;
    font-size: 2rem; line-height: 1;
    filter: drop-shadow(0 0 4px rgba(255,255,255,.3));
  }

  /* Blok info */
  .ch-osd-info { flex: 1; min-width: 0; }
  .ch-osd-name {
    font-size: 2.1rem; color: #f0d888; line-height: 1;
    letter-spacing: .1em; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }
  .ch-osd-program {
    font-size: 1.15rem; color: #9a8860; letter-spacing: .07em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-top: 2px;
  }

  /* Pasek postępu programu */
  .ch-osd-prog-bar {
    margin-top: 6px; position: relative;
  }
  .ch-osd-prog-track {
    height: 4px; background: rgba(255,255,255,.12); border-radius: 2px; overflow: hidden;
  }
  .ch-osd-prog-fill {
    height: 100%;
    background: var(--osd-color, #c8870a);
    border-radius: 2px;
    transition: width .4s;
  }
  .ch-osd-prog-times {
    display: flex; justify-content: space-between;
    font-size: .9rem; color: #6a5a40; margin-top: 2px; letter-spacing: .05em;
  }
  .ch-osd-prog-remain { color: var(--osd-color, #c8870a); }

  /* Czas i data */
  .ch-osd-right { text-align: right; flex-shrink: 0; }
  .ch-osd-time { font-size: 2.4rem; color: #f0d888; letter-spacing: .08em; line-height: 1; }
  .ch-osd-date { font-size: .95rem; color: #6a5a40; letter-spacing: .06em; margin-top: 2px; }

  /* Separator pionowy */
  .ch-osd-sep {
    width: 1px; height: 52px; background: rgba(255,255,255,.08); flex-shrink: 0;
  }
`;
(function injectBannerCSS() {
  const s = document.createElement('style');
  s.textContent = chBannerCSS;
  document.head.appendChild(s);
})();

const chBannerEl = (() => {
  const el = document.createElement('div');
  el.className = 'ch-osd';
  // Wewnątrz ekranu TV — nie koliduje z przyciskami VCR
  document.getElementById('screen').appendChild(el);
  return el;
})();

let chBannerTimer;
const DAY_PL = ['Nd','Pn','Wt','Śr','Cz','Pt','Sb'];

function showChBanner(ch, data, entry) {
  const name    = data?.name    || `CH ${ch}`;
  const program = data?.program || 'Brak sygnału';
  const color   = data?.color   || '#c8870a';
  const logo    = data?.logo    || '';

  const now    = simulatedNow();
  const HH     = now.getHours().toString().padStart(2,'0');
  const MM     = now.getMinutes().toString().padStart(2,'0');
  // Data: symulowana jeśli ustawiona, inaczej realna
  let dd, mm, dayStr;
  if (scheduleData.simulationDate) {
    const [sy, sm, sd] = scheduleData.simulationDate.split('-').map(Number);
    const simD = new Date(sy, sm - 1, sd);
    dd     = sd.toString().padStart(2,'0');
    mm     = sm.toString().padStart(2,'0');
    dayStr = DAY_PL[simD.getDay()];
  } else {
    dd     = now.getDate().toString().padStart(2,'0');
    mm     = (now.getMonth()+1).toString().padStart(2,'0');
    dayStr = DAY_PL[now.getDay()];
  }

  // Pasek postępu programu
  let progHTML = '';
  if (entry?.startTime && entry?.endTime) {
    const nowMins  = now.getHours() * 60 + now.getMinutes();
    const startM   = schedMins(entry.startTime);
    const endM     = schedMins(entry.endTime);
    const pct      = Math.max(0, Math.min(100, ((nowMins - startM) / (endM - startM)) * 100));
    const remMins  = Math.max(0, endM - nowMins);
    const remStr   = remMins > 0 ? `${remMins} MIN` : 'KONIEC';
    progHTML = `
      <div class="ch-osd-prog-bar">
        <div class="ch-osd-prog-track">
          <div class="ch-osd-prog-fill" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <div class="ch-osd-prog-times">
          <span>${entry.startTime}</span>
          <span class="ch-osd-prog-remain">${remStr}</span>
          <span>${entry.endTime}</span>
        </div>
      </div>`;
  }

  chBannerEl.style.setProperty('--osd-color', color);
  chBannerEl.innerHTML = `
    <div class="ch-osd-accent"></div>
    <div class="ch-osd-inner">
      <div class="ch-osd-num">CH&nbsp;${ch}</div>
      ${logo ? `<div class="ch-osd-logo">${logo}</div>` : ''}
      <div class="ch-osd-info">
        <div class="ch-osd-name">${name}</div>
        <div class="ch-osd-program">${program}</div>
        ${progHTML}
      </div>
      <div class="ch-osd-sep"></div>
      <div class="ch-osd-right">
        <div class="ch-osd-time">${HH}:${MM}</div>
        <div class="ch-osd-date">${dayStr}&nbsp;${dd}.${mm}</div>
      </div>
    </div>
  `;

  chBannerEl.classList.add('visible');
  clearTimeout(chBannerTimer);
  chBannerTimer = setTimeout(() => chBannerEl.classList.remove('visible'), 5000);
}

// ── Kanały proceduralne ───────────────────────────────────────────────────────

// CH 2 — Plansza testowa SMPTE EBU
function drawColorBars(W, H) {
  const top = H * 0.75, bot = H * 0.25;
  const bars = ['#c0c0c0','#c0c000','#00c0c0','#00c000','#c000c0','#c00000','#0000c0'];
  const bw = W / 7;
  bars.forEach((c, i) => {
    ctx.fillStyle = c; ctx.fillRect(i * bw, 0, bw, top);
  });
  // Pasek dolny (odwrócona kolejność + -I +I)
  const bot2 = ['#0000c0','#131313','#c000c0','#131313','#00c0c0','#131313','#c0c0c0'];
  bot2.forEach((c, i) => {
    ctx.fillStyle = c; ctx.fillRect(i * bw, top, bw, bot * 0.6);
  });
  // Stopka: czarny, biały, czarny pasy
  const stripY = top + bot * 0.6;
  [[0, W*0.4,'#131313'],[W*0.4, W*0.2,'#ffffff'],[W*0.6, W*0.4,'#131313']].forEach(([x,w,c]) => {
    ctx.fillStyle = c; ctx.fillRect(x, stripY, w, bot * 0.4);
  });
  // Watermark
  ctx.font = `bold ${Math.round(W*0.05)}px monospace`;
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillText('TVX', W*0.015, H*0.065);
  ctx.font = `${Math.round(W*0.018)}px monospace`;
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillText('PLANSZA TECHNICZNA', W*0.015, H*0.96);
}

// CH 5 — Prognoza Pogody
const WEATHER_CITIES = [
  { name:'WARSZAWA', x:.62, y:.38, temp:18, w:'sun'   },
  { name:'KRAKÓW',   x:.55, y:.75, temp:16, w:'cloud' },
  { name:'GDAŃSK',   x:.50, y:.09, temp:14, w:'rain'  },
  { name:'WROCŁAW',  x:.30, y:.58, temp:17, w:'sun'   },
  { name:'POZNAŃ',   x:.34, y:.33, temp:15, w:'cloud' },
  { name:'BIAŁYSTOK',x:.78, y:.22, temp:12, w:'cloud' },
  { name:'ŁÓDŹ',     x:.51, y:.50, temp:17, w:'sun'   },
];
// Uproszczony zarys Polski (znormalizowany do 0-1)
const POLAND_SHAPE = [
  .18,.05, .28,.00, .40,.02, .52,.00, .62,.04, .74,.03,
  .88,.14, .95,.28, .93,.42, .85,.48, .92,.60, .88,.68,
  .80,.75, .70,.80, .62,.88, .52,.97, .42,.93, .32,.88,
  .22,.80, .12,.70, .06,.58, .05,.44, .08,.30, .13,.17, .18,.05
];
function drawWeather(W, H, t) {
  // Tło nieba
  const sky = ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#1a3a5c'); sky.addColorStop(1,'#2e6fa3');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);

  // Mapa — prostokąt z zarysem Polski
  const mx=W*.14, my=H*.12, mw=W*.72, mh=H*.72;
  // Tło mapy — ziemia
  ctx.fillStyle='#3a6b3a'; ctx.fillRect(mx,my,mw,mh);

  // Zarys Polski
  ctx.beginPath();
  for (let i=0; i<POLAND_SHAPE.length; i+=2) {
    const px = mx + POLAND_SHAPE[i]*mw, py = my + POLAND_SHAPE[i+1]*mh;
    i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
  }
  ctx.closePath();
  ctx.fillStyle='#4a8c4a'; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=1.5; ctx.stroke();

  // Animowane chmury w tle
  for (let i=0;i<4;i++) {
    const cx2 = mx + ((i*220 + t*18)%(mw+80))-40;
    const cy2 = my + mh*(0.12+i*.18);
    ctx.fillStyle='rgba(200,220,255,.18)';
    ctx.beginPath(); ctx.ellipse(cx2,cy2,55,22,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx2+30,cy2-12,38,18,0,0,Math.PI*2); ctx.fill();
  }

  // Miasta
  const fs = Math.max(10, Math.round(W*.018));
  WEATHER_CITIES.forEach(c => {
    const cx2 = mx + c.x*mw, cy2 = my + c.y*mh;
    // Ikona pogody
    ctx.save();
    if (c.w==='sun') {
      ctx.strokeStyle='#ffdd33'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(cx2,cy2,7,0,Math.PI*2); ctx.fillStyle='#ffdd33'; ctx.fill(); ctx.stroke();
      for(let r=0;r<8;r++){
        const a=r*Math.PI/4;
        ctx.beginPath(); ctx.moveTo(cx2+Math.cos(a)*9,cy2+Math.sin(a)*9);
        ctx.lineTo(cx2+Math.cos(a)*13,cy2+Math.sin(a)*13); ctx.stroke();
      }
    } else if (c.w==='cloud') {
      ctx.fillStyle='#aaccee';
      ctx.beginPath(); ctx.ellipse(cx2,cy2,9,6,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx2+5,cy2-4,6,5,0,0,Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle='#88aacc';
      ctx.beginPath(); ctx.ellipse(cx2,cy2-4,8,5,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#6699cc'; ctx.lineWidth=1;
      for(let r=0;r<3;r++){
        ctx.beginPath(); ctx.moveTo(cx2-5+r*4,cy2); ctx.lineTo(cx2-7+r*4,cy2+7); ctx.stroke();
      }
    }
    ctx.restore();
    // Temperatura
    ctx.font = `bold ${fs}px monospace`;
    ctx.fillStyle='#fff'; ctx.shadowColor='#000'; ctx.shadowBlur=3;
    ctx.fillText(`${c.temp}°`, cx2+14, cy2+5);
    ctx.font = `${Math.round(fs*.75)}px monospace`;
    ctx.fillStyle='#ddeeff';
    ctx.fillText(c.name, cx2-8, cy2+17);
    ctx.shadowBlur=0;
  });

  // Nagłówek
  ctx.fillStyle='rgba(0,20,60,.82)'; ctx.fillRect(0,0,W,H*.1);
  ctx.font = `bold ${Math.round(W*.038)}px monospace`;
  ctx.fillStyle='#fff'; ctx.letterSpacing='0.1em';
  ctx.fillText('PROGNOZA POGODY', W*.04, H*.075);
  ctx.font = `${Math.round(W*.022)}px monospace`;
  ctx.fillStyle='#7ad';
  ctx.fillText('TVX METEO', W*.72, H*.075);

  // Stopka daty
  const dni = ['PN','WT','ŚR','CZ','PT','SB','ND'];
  const dz  = new Date();
  ctx.fillStyle='rgba(0,20,60,.75)'; ctx.fillRect(0,H*.87,W,H*.13);
  for (let i=0;i<5;i++) {
    const d2 = new Date(dz); d2.setDate(dz.getDate()+i);
    const x2 = W*(0.06+i*0.19);
    ctx.font = `bold ${Math.round(W*.022)}px monospace`;
    ctx.fillStyle = i===0 ? '#ffdd33' : '#aaccff';
    ctx.fillText(dni[d2.getDay()], x2, H*.915);
    ctx.font = `${Math.round(W*.028)}px monospace`;
    ctx.fillStyle = '#fff';
    const temps = [18,16,14,17,15]; // prognozy kolejnych dni
    ctx.fillText(`${temps[i]}°`, x2, H*.96);
  }
}

// CH 7 — Wiadomości
const NEWS_TICKER = [
  'RADA MINISTRÓW OBRADUJE NAD PROJEKTEM NOWEJ USTAWY O TELEWIZJI PUBLICZNEJ  ★  ',
  'PROGNOZA POGODY: W WEEKEND MOŻLIWE OPADY DESZCZU NA ZACHODZIE KRAJU  ★  ',
  'REPREZENTACJA POLSKI PRZYGOTOWUJE SIĘ DO KWALIFIKACJI MISTRZOSTW ŚWIATA  ★  ',
  'INFLACJA W LIPCU WYNIOSŁA 3,2 PROCENT — PODAŁ GŁÓWNY URZĄD STATYSTYCZNY  ★  ',
  'NOWY SEZON FESTIWALU FILMOWEGO W GDYNI ROZPOCZNIE SIĘ W PRZYSZŁYM TYGODNIU  ★  ',
  'PREMIER SPOTKAŁ SIĘ DZIŚ Z PRZEDSTAWICIELAMI GŁÓWNYCH ZWIĄZKÓW ZAWODOWYCH  ★  ',
  'ZARZĄD PKP OGŁOSIŁ PLAN MODERNIZACJI LINII KOLEJOWYCH DO ROKU 2000  ★  ',
];
const NEWS_HEADLINES = [
  'PREMIER: "POLSKA JEST GOTOWA NA ZMIANY"',
  'NOWE INWESTYCJE W INFRASTRUKTURĘ KRAJU',
  'MINISTRA ZDROWIA O REFORMIE SŁUŻBY ZDROWIA',
  'GOSPODARKA ROŚNIE TRZECI KWARTAŁ Z RZĘDU',
  'SZCZYT NATO — POLSKA WŚRÓD KLUCZOWYCH GRACZY',
];
let newsTickerOffset = 0;
let newsHeadlineIdx  = 0;
let newsHeadlineTimer = 0;

function drawNews(W, H, t) {
  // Tło studia
  const bg = ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#09102a'); bg.addColorStop(1,'#111e3c');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Siatka w tle (retro studio)
  ctx.strokeStyle='rgba(30,60,140,.35)'; ctx.lineWidth=1;
  for(let x=0;x<W;x+=W/16){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y=0;y<H;y+=H/9){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Prezenter — sylwetka
  const px=W*.36, py=H*.55, pr=H*.18;
  // biurko
  ctx.fillStyle='#1a2a4a';
  ctx.fillRect(W*.1, H*.62, W*.8, H*.25);
  ctx.fillStyle='#22334d';
  ctx.fillRect(W*.1, H*.62, W*.8, H*.04);
  // głowa
  ctx.fillStyle='#c8a87a';
  ctx.beginPath(); ctx.ellipse(px,py-pr*.4,pr*.38,pr*.44,0,0,Math.PI*2); ctx.fill();
  // ramiona / garnitur
  ctx.fillStyle='#1a2a4a';
  ctx.beginPath(); ctx.ellipse(px,py+pr*.3,pr*.7,pr*.55,0,0,Math.PI); ctx.fill();
  // krawat
  ctx.fillStyle='#c00020';
  ctx.beginPath(); ctx.moveTo(px,py-pr*.05); ctx.lineTo(px-pr*.07,py+pr*.25); ctx.lineTo(px,py+pr*.3); ctx.lineTo(px+pr*.07,py+pr*.25); ctx.closePath(); ctx.fill();
  // mikrofon
  ctx.fillStyle='#555'; ctx.fillRect(px+pr*.4, py, 4, pr*.4);
  ctx.beginPath(); ctx.ellipse(px+pr*.4+2,py,8,10,0,0,Math.PI*2); ctx.fill();

  // Drugi prezenter po prawej
  const px2=W*.64;
  ctx.fillStyle='#b07860';
  ctx.beginPath(); ctx.ellipse(px2,py-pr*.4,pr*.35,pr*.42,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1a2a4a';
  ctx.beginPath(); ctx.ellipse(px2,py+pr*.3,pr*.65,pr*.55,0,0,Math.PI); ctx.fill();

  // Logo TVX po prawej stronie (ekran za prezenterami)
  ctx.fillStyle='rgba(0,60,160,.4)';
  ctx.fillRect(W*.66, H*.13, W*.24, H*.4);
  ctx.font = `bold ${Math.round(W*.06)}px monospace`;
  ctx.fillStyle='rgba(255,255,255,.6)';
  ctx.fillText('TVX', W*.695, H*.36);

  // Nagłówek "WIADOMOŚCI"
  ctx.fillStyle='#aa0015'; ctx.fillRect(0,0,W,H*.1);
  ctx.fillStyle='rgba(180,0,0,.7)'; ctx.fillRect(0,H*.1,W,H*.004);
  ctx.font=`bold ${Math.round(W*.042)}px monospace`;
  ctx.fillStyle='#fff';
  ctx.fillText('◼  TVX WIADOMOŚCI', W*.03, H*.073);
  // Zegar
  const now=new Date();
  const hhmm=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  ctx.font=`${Math.round(W*.03)}px monospace`;
  ctx.fillStyle='rgba(255,255,255,.9)';
  ctx.fillText(hhmm, W*.78, H*.072);
  // "ON AIR" migający
  if (Math.floor(t*2)%2===0) {
    ctx.fillStyle='#ff0022';
    ctx.beginPath(); ctx.arc(W*.93, H*.05, W*.008, 0, Math.PI*2); ctx.fill();
    ctx.font=`bold ${Math.round(W*.018)}px monospace`;
    ctx.fillStyle='#fff'; ctx.fillText('ON AIR', W*.945, H*.057);
  }

  // Lower third (pasek dolny z nagłówkiem)
  const lty = H*.68;
  ctx.fillStyle='#aa0015'; ctx.fillRect(0, lty, W*.75, H*.054);
  ctx.fillStyle='#0a1535'; ctx.fillRect(0, lty+H*.054, W*.75, H*.042);
  const hl = NEWS_HEADLINES[newsHeadlineIdx % NEWS_HEADLINES.length];
  ctx.font=`bold ${Math.round(W*.026)}px monospace`;
  ctx.fillStyle='#fff';
  ctx.fillText('INFORMACJE', W*.018, lty+H*.038);
  ctx.font=`${Math.round(W*.022)}px monospace`;
  ctx.fillStyle='#ccd';
  ctx.fillText(hl, W*.018, lty+H*.082);
  // Zmień nagłówek co 6s
  if (t - newsHeadlineTimer > 6) { newsHeadlineTimer=t; newsHeadlineIdx++; }

  // Ticker
  const tickerY = H*.88;
  ctx.fillStyle='#d00018'; ctx.fillRect(0, tickerY, W, H*.12);
  ctx.fillStyle='#fff'; ctx.fillRect(0, tickerY, W*.13, H*.12);
  ctx.font=`bold ${Math.round(W*.028)}px monospace`;
  ctx.fillStyle='#d00018';
  ctx.fillText('AKTUAL.', W*.008, tickerY+H*.075);

  const fullTicker = NEWS_TICKER.join('') + NEWS_TICKER[0];
  ctx.save();
  ctx.rect(W*.13, tickerY, W*.87, H*.12); ctx.clip();
  ctx.font=`${Math.round(W*.028)}px monospace`;
  ctx.fillStyle='#fff';
  const tickerX = W*.13 - (newsTickerOffset % (W*3.5));
  ctx.fillText(fullTicker, tickerX, tickerY+H*.075);
  ctx.restore();
  newsTickerOffset += 1.2;
}

const CHANNEL_DRAWS = {
  colorBars: drawColorBars,
  weather:   drawWeather,
  news:      drawNews,
};

// ── Pilot (Gamepad API) ───────────────────────────────────────────────────────
/*
  Mapowanie przycisków (standard gamepad layout):
  A / Cross      (0)  → Play / Pause
  B / Circle     (1)  → Stop
  X / Square     (2)  → Rewind
  Y / Triangle   (3)  → Fast Forward
  LB / L1        (4)  → Kanał w dół
  RB / R1        (5)  → Kanał w górę
  Select / Back  (8)  → Eject
  Start / Menu   (9)  → Ustawienia
  D-pad góra    (12)  → Kanał w górę
  D-pad dół     (13)  → Kanał w dół
  D-pad lewo    (14)  → Rewind
  D-pad prawo   (15)  → Fast Forward
  Oś lewa Y           → Głośność
*/

const GP = {
  prev: [],          // poprzedni stan przycisków (debounce)
  volTimer: 0,       // throttle osi głośności
  connected: false,
};

// Powiadomienie OSD o pilocie
function gpNotify(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:rgba(0,0,0,.82);color:#0ff;font-family:'VT323',monospace;
    font-size:1.1rem;padding:7px 18px;border:1px solid #0ff4;
    letter-spacing:.1em;z-index:9999;pointer-events:none;
    animation:gpFadeOut 2.4s forwards;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// Dodaj animację jeśli jeszcze nie ma
if (!document.getElementById('gpStyle')) {
  const s = document.createElement('style');
  s.id = 'gpStyle';
  s.textContent = `@keyframes gpFadeOut{0%{opacity:1}70%{opacity:1}100%{opacity:0}}`;
  document.head.appendChild(s);
}

window.addEventListener('gamepadconnected', e => {
  GP.connected = true;
  gpNotify(`📡 PILOT POŁĄCZONY — ${e.gamepad.id.slice(0,28)}`);
});
window.addEventListener('gamepaddisconnected', () => {
  GP.connected = false;
  gpNotify('📡 PILOT ODŁĄCZONY');
});

// Akcje przycisków pilota
const GP_ACTIONS = {
  0:  () => { [ST.PLAY,ST.REC].includes(state) ? btns.pause.click() : btns.play.click(); },
  1:  () => btns.stop.click(),
  2:  () => btns.rew.click(),
  3:  () => btns.ff.click(),
  4:  () => { channel = channel > 1 ? channel - 1 : 12; updateCh(); },
  5:  () => { channel = (channel % 12) + 1; updateCh(); },
  8:  () => btns.eject.click(),
  9:  () => settingsDrawer.classList.toggle('open'),
  12: () => { channel = (channel % 12) + 1; updateCh(); },
  13: () => { channel = channel > 1 ? channel - 1 : 12; updateCh(); },
  14: () => btns.rew.click(),
  15: () => btns.ff.click(),
};

function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;

    // Przyciski — reaguj tylko na nowe wciśnięcia (debounce)
    gp.buttons.forEach((btn, i) => {
      const pressed = btn.pressed || btn.value > 0.5;
      const wasPressed = GP.prev[gp.index]?.[i] ?? false;
      if (pressed && !wasPressed && GP_ACTIONS[i]) GP_ACTIONS[i]();
      if (!GP.prev[gp.index]) GP.prev[gp.index] = [];
      GP.prev[gp.index][i] = pressed;
    });

    // Oś lewa Y → głośność (throttle co 120ms)
    const axisY = gp.axes[1] ?? 0;
    if (Math.abs(axisY) > 0.3 && Date.now() - GP.volTimer > 120) {
      videoEl.volume = Math.max(0, Math.min(1, videoEl.volume - axisY * 0.05));
      GP.volTimer = Date.now();
    }
  }
}

// ── WebSocket — pilot mobilny ─────────────────────────────────────────────────
(function initRemoteWS() {
  let ws, wsReconnTimer;

  function wsConnect() {
    // Działa tylko gdy strona serwowana przez server.js
    if (location.protocol === 'file:') return;
    ws = new WebSocket(`ws://${location.host}`);

    ws.onopen = () => clearTimeout(wsReconnTimer);
    ws.onclose = () => { wsReconnTimer = setTimeout(wsConnect, 3000); };
    ws.onerror = () => ws.close();

    ws.onmessage = e => {
      let d;
      try { d = JSON.parse(e.data); } catch { return; }

      switch (d.cmd) {
        case 'play':     [ST.PLAY,ST.REC].includes(state) ? btns.pause.click() : btns.play.click(); break;
        case 'pause':    btns.pause.click();   break;
        case 'stop':     btns.stop.click();    break;
        case 'rew':      btns.rew.click();     break;
        case 'ff':       btns.ff.click();      break;
        case 'eject':    btns.eject.click();   break;
        case 'settings': settingsDrawer.classList.toggle('open'); break;
        case 'ch-up':    channel = channel >= schedChannelCount() ? 1 : channel + 1; updateCh(); wsSendState(); break;
        case 'ch-dn':    channel = channel <= 1 ? schedChannelCount() : channel - 1; updateCh(); wsSendState(); break;
        case 'ch-set':   if (d.ch >= 1 && d.ch <= schedChannelCount()) { channel = d.ch; updateCh(); wsSendState(); } break;
        case undefined:  if (d.type === 'schedule') { scheduleData = d.data; updateCh(); } break;
        case 'vol-up':   videoEl.volume = Math.min(1, videoEl.volume + 0.05); wsSendState(); break;
        case 'vol-dn':   videoEl.volume = Math.max(0, videoEl.volume - 0.05); wsSendState(); break;
        case 'vol-set':  if (d.vol !== undefined) videoEl.volume = Math.max(0, Math.min(1, d.vol)); break;
      }
    };
  }

  // Wyślij aktualny stan do pilota (synchronizacja CH + vol)
  function wsSendState() {
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify({ ch: channel, vol: videoEl.volume }));
    }
  }

  wsConnect();
})();

// ── Start ─────────────────────────────────────────────────────────────────────
setState(ST.STOP);
requestAnimationFrame(loop);
loadSchedule();
