// Gig Builder (filters + chords + set builder + save/load + stage mode)
// Works with the index.html I gave you (eraFilter/tagFilter/sortBy/etc.)

let songs = [];
let currentSet = [];

// ---- DOM ----
const elArtist = document.getElementById("artistFilter");
const elSongList   = document.getElementById("songList");
const elSearch     = document.getElementById("search");
const era = elEra.value;
const artist = elArtist.value;
const tag = elTag.value;
const elSort       = document.getElementById("sortBy");

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

// ---- library rendering ----
function renderSongs(list) {
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
  elCurrentSet.innerHTML = currentSet.map((s, i) => `
    <li>
      <strong>${i+1}.</strong> ${esc(s.title)} - ${esc(s.artist)}
      <span class="small"> (Key ${esc(s.key)}, Capo ${esc(s.capo)})</span>
      <button class="btn btn-secondary btn-remove" data-index="${i}" style="float:right;">Remove</button>
    </li>
  `).join("");
}

// ---- filters + sorting ----
function applyFilters() {
  function populateArtistFilter() {
  const artists = [...new Set(songs.map(s => s.artist))].sort();
  elArtist.innerHTML = `
    <option value="all">All Artists</option>
    ${artists.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join("")}
  `;
}
  const q = (elSearch.value || "").toLowerCase().trim();
  const era = elEra.value;
  const tag = elTag.value;

  let list = songs.filter(s => {
    const matchesQ =
      !q ||
      (s.title || "").toLowerCase().includes(q) ||
      (s.artist || "").toLowerCase().includes(q);

    const matchesEra = (era === "all") || (s.era === era);

    const tags = Array.isArray(s.tags) ? s.tags : [];
    const matchesTag = (tag === "all") || tags.includes(tag);

    return matchesQ && matchesEra && matchesTag;
  });

  const sort = elSort.value;
  if (sort === "popularityDesc") list.sort((a,b)=>(b.popularity||0)-(a.popularity||0));
  if (sort === "popularityAsc")  list.sort((a,b)=>(a.popularity||0)-(b.popularity||0));
  if (sort === "energyAsc")      list.sort((a,b)=>(a.energy||0)-(b.energy||0));
  if (sort === "energyDesc")     list.sort((a,b)=>(b.energy||0)-(a.energy||0));

  renderSongs(list);
}

// ---- library click handling (reliable on iOS) ----
elSongList.addEventListener("click", (e) => {
  const addBtn = e.target.closest(".btn-add");
  const chordBtn = e.target.closest(".btn-chords");

  if (addBtn) {
    const id = addBtn.getAttribute("data-songid");
    const song = songs.find(s => String(s.id) === String(id));
    if (!song) return;

    // prevent duplicates (remove this block if you want repeats)
    if (currentSet.some(x => x.id === song.id)) return;

    currentSet.push(song);
    renderSet();
    return;
  }

  if (chordBtn) {
    const id = chordBtn.getAttribute("data-songid");

    // auto-close others
    document.querySelectorAll(".chords").forEach(p => p.style.display = "none");
    document.querySelectorAll(".btn-chords").forEach(b => b.textContent = "📄 View Chords");

    const panel = document.getElementById("chords-" + id);
    if (!panel) return;

    panel.style.display = "block";
    chordBtn.textContent = "📄 Hide Chords";
  }
});

// ---- remove from set ----
elCurrentSet.addEventListener("click", (e) => {
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
btnStage.addEventListener("click", () => {
  const on = !document.documentElement.classList.contains("stage-mode");
  setStageMode(on);
});

// ---- saving multiple sets ----
const SETS_KEY = "gigBuilderSavedSets_v1";

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
  const sets = loadSavedSets();
  const names = Object.keys(sets).sort((a,b)=>a.localeCompare(b));
  elSavedSets.innerHTML = names.length
    ? names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("")
    : `<option value="">(no saved sets)</option>`;
}

btnSaveSet.addEventListener("click", () => {
  const name = (elSetName.value || "").trim();
  if (!name) { alert("Give your set a name first."); return; }
  if (!currentSet.length) { alert("Your current set is empty."); return; }

  const sets = loadSavedSets();
  sets[name] = currentSet.map(s => s.id); // store IDs only
  saveSavedSets(sets);
  refreshSavedSetsDropdown();
  alert("Saved!");
});

btnLoadSet.addEventListener("click", () => {
  const name = elSavedSets.value;
  if (!name) return;

  const sets = loadSavedSets();
  const ids = sets[name] || [];
  currentSet = ids.map(id => songs.find(s => s.id === id)).filter(Boolean);
  renderSet();
});

btnDeleteSet.addEventListener("click", () => {
  const name = elSavedSets.value;
  if (!name) return;

  const sets = loadSavedSets();
  delete sets[name];
  saveSavedSets(sets);
  refreshSavedSetsDropdown();
});

btnClearSet.addEventListener("click", () => {
  currentSet = [];
  renderSet();
});

// ---- smart 90-min set builder ----
// 90 mins ~ 15 songs. Respects current filters (search/era/tag).
function buildSmartSet() {
  const q = (elSearch.value || "").toLowerCase().trim();
  const era = elEra.value;
  const tag = elTag.value;

  let pool = songs.filter(s => {
    const matchesQ =
      !q ||
      (s.title || "").toLowerCase().includes(q) ||
      (s.artist || "").toLowerCase().includes(q);

    const matchesEra = (era === "all") || (s.era === era);
    const tags = Array.isArray(s.tags) ? s.tags : [];
    const matchesTag = (tag === "all") || tags.includes(tag);

    return matchesQ && matchesEra && matchesTag;
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

  // fallback if not enough exact-energy songs
  for (const s of pool) {
    if (set.length >= 15) break;
    if (!set.some(x => x.id === s.id)) set.push(s);
  }

  currentSet = set.slice(0, 15);
  renderSet();
}
btnBuild.addEventListener("click", buildSmartSet);

// ---- hook up filters ----
elSearch.addEventListener("input", applyFilters);
elEra.addEventListener("change", applyFilters);
elTag.addEventListener("change", applyFilters);
elSort.addEventListener("change", applyFilters);

// ---- boot ----
(function init() {
  setStageMode(localStorage.getItem("stageMode") === "1");
  refreshSavedSetsDropdown();
  renderSet();

  // cache-busted fetch (important on iPad)
  fetch("songs.json?v=" + Date.now())
    .then(res => {
      if (!res.ok) throw new Error("Failed to load songs.json (" + res.status + ")");
      return res.json();
    })
    .then(data => {
      songs = Array.isArray(data) ? data : [];
      applyFilters();
      refreshSavedSetsDropdown();
    })
    .catch(err => {
      elSongList.innerHTML = `
        <div class="song">
          <h3>Couldn’t load songs</h3>
          <p>${esc(err.message)}</p>
        </div>
      `;
    });
})();
