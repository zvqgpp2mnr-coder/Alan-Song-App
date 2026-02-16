// app.js (UPDATED with Guitar Tuner)
// - Shows 🎸 Open Chords button when song.chordLink exists (library + teleprompter)
// - Loads multiple JSON files
// - Filters + sorting + song counter
// - Hide all songs on home until search/filter
// - Setlist teleprompter: tap song to activate, big chords view below, swipe prev/next
// - ✅ Guitar tuner (mic pitch detection + needle meter)

let songs = [];
let currentSet = [];
let activeSetIndex = -1;
let lastVisibleCount = 0;

// ---- DOM ----
const elSongList    = document.getElementById("songList");
const elSearch      = document.getElementById("search");
const elEra         = document.getElementById("eraFilter");
const elArtist      = document.getElementById("artistFilter");
const elTag         = document.getElementById("tagFilter");
const elSort        = document.getElementById("sortBy");
const elSongCounter = document.getElementById("songCounter");

const elCurrentSet  = document.getElementById("currentSet");
const elSetName     = document.getElementById("setName");
const elSavedSets   = document.getElementById("savedSets");

const btnBuild      = document.getElementById("btnBuild");
const btnStage      = document.getElementById("btnStage");
const btnSaveSet    = document.getElementById("btnSaveSet");
const btnLoadSet    = document.getElementById("btnLoadSet");
const btnDeleteSet  = document.getElementById("btnDeleteSet");
const btnClearSet   = document.getElementById("btnClearSet");

// Teleprompter DOM
const elTeleprompter       = document.getElementById("teleprompter");
const elActiveSongTitle    = document.getElementById("activeSongTitle");
const elActiveSongMeta     = document.getElementById("activeSongMeta");
const elActiveSongChords   = document.getElementById("activeSongChords");
const btnPrevSong          = document.getElementById("prevSong");
const btnNextSong          = document.getElementById("nextSong");
const elOpenActiveChords   = document.getElementById("openActiveChords");

// ✅ Tuner DOM
const btnTunerStart = document.getElementById("tunerStart");
const btnTunerStop  = document.getElementById("tunerStop");
const elTunerNote   = document.getElementById("tunerNote");
const elTunerFreq   = document.getElementById("tunerFreq");
const elTunerCents  = document.getElementById("tunerCents");
const elTunerHint   = document.getElementById("tunerHint");
const tunerCanvas   = document.getElementById("tunerCanvas");
const tunerCtx      = tunerCanvas?.getContext?.("2d");

// ---- utils ----
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
}

function showError(msg) {
  if (!elSongList) return;
  elSongList.innerHTML = `
    <div class="song">
      <h3>⚠️ App error</h3>
      <p>${esc(msg)}</p>
      <p class="small">Check the JSON filenames exist in your repo root and are listed in FILES.</p>
    </div>
  `;
}

function updateSongCounter(visibleCount) {
  if (!elSongCounter) return;
  elSongCounter.textContent = `Songs: ${visibleCount} showing • ${songs.length} total • Set: ${currentSet.length}`;
}

// ---- chords rendering (Structure B) ----
function renderChords(song) {
  const chords = song.chords || {};
  const order = ["intro","verse","preChorus","chorus","bridge","outro"];
  const label = (k) => k === "preChorus" ? "PRE-CHORUS" : k.toUpperCase();

  const sections = order
    .filter(k => Array.isArray(chords[k]) && chords[k].length)
    .map(k => `
      <div class="chord-section">
        <strong>${label(k)}</strong><br>
        ${chords[k].map(esc).join(" - ")}
      </div>
    `)
    .join("");

  return sections || "<em>No chords found for this song.</em>";
}

// ---- Teleprompter helpers ----
function setActiveSong(index) {
  if (!currentSet.length) {
    activeSetIndex = -1;
    if (elTeleprompter) elTeleprompter.style.display = "none";
    if (elOpenActiveChords) elOpenActiveChords.style.display = "none";
    return;
  }

  if (index < 0) index = 0;
  if (index > currentSet.length - 1) index = currentSet.length - 1;

  activeSetIndex = index;
  const s = currentSet[activeSetIndex];

  if (elTeleprompter) elTeleprompter.style.display = "block";
  if (elActiveSongTitle) elActiveSongTitle.textContent = `${s.title} — ${s.artist}`;
  if (elActiveSongMeta) elActiveSongMeta.textContent = `Key ${s.key} • Capo ${s.capo} • ${activeSetIndex+1}/${currentSet.length}`;
  if (elActiveSongChords) elActiveSongChords.innerHTML = renderChords(s);

  if (elOpenActiveChords) {
    if (s.chordLink) {
      elOpenActiveChords.style.display = "inline-block";
      elOpenActiveChords.href = s.chordLink;
    } else {
      elOpenActiveChords.style.display = "none";
      elOpenActiveChords.removeAttribute("href");
    }
  }

  document.querySelectorAll("#currentSet li").forEach(li => li.classList.remove("active"));
  const activeLi = document.querySelector(`#currentSet li[data-index="${activeSetIndex}"]`);
  if (activeLi) activeLi.classList.add("active");

  updateSongCounter(lastVisibleCount);
}

function nextSong() {
  if (!currentSet.length) return;
  setActiveSong(activeSetIndex < 0 ? 0 : Math.min(activeSetIndex + 1, currentSet.length - 1));
}

function prevSong() {
  if (!currentSet.length) return;
  setActiveSong(activeSetIndex <= 0 ? 0 : activeSetIndex - 1);
}

// ---- library rendering ----
function renderSongs(list) {
  if (!elSongList) return;

  elSongList.innerHTML = list.map(song => {
    const id = esc(song.id);
    const tags = Array.isArray(song.tags) ? song.tags.join(", ") : "";
    const chordAction = song.chordLink
      ? `<a class="btn btn-secondary" href="${esc(song.chordLink)}" target="_blank" rel="noopener">🎸 Open Chords</a>`
      : `<button class="btn btn-secondary btn-chords" data-songid="${id}">📄 View Chords</button>`;

    return `
      <div class="song">
        <h3>${esc(song.title)} - ${esc(song.artist)}</h3>
        <p>
          Era: ${esc(song.era)} |
          Key: ${esc(song.key)} |
          Capo: ${esc(song.capo)} |
          Energy: ${esc(song.energy)} |
          Popularity: ${esc(song.popularity)}
        </p>
        <div class="small">Tags: ${esc(tags)}</div>

        <div class="song-actions">
          <button class="btn btn-add" data-songid="${id}">➕ Add to Set</button>
          ${chordAction}
        </div>

        <div class="chords" id="chords-${id}" style="display:none;">
          ${renderChords(song)}
        </div>
      </div>
    `;
  }).join("");
}

// ---- current set rendering ----
function renderSet() {
  if (!elCurrentSet) return;

  elCurrentSet.innerHTML = currentSet.map((s, i) => `
    <li data-index="${i}">
      <div style="display:flex; gap:10px; align-items:center; justify-content:space-between;">
        <div style="flex:1;">
          <strong>${i+1}.</strong> ${esc(s.title)} - ${esc(s.artist)}
          <div class="small">Key ${esc(s.key)} • Capo ${esc(s.capo)}</div>
        </div>
        <button class="btn btn-secondary btn-remove" data-index="${i}">Remove</button>
      </div>
    </li>
  `).join("");

  if (activeSetIndex >= currentSet.length) activeSetIndex = currentSet.length - 1;
  if (currentSet.length && activeSetIndex === -1) activeSetIndex = 0;

  if (!currentSet.length) setActiveSong(-1);
  else setActiveSong(activeSetIndex);

  updateSongCounter(lastVisibleCount);
}

// ---- Artist dropdown population ----
function populateArtistFilter() {
  if (!elArtist) return;

  const artists = [...new Set(songs.map(s => s.artist).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));

  elArtist.innerHTML = `
    <option value="all">All Artists</option>
    ${artists.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join("")}
  `;
}

// ---- filters + sorting ----
function applyFilters() {
  const q = (elSearch?.value || "").toLowerCase().trim();
  const era = elEra?.value || "all";
  const artist = elArtist?.value || "all";
  const tag = elTag?.value || "all";

  // Hide all songs on home until something is chosen/typed
  const noFiltersActive = !q && era === "all" && artist === "all" && tag === "all";
  if (noFiltersActive) {
    lastVisibleCount = 0;
    renderSongs([]);
    updateSongCounter(0);
    return;
  }

  let list = songs.filter(s => {
    const matchesQ =
      !q ||
      (s.title || "").toLowerCase().includes(q) ||
      (s.artist || "").toLowerCase().includes(q);

    const matchesEra = (era === "all") || (s.era === era);
    const matchesArtist = (artist === "all") || (s.artist === artist);

    const tags = Array.isArray(s.tags) ? s.tags : [];
    const matchesTag = (tag === "all") || tags.includes(tag);

    return matchesQ && matchesEra && matchesArtist && matchesTag;
  });

  const sort = elSort?.value || "default";
  if (sort === "popularityDesc") list.sort((a,b)=>(b.popularity||0)-(a.popularity||0));
  if (sort === "popularityAsc")  list.sort((a,b)=>(a.popularity||0)-(b.popularity||0));
  if (sort === "energyAsc")      list.sort((a,b)=>(a.energy||0)-(b.energy||0));
  if (sort === "energyDesc")     list.sort((a,b)=>(b.energy||0)-(a.energy||0));

  lastVisibleCount = list.length;
  renderSongs(list);
  updateSongCounter(list.length);
}

// ---- library click handling (Add + internal chords toggle only) ----
elSongList?.addEventListener("click", (e) => {
  const addBtn = e.target.closest(".btn-add");
  const chordBtn = e.target.closest(".btn-chords"); // only internal chord view button

  if (addBtn) {
    const id = addBtn.getAttribute("data-songid");
    const song = songs.find(s => String(s.id) === String(id));
    if (!song) return;

    if (currentSet.some(x => x.id === song.id)) return; // no duplicates
    currentSet.push(song);
    renderSet();
    return;
  }

  if (chordBtn) {
    const id = chordBtn.getAttribute("data-songid");
    const panel = document.getElementById("chords-" + id);
    if (!panel) return;

    const isOpen = panel.style.display !== "none";
    if (isOpen) {
      panel.style.display = "none";
      chordBtn.textContent = "📄 View Chords";
      return;
    }

    // close others, open this
    document.querySelectorAll(".chords").forEach(p => p.style.display = "none");
    document.querySelectorAll(".btn-chords").forEach(b => b.textContent = "📄 View Chords");

    panel.style.display = "block";
    chordBtn.textContent = "📄 Hide Chords";
  }
});

// ---- set list click handling (tap selects active + remove) ----
elCurrentSet?.addEventListener("click", (e) => {
  const removeBtn = e.target.closest(".btn-remove");
  if (removeBtn) {
    const idx = Number(removeBtn.getAttribute("data-index"));
    if (!Number.isNaN(idx)) {
      currentSet.splice(idx, 1);
      renderSet();
    }
    return;
  }

  const li = e.target.closest("#currentSet li");
  if (li) {
    const idx = Number(li.getAttribute("data-index"));
    if (!Number.isNaN(idx)) setActiveSong(idx);
  }
});

// ---- teleprompter prev/next ----
btnPrevSong?.addEventListener("click", prevSong);
btnNextSong?.addEventListener("click", nextSong);

// Swipe support on teleprompter
(function enableSwipe() {
  if (!elTeleprompter) return;
  let startX = 0, startY = 0;

  elTeleprompter.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
  }, { passive: true });

  elTeleprompter.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;

    if (dx < 0) nextSong(); else prevSong();
  }, { passive: true });
})();

// ---- stage mode ----
function setStageMode(on) {
  if (on) document.documentElement.classList.add("stage-mode");
  else document.documentElement.classList.remove("stage-mode");
  localStorage.setItem("stageMode", on ? "1" : "0");
}
btnStage?.addEventListener("click", () => {
  const on = !document.documentElement.classList.contains("stage-mode");
  setStageMode(on);
});

// ---- saving multiple sets ----
const SETS_KEY = "alansChordAppSavedSets_v1";

function loadSavedSets() {
  try {
    const raw = localStorage.getItem(SETS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return (obj && typeof obj === "object") ? obj : {};
  } catch {
    return {};
  }
}
function saveSavedSets(obj) {
  localStorage.setItem(SETS_KEY, JSON.stringify(obj));
}
function refreshSavedSetsDropdown() {
  if (!elSavedSets) return;
  const sets = loadSavedSets();
  const names = Object.keys(sets).sort((a,b)=>a.localeCompare(b));
  elSavedSets.innerHTML = names.length
    ? names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("")
    : `<option value="">(no saved sets)</option>`;
}

btnSaveSet?.addEventListener("click", () => {
  const name = (elSetName?.value || "").trim();
  if (!name) { alert("Give your set a name first."); return; }
  if (!currentSet.length) { alert("Your current set is empty."); return; }

  const sets = loadSavedSets();
  sets[name] = currentSet.map(s => s.id);
  saveSavedSets(sets);
  refreshSavedSetsDropdown();
  alert("Saved!");
});

btnLoadSet?.addEventListener("click", () => {
  const name = elSavedSets?.value;
  if (!name) return;

  const sets = loadSavedSets();
  const ids = sets[name] || [];
  currentSet = ids.map(id => songs.find(s => s.id === id)).filter(Boolean);

  activeSetIndex = currentSet.length ? 0 : -1;
  renderSet();
});

btnDeleteSet?.addEventListener("click", () => {
  const name = elSavedSets?.value;
  if (!name) return;

  const sets = loadSavedSets();
  delete sets[name];
  saveSavedSets(sets);
  refreshSavedSetsDropdown();
});

btnClearSet?.addEventListener("click", () => {
  currentSet = [];
  activeSetIndex = -1;
  renderSet();
});

// ---- smart 90-min set builder (15 songs) ----
function buildSmartSet() {
  const q = (elSearch?.value || "").toLowerCase().trim();
  const era = elEra?.value || "all";
  const artist = elArtist?.value || "all";
  const tag = elTag?.value || "all";

  let pool = songs.filter(s => {
    const matchesQ =
      !q ||
      (s.title || "").toLowerCase().includes(q) ||
      (s.artist || "").toLowerCase().includes(q);

    const matchesEra = (era === "all") || (s.era === era);
    const matchesArtist = (artist === "all") || (s.artist === artist);

    const tags = Array.isArray(s.tags) ? s.tags : [];
    const matchesTag = (tag === "all") || tags.includes(tag);

    return matchesQ && matchesEra && matchesArtist && matchesTag;
  });

  pool.sort((a,b)=>(b.popularity||0)-(a.popularity||0));

  const byEnergy = (n) => pool.filter(s => (s.energy||0) === n);
  const pickUnique = (arr, count, out) => {
    for (const s of arr) {
      if (out.length >= count) break;
      if (!out.some(x => x.id === s.id)) out.push(s);
    }
  };

  const set = [];
  pickUnique(byEnergy(3), 4, set);
  pickUnique(byEnergy(4), 5, set);
  pickUnique(byEnergy(5), 4, set);
  pickUnique(byEnergy(4), 1, set);
  pickUnique(byEnergy(5), 1, set);

  for (const s of pool) {
    if (set.length >= 15) break;
    if (!set.some(x => x.id === s.id)) set.push(s);
  }

  currentSet = set.slice(0, 15);
  activeSetIndex = currentSet.length ? 0 : -1;
  renderSet();
}
btnBuild?.addEventListener("click", buildSmartSet);

// ---- hook up filters ----
elSearch?.addEventListener("input", applyFilters);
elEra?.addEventListener("change", applyFilters);
elArtist?.addEventListener("change", applyFilters);
elTag?.addEventListener("change", applyFilters);
elSort?.addEventListener("change", applyFilters);

//
// ✅ GUITAR TUNER (Web Audio pitch detection)
//
let tunerAudioCtx = null;
let tunerAnalyser = null;
let tunerSource = null;
let tunerStream = null;
let tunerRAF = null;
let tunerBuf = null;

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function freqToMidi(f) {
  return Math.round(69 + 12 * Math.log2(f / 440));
}
function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}
function midiToName(m) {
  const n = NOTE_NAMES[(m % 12 + 12) % 12];
  const octave = Math.floor(m / 12) - 1;
  return `${n}${octave}`;
}
function centsOff(f, targetF) {
  return 1200 * Math.log2(f / targetF);
}

// Autocorrelation pitch detection (good enough for guitar)
function autoCorrelate(buffer, sampleRate) {
  // Remove DC offset
  let mean = 0;
  for (let i = 0; i < buffer.length; i++) mean += buffer[i];
  mean /= buffer.length;
  for (let i = 0; i < buffer.length; i++) buffer[i] -= mean;

  // RMS to check signal
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.01) return -1; // too quiet

  // Autocorrelation
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorr = 0;

  for (let offset = 20; offset < MAX_SAMPLES; offset++) {
    let corr = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      corr += buffer[i] * buffer[i + offset];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestOffset = offset;
    }
  }

  if (bestOffset === -1) return -1;
  const freq = sampleRate / bestOffset;
  if (freq < 60 || freq > 1200) return -1;
  return freq;
}

function drawTunerMeter(cents) {
  if (!tunerCtx || !tunerCanvas) return;

  const w = tunerCanvas.width;
  const h = tunerCanvas.height;
  tunerCtx.clearRect(0, 0, w, h);

  // background
  tunerCtx.fillStyle = "rgba(0,0,0,0.25)";
  tunerCtx.fillRect(0, 0, w, h);

  // center line
  const cx = w / 2;
  tunerCtx.strokeStyle = "rgba(255,255,255,0.35)";
  tunerCtx.lineWidth = 2;
  tunerCtx.beginPath();
  tunerCtx.moveTo(cx, 12);
  tunerCtx.lineTo(cx, h - 12);
  tunerCtx.stroke();

  // ticks
  tunerCtx.strokeStyle = "rgba(255,255,255,0.20)";
  tunerCtx.lineWidth = 1;
  for (let t = -50; t <= 50; t += 10) {
    const x = cx + (t / 50) * (w * 0.40);
    tunerCtx.beginPath();
    tunerCtx.moveTo(x, h - 34);
    tunerCtx.lineTo(x, h - 18);
    tunerCtx.stroke();
  }

  // clamp cents to [-50..50] for needle
  const c = Math.max(-50, Math.min(50, cents));
  const x = cx + (c / 50) * (w * 0.40);

  // needle color: on-pitch = green-ish, otherwise white
  const onPitch = Math.abs(cents) <= 5;
  tunerCtx.strokeStyle = onPitch ? "rgba(29,185,84,0.95)" : "rgba(255,255,255,0.85)";
  tunerCtx.lineWidth = 4;

  tunerCtx.beginPath();
  tunerCtx.moveTo(x, 18);
  tunerCtx.lineTo(x, h - 44);
  tunerCtx.stroke();

  // labels
  tunerCtx.fillStyle = "rgba(255,255,255,0.65)";
  tunerCtx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  tunerCtx.fillText("Flat (tune up)", 16, h - 14);
  const txt = "Sharp (tune down)";
  const tw = tunerCtx.measureText(txt).width;
  tunerCtx.fillText(txt, w - tw - 16, h - 14);

  // on pitch text
  if (onPitch) {
    tunerCtx.fillStyle = "rgba(29,185,84,0.95)";
    tunerCtx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const ok = "ON PITCH";
    const okW = tunerCtx.measureText(ok).width;
    tunerCtx.fillText(ok, cx - okW/2, 26);
  }
}

function tunerLoop() {
  if (!tunerAnalyser || !tunerAudioCtx || !tunerBuf) return;

  tunerAnalyser.getFloatTimeDomainData(tunerBuf);
  const f = autoCorrelate(tunerBuf, tunerAudioCtx.sampleRate);

  if (f > 0) {
    const midi = freqToMidi(f);
    const target = midiToFreq(midi);
    const cents = centsOff(f, target);

    if (elTunerNote) elTunerNote.textContent = midiToName(midi);
    if (elTunerFreq) elTunerFreq.textContent = `${f.toFixed(1)} Hz`;
    if (elTunerCents) elTunerCents.textContent = `${cents.toFixed(1)} cents`;
    if (elTunerHint) elTunerHint.textContent = Math.abs(cents) <= 5 ? "✅ On pitch" : (cents < 0 ? "⬅ Flat: tune up" : "➡ Sharp: tune down");

    drawTunerMeter(cents);
  } else {
    if (elTunerNote) elTunerNote.textContent = "—";
    if (elTunerFreq) elTunerFreq.textContent = "— Hz";
    if (elTunerCents) elTunerCents.textContent = "— cents";
    if (elTunerHint) elTunerHint.textContent = "Play a single string clearly…";
    drawTunerMeter(0);
  }

  tunerRAF = requestAnimationFrame(tunerLoop);
}

async function startTuner() {
  try {
    if (elTunerHint) elTunerHint.textContent = "Requesting microphone…";

    tunerStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });

    tunerAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    tunerAnalyser = tunerAudioCtx.createAnalyser();
    tunerAnalyser.fftSize = 2048;

    tunerSource = tunerAudioCtx.createMediaStreamSource(tunerStream);
    tunerSource.connect(tunerAnalyser);

    tunerBuf = new Float32Array(tunerAnalyser.fftSize);

    if (elTunerHint) elTunerHint.textContent = "Tuner running. Pluck one string.";
    if (tunerRAF) cancelAnimationFrame(tunerRAF);
    tunerLoop();
  } catch (err) {
    if (elTunerHint) elTunerHint.textContent = "Mic blocked. Enable microphone permission in Safari settings.";
  }
}

function stopTuner() {
  if (tunerRAF) cancelAnimationFrame(tunerRAF);
  tunerRAF = null;

  if (tunerStream) {
    tunerStream.getTracks().forEach(t => t.stop());
    tunerStream = null;
  }

  if (tunerAudioCtx) {
    tunerAudioCtx.close?.();
    tunerAudioCtx = null;
  }

  tunerAnalyser = null;
  tunerSource = null;
  tunerBuf = null;

  if (elTunerHint) elTunerHint.textContent = "Stopped.";
  if (elTunerNote) elTunerNote.textContent = "—";
  if (elTunerFreq) elTunerFreq.textContent = "— Hz";
  if (elTunerCents) elTunerCents.textContent = "— cents";
  drawTunerMeter(0);
}

btnTunerStart?.addEventListener("click", startTuner);
btnTunerStop?.addEventListener("click", stopTuner);

// ---- boot ----
(function init() {
  setStageMode(localStorage.getItem("stageMode") === "1");
  refreshSavedSetsDropdown();
  renderSet();
  updateSongCounter(0);

  // IMPORTANT: Ensure these files exist in your repo root, with exact names:
  const FILES = [
    "songs.json",
    "songs_extra_200_real_titles.json",
    "oasis_50_with_links.json"
  ];

  Promise.allSettled(FILES.map(f =>
    fetch(f + "?v=" + Date.now()).then(r => r.ok ? r.json() : [])
  ))
  .then(results => {
    songs = results.flatMap(x => (x.status === "fulfilled" ? x.value : []));

    // De-dup by id (keep first)
    const seen = new Set();
    songs = songs.filter(s => {
      const id = String(s.id || "");
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    populateArtistFilter();
    applyFilters();
  })
  .catch(err => showError(err.message));

  // initial tuner meter
  drawTunerMeter(0);
})();
