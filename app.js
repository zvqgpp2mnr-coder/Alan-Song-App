// Gig Builder (Artist filter + Era/Tag filters + Sorting + Chords view + Smart 90-min set builder
// + Save/Load multiple sets + Stage mode + Multi-JSON loading)
//
// Requires index.html IDs:
// search, eraFilter, artistFilter, tagFilter, sortBy, btnBuild, btnStage,
// songList, currentSet, setName, btnSaveSet, btnClearSet, savedSets, btnLoadSet, btnDeleteSet
//
// Loads songs from: songs.json + songs_extra_200_real_titles.json (both must exist in repo root)

let songs = [];
let transposeSteps = 0; // global semitones
let currentSet = [];

// ---- DOM ----
const elSongList   = document.getElementById("songList");
const elSearch     = document.getElementById("search");
const elEra        = document.getElementById("eraFilter");
const elArtist     = document.getElementById("artistFilter");
const elTag        = document.getElementById("tagFilter");
const elSort       = document.getElementById("sortBy");
const elSongCounter = document.getElementById("songCounter");
const btnTransposeDown = document.getElementById("transposeDown");
const btnTransposeUp = document.getElementById("transposeUp");
const elTransposeLabel = document.getElementById("transposeLabel");

const elCurrentSet = document.getElementById("currentSet");
const elSetName    = document.getElementById("setName");
const elSavedSets  = document.getElementById("savedSets");

const btnBuild     = document.getElementById("btnBuild");
const btnStage     = document.getElementById("btnStage");
const btnSaveSet   = document.getElementById("btnSaveSet");
const btnLoadSet   = document.getElementById("btnLoadSet");
const btnDeleteSet = document.getElementById("btnDeleteSet");
const btnClearSet  = document.getElementById("btnClearSet");

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
      <p class="small">Check your file names and that index.html IDs match.</p>
    </div>
  `;
}

// ---- chords rendering (Structure B) ----
const NOTE_TO_IDX = {
  "C":0, "B#":0,
  "C#":1, "Db":1,
  "D":2,
  "D#":3, "Eb":3,
  "E":4, "Fb":4,
  "F":5, "E#":5,
  "F#":6, "Gb":6,
  "G":7,
  "G#":8, "Ab":8,
  "A":9,
  "A#":10, "Bb":10,
  "B":11, "Cb":11
};
const IDX_TO_NOTE_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function clampTranspose(n){
  // keep it sane for UI
  if (n > 11) return n - 12;
  if (n < -11) return n + 12;
  return n;
}

function transposeNote(note, steps){
  const idx = NOTE_TO_IDX[note];
  if (idx === undefined) return note; // unknown, leave as-is
  const next = (idx + steps + 1200) % 12;
  return IDX_TO_NOTE_SHARP[next];
}

function transposeChord(chord, steps){
  // Handles: F#m7, Bb, Dsus4, Cadd9, G/B, etc.
  // Root note at start: [A-G][#|b]?
  const parts = String(chord).split("/");
  const main = parts[0];
  const bass = parts[1];

  const m = main.match(/^([A-G])([#b]?)(.*)$/);
  if (!m) return chord;

  const root = m[1] + (m[2] || "");
  const rest = m[3] || "";

  const newRoot = transposeNote(root, steps);
  let out = newRoot + rest;

  if (bass) {
    const bm = bass.match(/^([A-G])([#b]?)(.*)$/);
    if (bm) {
      const bassRoot = bm[1] + (bm[2] || "");
      const bassRest = bm[3] || "";
      const newBass = transposeNote(bassRoot, steps) + bassRest;
      out += "/" + newBass;
    } else {
      out += "/" + bass;
    }
  }
  return out;
}

function updateTransposeUI(){
  if (!elTransposeLabel) return;
  elTransposeLabel.textContent = `Transpose: ${transposeSteps}`;
}
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

// ---- library rendering ----
function renderSongs(list) {
  if (!elSongList) return;

  elSongList.innerHTML = list.map(song => {
    const id = esc(song.id);
    const tags = Array.isArray(song.tags) ? song.tags.join(", ") : "";
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
          <button class="btn btn-secondary btn-chords" data-songid="${id}">📄 View Chords</button>
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
    <li>
      <strong>${i+1}.</strong> ${esc(s.title)} - ${esc(s.artist)}
      <span class="small"> (Key ${esc(s.key)}, Capo ${esc(s.capo)})</span>
      <button class="btn btn-secondary btn-remove" data-index="${i}" style="float:right;">Remove</button>
    </li>
  `).join("");
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
function updateSongCounter(visibleCount) {
  if (!elSongCounter) return;
  const total = songs.length;
  elSongCounter.textContent = `Songs: ${visibleCount} showing • ${total} total`;
}
function applyFilters() {
  const q = (elSearch?.value || "").toLowerCase().trim();
  const era = elEra?.value || "all";
  const artist = elArtist?.value || "all";
  const tag = elTag?.value || "all";
  // If nothing selected and no search, show nothing
const noFiltersActive =
  !q &&
  era === "all" &&
  artist === "all" &&
  tag === "all";

if (noFiltersActive) {
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

  renderSongs(list);
  updateSongCounter(list.length);
}

// ---- library click handling (Add + Chords toggle) ----
elSongList?.addEventListener("click", (e) => {
  const addBtn = e.target.closest(".btn-add");
  const chordBtn = e.target.closest(".btn-chords");

  if (addBtn) {
    const id = addBtn.getAttribute("data-songid");
    const song = songs.find(s => String(s.id) === String(id));
    if (!song) return;

    // prevent duplicates
    if (currentSet.some(x => x.id === song.id)) return;

    currentSet.push(song);
    renderSet();
    return;
  }

  if (chordBtn) {
    const id = chordBtn.getAttribute("data-songid");
    const panel = document.getElementById("chords-" + id);
    if (!panel) return;

    const isOpen = panel.style.display !== "none";

    // toggle close if same is open
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

// ---- remove from set ----
elCurrentSet?.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-remove");
  if (!btn) return;
  const idx = Number(btn.getAttribute("data-index"));
  if (Number.isNaN(idx)) return;
  currentSet.splice(idx, 1);
  renderSet();
});

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
btnTransposeDown?.addEventListener("click", () => {
  transposeSteps = clampTranspose(transposeSteps - 1);
  updateTransposeUI();
  applyFilters(); // re-render list with new chords
});

btnTransposeUp?.addEventListener("click", () => {
  transposeSteps = clampTranspose(transposeSteps + 1);
  updateTransposeUI();
  applyFilters();
});

btnSaveSet?.addEventListener("click", () => {
  const name = (elSetName?.value || "").trim();
  if (!name) { alert("Give your set a name first."); return; }
  if (!currentSet.length) { alert("Your current set is empty."); return; }

  const sets = loadSavedSets();
  sets[name] = currentSet.map(s => s.id); // store IDs only
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
  renderSet();
});

// ---- smart 90-min set builder ----
// 90 mins ~ 15 songs. Respects current filters.
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

  // Bias toward popularity
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

  // fallback fill
  for (const s of pool) {
    if (set.length >= 15) break;
    if (!set.some(x => x.id === s.id)) set.push(s);
  }

  currentSet = set.slice(0, 15);
  renderSet();
}
btnBuild?.addEventListener("click", buildSmartSet);

// ---- hook up filters ----
elSearch?.addEventListener("input", applyFilters);
elEra?.addEventListener("change", applyFilters);
elArtist?.addEventListener("change", applyFilters);
elTag?.addEventListener("change", applyFilters);
elSort?.addEventListener("change", applyFilters);

// ---- boot ----
(function init() {
  setStageMode(localStorage.getItem("stageMode") === "1");
  refreshSavedSetsDropdown();
  renderSet();

  // Multi-JSON loader (cache-busted for iPad)
  Promise.all(["songs.json", "songs_extra_200_real_titles.json"].map(f =>
    fetch(f + "?v=" + Date.now()).then(r => {
      if (!r.ok) throw new Error(`Failed to load ${f} (${r.status})`);
      return r.json();
    })
  ))
  .then(results => {
    songs = results.flat();

    // Optional: de-dup by id (keeps first)
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
    refreshSavedSetsDropdown();
  })
  .catch(err => showError(err.message));
})();
