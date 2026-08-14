// bmg-store.js — localStorage persistence for the Blank Map Generator's
// projects. A "workspace" holds any number of named projects (each with its
// own map choice, view state, labels, markers, regions, lines, legend,
// etc.) plus which one is active; creating, switching, renaming, and
// deleting projects all just mutate this one structure. normalize()
// backfills project fields added after a project's first save, so older
// saved projects don't need a version bump to pick them up.
//
// Before named projects existed, the tool kept exactly one project under
// the plain key `bmg_project_v1`. On first load under this scheme, that
// legacy single project (if present) is imported as the workspace's first
// project rather than discarded, so nobody's in-progress map is lost by
// this upgrade.

const WORKSPACE_KEY = "bmg_workspace_v1";
const LEGACY_KEY = "bmg_project_v1";
export const VERSION = 1;

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `proj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function blankProjectData() {
  return {
    __v: VERSION, mapId: null, view: { x: 0, y: 0, scale: 1 },
    labels: [], markers: [], legendText: {}, legendPos: { x: 12, y: 12 },
    regions: [], regionLegendText: {},
    lines: [], lineLegendText: {},
    compassEnabled: false, gridEnabled: false, locatorEnabled: false, calibration: null,
    compassPos: null, locatorPos: null, studentBlankMode: false,
    scaleBarEnabled: false, scaleBarUnit: "km", scaleBarPos: null,
    legendOrder: [],
    pageFormat: { type: "letter", flipped: false, customW: 4, customH: 3 },
    grayscaleSafePrint: true,
    worksheet: blankWorksheetSettings(),
    choropleth: blankChoroplethSettings(), choroLegendText: {},
  };
}

/** Data-shading settings for a built-in base map (see bmg-choropleth.js). The pasted text lives here rather than only in the textarea so a shaded map comes back shaded — and re-editable — after a reload. */
function blankChoroplethSettings() {
  return { enabled: false, text: "", classes: 5, ramp: "blues", legendRows: [] };
}

/** Defaults for the numbered-blank worksheet builder (see the worksheet section of 046-blank-map-generator.html). Saved per project so a teacher's chosen wording/layout comes back with the map it belongs to. */
function blankWorksheetSettings() {
  return {
    title: "", instructions: "Write the name of each numbered place on the lines.",
    nameLine: true, wordBank: true, answerKey: true, credit: true,
    listPlacement: "beside", versions: 1,
  };
}

function isValidProjectData(p) {
  return !!p && typeof p === "object" && p.__v === VERSION
    && p.view && typeof p.view === "object"
    && Array.isArray(p.labels) && Array.isArray(p.markers);
}

/** Backfills project-data fields added after a project was first saved (e.g. legend, calibration, regions, lines). */
function normalizeProjectData(p) {
  if (!p.legendText || typeof p.legendText !== "object") p.legendText = {};
  if (!p.legendPos || typeof p.legendPos !== "object") p.legendPos = { x: 12, y: 12 };
  if (!Array.isArray(p.regions)) p.regions = [];
  if (!p.regionLegendText || typeof p.regionLegendText !== "object") p.regionLegendText = {};
  if (!Array.isArray(p.lines)) p.lines = [];
  if (!p.lineLegendText || typeof p.lineLegendText !== "object") p.lineLegendText = {};
  if (typeof p.compassEnabled !== "boolean") p.compassEnabled = false;
  if (typeof p.gridEnabled !== "boolean") p.gridEnabled = false;
  if (typeof p.locatorEnabled !== "boolean") p.locatorEnabled = false;
  if (p.calibration !== null && typeof p.calibration !== "object") p.calibration = null;
  if (p.compassPos !== null && typeof p.compassPos !== "object") p.compassPos = null;
  if (p.locatorPos !== null && typeof p.locatorPos !== "object") p.locatorPos = null;
  if (typeof p.studentBlankMode !== "boolean") p.studentBlankMode = false;
  if (typeof p.scaleBarEnabled !== "boolean") p.scaleBarEnabled = false;
  if (p.scaleBarUnit !== "km" && p.scaleBarUnit !== "mi") p.scaleBarUnit = "km";
  if (p.scaleBarPos !== null && typeof p.scaleBarPos !== "object") p.scaleBarPos = null;
  if (!Array.isArray(p.legendOrder)) p.legendOrder = [];
  if (!p.pageFormat || typeof p.pageFormat !== "object") p.pageFormat = { type: "letter", flipped: false, customW: 4, customH: 3 };
  if (!["letter", "widescreen", "custom"].includes(p.pageFormat.type)) p.pageFormat.type = "letter";
  if (typeof p.pageFormat.flipped !== "boolean") p.pageFormat.flipped = false;
  if (!Number.isFinite(p.pageFormat.customW) || p.pageFormat.customW <= 0) p.pageFormat.customW = 4;
  if (!Number.isFinite(p.pageFormat.customH) || p.pageFormat.customH <= 0) p.pageFormat.customH = 3;
  if (typeof p.grayscaleSafePrint !== "boolean") p.grayscaleSafePrint = true;
  p.choropleth = { ...blankChoroplethSettings(), ...(p.choropleth && typeof p.choropleth === "object" ? p.choropleth : {}) };
  if (typeof p.choropleth.enabled !== "boolean") p.choropleth.enabled = false;
  if (typeof p.choropleth.text !== "string") p.choropleth.text = "";
  if (!Number.isFinite(p.choropleth.classes)) p.choropleth.classes = 5;
  p.choropleth.classes = Math.max(4, Math.min(6, Math.round(p.choropleth.classes)));
  if (typeof p.choropleth.ramp !== "string") p.choropleth.ramp = "blues";
  // The class rows are stored, not recomputed: they are the key that belongs
  // to the raster already in the map cache, so a reload shows the same map
  // with the same key without re-reading a 250 KB data file.
  if (!Array.isArray(p.choropleth.legendRows)) p.choropleth.legendRows = [];
  p.choropleth.legendRows = p.choropleth.legendRows
    .filter(r => r && typeof r.key === "string" && typeof r.hex === "string")
    .map(r => ({ key: r.key, label: String(r.label || ""), hex: r.hex }));
  if (!p.choroLegendText || typeof p.choroLegendText !== "object") p.choroLegendText = {};
  p.worksheet = { ...blankWorksheetSettings(), ...(p.worksheet && typeof p.worksheet === "object" ? p.worksheet : {}) };
  if (!["beside", "below"].includes(p.worksheet.listPlacement)) p.worksheet.listPlacement = "beside";
  if (!Number.isFinite(p.worksheet.versions) || p.worksheet.versions < 1) p.worksheet.versions = 1;
  p.worksheet.versions = Math.min(4, Math.round(p.worksheet.versions));
  if (Array.isArray(p.lines)) {
    // `type` (river / border / trade route / …) arrived after lines did —
    // older saved lines are plain custom lines with no semantic type.
    p.lines = p.lines.map(l => ({ type: null, ...l }));
  }
  if (Array.isArray(p.regions)) {
    p.regions = p.regions.map(r => ({ pattern: "solid", ...r }));
  }
  if (Array.isArray(p.markers)) {
    p.markers = p.markers.map(m => ({ color: "blue", size: "medium", ...m }));
  }
  if (Array.isArray(p.labels)) {
    p.labels = p.labels.map(l => ({ color: null, bold: false, italic: false, size: "medium", ...l }));
  }
  return p;
}

function blankWorkspace() {
  const id = newId();
  return {
    __v: VERSION, activeId: id, labelSets: [],
    projects: [{ id, name: "My Map", updatedAt: Date.now(), data: blankProjectData() }],
  };
}

function isValidWorkspace(w) {
  return !!w && typeof w === "object" && w.__v === VERSION
    && typeof w.activeId === "string" && Array.isArray(w.projects) && w.projects.length > 0;
}

function normalizeWorkspace(w) {
  // Saved label sets live on the workspace, not inside a project: the whole
  // point of a set ("the 13 colonies", "my corrected Europe labels") is that
  // it outlives the map it was built on and can be dropped onto the next
  // one. Keeping them here also means no second localStorage key to teach
  // Backup & Restore about — they ride along inside the workspace save.
  if (!Array.isArray(w.labelSets)) w.labelSets = [];
  w.labelSets = w.labelSets
    .filter(s => s && typeof s.name === "string" && Array.isArray(s.places))
    .map(s => (typeof s.id === "string" && s.id ? s : { ...s, id: newId() }));
  w.projects.forEach(entry => {
    if (typeof entry.name !== "string" || !entry.name) entry.name = "My Map";
    if (typeof entry.updatedAt !== "number") entry.updatedAt = Date.now();
    entry.data = isValidProjectData(entry.data) ? normalizeProjectData(entry.data) : blankProjectData();
  });
  if (!w.projects.some(e => e.id === w.activeId)) w.activeId = w.projects[0].id;
  return w;
}

/** Wraps a pre-named-projects single save (the old bmg_project_v1 key) into a fresh workspace, so upgrading doesn't lose it. */
function importLegacyProject(raw) {
  const parsed = JSON.parse(raw);
  const data = isValidProjectData(parsed) ? normalizeProjectData(parsed) : blankProjectData();
  const id = newId();
  return { __v: VERSION, activeId: id, labelSets: [], projects: [{ id, name: "My Map", updatedAt: Date.now(), data }] };
}

function probeBlocked() {
  try {
    localStorage.setItem("__bmg_probe__", "1");
    localStorage.removeItem("__bmg_probe__");
    return false;
  } catch (e) {
    return true;
  }
}

export function createStore() {
  const blocked = probeBlocked();
  let mem = null;

  function loadWorkspace() {
    if (blocked) return mem || blankWorkspace();
    try {
      const raw = localStorage.getItem(WORKSPACE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return isValidWorkspace(parsed) ? normalizeWorkspace(parsed) : blankWorkspace();
      }
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        try { return importLegacyProject(legacyRaw); } catch (e) { /* corrupt legacy save, fall through to blank */ }
      }
      return blankWorkspace();
    } catch (e) {
      return blankWorkspace();
    }
  }

  function saveWorkspace() {
    if (blocked) { mem = workspace; return false; }
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
      return true;
    } catch (e) {
      mem = workspace;
      return false;
    }
  }

  let workspace = loadWorkspace();
  saveWorkspace(); // persist a freshly-migrated or blank workspace immediately, not just on the next edit

  function activeEntry() {
    return workspace.projects.find(e => e.id === workspace.activeId) || workspace.projects[0];
  }

  function getActiveProject() { return activeEntry().data; }
  function getActiveId() { return workspace.activeId; }

  function setActiveProject(data) {
    const entry = activeEntry();
    entry.data = data;
    entry.updatedAt = Date.now();
    saveWorkspace();
  }

  function listProjects() {
    return workspace.projects.map(e => ({ id: e.id, name: e.name, updatedAt: e.updatedAt }));
  }

  function createProject(name) {
    const id = newId();
    workspace.projects.push({ id, name: name || "Untitled map", updatedAt: Date.now(), data: blankProjectData() });
    workspace.activeId = id;
    saveWorkspace();
    return getActiveProject();
  }

  function switchProject(id) {
    if (workspace.projects.some(e => e.id === id)) workspace.activeId = id;
    saveWorkspace();
    return getActiveProject();
  }

  function renameProject(id, name) {
    const entry = workspace.projects.find(e => e.id === id);
    if (entry && name) entry.name = name;
    saveWorkspace();
  }

  /** Imports a project exported from this tool (or another copy of it) as a new project and activates it. Returns the new project's data, or null if `data` doesn't look like a valid project (caller should show a friendly error in that case). */
  function importProject(name, data) {
    if (!isValidProjectData(data)) return null;
    const id = newId();
    workspace.projects.push({ id, name: name || "Imported map", updatedAt: Date.now(), data: normalizeProjectData(data) });
    workspace.activeId = id;
    saveWorkspace();
    return getActiveProject();
  }

  /**
   * Creates an independent copy of an existing project under a new name and
   * activates it. Every content field (labels, markers, regions, lines,
   * legend text/order, calibration, view, overlay positions, etc.) is
   * deep-cloned via a JSON round-trip — the same cheap deep-clone trick the
   * main script's own undo/redo history already relies on, and safe here
   * for the same reason: every one of those fields is plain JSON-
   * serializable data, so the clone shares no array/object with the
   * original and editing either project afterward can never mutate the
   * other. `mapId` is copied as a plain string, not cloned data — it only
   * *names* an entry in the shared, immutable offline map cache
   * (bmg-map-cache.js), so both projects legitimately and safely keep
   * pointing at the same cached map image. Returns the duplicate's data, or
   * null if `id` doesn't match any project.
   */
  function duplicateProject(id, name) {
    const source = workspace.projects.find(e => e.id === id);
    if (!source) return null;
    const dupId = newId();
    const clonedData = JSON.parse(JSON.stringify(source.data));
    workspace.projects.push({ id: dupId, name: name || `${source.name} copy`, updatedAt: Date.now(), data: clonedData });
    workspace.activeId = dupId;
    saveWorkspace();
    return getActiveProject();
  }

  /** Deletes a project; if it was active, activates another (creating a fresh one if it was the last). Returns the now-active project's data. */
  function deleteProject(id) {
    workspace.projects = workspace.projects.filter(e => e.id !== id);
    if (!workspace.projects.length) {
      const freshId = newId();
      workspace.projects.push({ id: freshId, name: "My Map", updatedAt: Date.now(), data: blankProjectData() });
      workspace.activeId = freshId;
    } else if (workspace.activeId === id) {
      workspace.activeId = workspace.projects[0].id;
    }
    saveWorkspace();
    return getActiveProject();
  }

  // --- Saved label sets (workspace-wide, shared by every project) -------

  function listLabelSets() {
    return workspace.labelSets.map(s => ({ id: s.id, name: s.name, places: s.places }));
  }

  /** Saves a named list of {name, lat, lon} places for reuse on any map. A set whose name matches an existing one replaces it (same "save over it" behavior a file dialog would give). Returns the saved set. */
  function saveLabelSet(name, places) {
    const clean = String(name || "").trim() || "Saved places";
    const existing = workspace.labelSets.find(s => s.name.toLowerCase() === clean.toLowerCase());
    const set = existing || { id: newId(), name: clean, places: [] };
    set.name = clean;
    set.places = places.map(p => ({ name: p.name, lat: p.lat, lon: p.lon }));
    set.savedAt = Date.now();
    if (!existing) workspace.labelSets.push(set);
    saveWorkspace();
    return set;
  }

  function deleteLabelSet(id) {
    workspace.labelSets = workspace.labelSets.filter(s => s.id !== id);
    saveWorkspace();
  }

  function renameLabelSet(id, name) {
    const set = workspace.labelSets.find(s => s.id === id);
    const clean = String(name || "").trim();
    if (set && clean) set.name = clean;
    saveWorkspace();
    return set || null;
  }

  /** Replaces a saved set's place list in place (the label-set editor's save path) — keeps the set's id and name, so the select stays pointed at it. */
  function updateLabelSetPlaces(id, places) {
    const set = workspace.labelSets.find(s => s.id === id);
    if (!set) return null;
    set.places = places.map(p => ({ name: p.name, lat: p.lat, lon: p.lon }));
    set.savedAt = Date.now();
    saveWorkspace();
    return set;
  }

  return {
    getActiveProject, setActiveProject, listProjects, getActiveId,
    createProject, switchProject, renameProject, deleteProject, importProject, duplicateProject,
    listLabelSets, saveLabelSet, deleteLabelSet, renameLabelSet, updateLabelSetPlaces,
    get isMemoryOnly() { return blocked; },
  };
}
