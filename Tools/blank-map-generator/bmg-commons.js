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

/**
 * Searches Commons file pages by keyword. Returns thumbnail-sized results
 * suitable for a picker grid; call fetchMapImage() to get the full image.
 */
export async function searchMaps(query, limit = 12) {
  const url = buildUrl({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "320",
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Commons search failed (HTTP ${res.status})`);
  const data = await res.json();
  const pages = data?.query?.pages || [];
  return pages
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
      };
    });
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
