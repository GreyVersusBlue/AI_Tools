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
    compassPos: null, locatorPos: null,
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
  if (Array.isArray(p.markers)) {
    p.markers = p.markers.map(m => ({ color: "blue", size: "medium", ...m }));
  }
  return p;
}

function blankWorkspace() {
  const id = newId();
  return { __v: VERSION, activeId: id, projects: [{ id, name: "My Map", updatedAt: Date.now(), data: blankProjectData() }] };
}

function isValidWorkspace(w) {
  return !!w && typeof w === "object" && w.__v === VERSION
    && typeof w.activeId === "string" && Array.isArray(w.projects) && w.projects.length > 0;
}

function normalizeWorkspace(w) {
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
  return { __v: VERSION, activeId: id, projects: [{ id, name: "My Map", updatedAt: Date.now(), data }] };
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

  return {
    getActiveProject, setActiveProject, listProjects, getActiveId,
    createProject, switchProject, renameProject, deleteProject,
    get isMemoryOnly() { return blocked; },
  };
}
