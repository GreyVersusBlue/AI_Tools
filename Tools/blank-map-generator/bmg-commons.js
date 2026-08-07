// bmg-commons.js — search and fetch map images from Wikimedia Commons.
//
// The MediaWiki API is CORS-open for anonymous requests when called with
// `origin=*` (https://www.mediawiki.org/wiki/API:Cross-site_requests), and
// the actual file bytes are served from upload.wikimedia.org, which sends
// permissive CORS headers on public files. No API key or account needed.

const API = "https://commons.wikimedia.org/w/api.php";

// Displayable in a plain <img>; excludes things like TIFF/PDF/DjVu that
// Commons also hosts under the File: namespace.
const DISPLAYABLE_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/webp"]);

function buildUrl(params) {
  const search = new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params });
  return `${API}?${search.toString()}`;
}

function stripHtml(s) {
  return s ? s.replace(/<[^>]+>/g, "").trim() : "";
}

// Matches Commons' own "Public domain" / CC0 license short names, plus the
// extmetadata Copyrighted=False flag some PD-USGov-style files use instead of
// a license name. Used by the "safe to hand out" search filter — anything
// else (including plain CC-BY, which still requires attribution) is excluded.
function isSafeToHandOut(meta) {
  if (meta.Copyrighted?.value === "False") return true;
  const name = (meta.LicenseShortName?.value || "").toLowerCase();
  return /public domain|^pd[\s-]|cc0/.test(name);
}

/**
 * Searches Commons file pages by keyword. Returns thumbnail-sized results
 * suitable for a picker grid; call fetchMapImage() to get the full image.
 *
 * `continueParams` re-issues the same search starting after a previous
 * page's results — pass back the `continueParams` field from the prior
 * call's return value verbatim (MediaWiki's search continuation needs every
 * field it hands back, not just an offset number).
 */
export async function searchMaps(query, { limit = 12, publicDomainOnly = false, continueParams = null } = {}) {
  // publicDomainOnly filters client-side after the fetch, so over-fetch a
  // few pages' worth of raw results to still land near `limit` matches.
  const rawLimit = publicDomainOnly ? limit * 4 : limit;
  const url = buildUrl({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: String(rawLimit),
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "320",
    ...continueParams,
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Commons search failed (HTTP ${res.status})`);
  const data = await res.json();
  const pages = data?.query?.pages || [];
  let results = pages
    .filter(p => p.imageinfo?.[0] && DISPLAYABLE_MIME.has(p.imageinfo[0].mime))
    .map(p => {
      const info = p.imageinfo[0];
      const meta = info.extmetadata || {};
      return {
        id: p.title,
        title: p.title.replace(/^File:/, "").replace(/\.[a-zA-Z0-9]+$/, ""),
        thumbUrl: info.thumburl || info.url,
        fullUrl: info.url,
        width: info.width,
        height: info.height,
        mime: info.mime,
        descriptionUrl: info.descriptionshorturl || info.descriptionurl,
        artist: stripHtml(meta.Artist?.value),
        license: meta.LicenseShortName?.value || "License on file page",
        licenseUrl: meta.LicenseUrl?.value || null,
        safeToHandOut: isSafeToHandOut(meta),
      };
    });
  if (publicDomainOnly) results = results.filter(r => r.safeToHandOut);
  return { results: results.slice(0, limit), continueParams: data.continue || null };
}

/**
 * Resolves a continent/country pick (see bmg-geography.js) to actual
 * Commons results. Tries a category-scoped search first — `incategory:"…"`
 * is a plain CirrusSearch operator, so this reuses searchMaps() as-is
 * rather than a separate categorymembers call — and falls back to an
 * ordinary keyword search over the place's name if that comes up empty.
 * The category name is a best-effort guess (see bmg-geography.js's own
 * comment on why), so a wrong or missing guess just quietly degrades to
 * the same search a typed-in place name would already get, rather than
 * dead-ending the picker.
 */
export async function searchByRegion(region, opts = {}) {
  if (region.category) {
    const catQuery = `incategory:"${region.category}"`;
    const catResult = await searchMaps(catQuery, opts);
    if (catResult.results.length > 0) return { ...catResult, query: catQuery, usedCategory: true };
  }
  const fallbackQuery = `${region.name} blank map`;
  const kwResult = await searchMaps(fallbackQuery, opts);
  return { ...kwResult, query: fallbackQuery, usedCategory: false };
}

/** Downloads the full-resolution image for a search result. */
export async function fetchMapImage(result) {
  const res = await fetch(result.fullUrl);
  if (!res.ok) throw new Error(`Map download failed (HTTP ${res.status})`);
  const blob = await res.blob();
  return {
    id: result.id,
    title: result.title,
    blob,
    mime: result.mime,
    width: result.width,
    height: result.height,
    attribution: {
      artist: result.artist,
      license: result.license,
      licenseUrl: result.licenseUrl,
      descriptionUrl: result.descriptionUrl,
    },
    cachedAt: Date.now(),
  };
}
