// bmg-label-sets.js — reusable place lists ("the 13 colonies", "the 50
// states", "the countries of Europe") that can be dropped onto any
// *calibrated* map in one click, instead of retyping the same labels for
// every new map of the same region.
//
// A set is just a name plus a list of [place name, latitude, longitude]
// triples, which is exactly the shape the existing batch-place-from-
// coordinates flow already consumes (see parseCoordLine() in
// blank-map-generator.html) — so placing a set reuses fromLatLon() and the
// same calibration math the lat/long readout, grid, and measuring tool all
// share. Nothing here knows about any particular map image.
//
// The coordinates below are deliberately *approximate label anchors*, not
// survey points: for an area (a state, a country, an ocean) they aim at a
// spot inside it where a label reads well, roughly the visual centroid.
// They are meant to land a label in the right place on a classroom wall
// map, not to locate a point feature. Anything that lands badly on a
// particular map's projection is a normal drag away from where it should
// be, and a teacher can save their corrected version back as a custom set
// (see the workspace's own saved sets in bmg-store.js).

/** Compact [name, lat, lon] triples -> {name, lat, lon} objects, so the data below stays readable at a glance. */
function places(rows) {
  return rows.map(([name, lat, lon]) => ({ name, lat, lon }));
}

export const BUILT_IN_LABEL_SETS = [
  {
    key: "continents-oceans",
    name: "Continents & oceans",
    hint: "The seven continents plus the five oceans — the first world-map labeling activity of most years.",
    places: places([
      ["North America", 45, -100], ["South America", -15, -60], ["Europe", 50, 15],
      ["Africa", 2, 20], ["Asia", 45, 90], ["Australia", -25, 134], ["Antarctica", -78, 20],
      ["Pacific Ocean", 0, -150], ["Atlantic Ocean", 10, -30], ["Indian Ocean", -20, 75],
      ["Arctic Ocean", 80, 0], ["Southern Ocean", -60, 90],
    ]),
  },
  {
    key: "thirteen-colonies",
    name: "The Thirteen Colonies",
    hint: "The original thirteen British colonies, north to south.",
    places: places([
      ["New Hampshire", 43.6, -71.6], ["Massachusetts", 42.3, -71.8], ["Rhode Island", 41.7, -71.5],
      ["Connecticut", 41.6, -72.7], ["New York", 42.9, -75.5], ["New Jersey", 40.2, -74.7],
      ["Pennsylvania", 40.9, -77.6], ["Delaware", 39.0, -75.5], ["Maryland", 39.0, -76.8],
      ["Virginia", 37.5, -78.6], ["North Carolina", 35.6, -79.4], ["South Carolina", 33.9, -80.9],
      ["Georgia", 32.7, -83.4],
    ]),
  },
  {
    key: "us-states",
    name: "The 50 United States",
    hint: "All fifty states. Alaska and Hawaii sit at their true coordinates, so on a map that shows them in inset boxes they will need dragging.",
    places: places([
      ["Alabama", 32.8, -86.8], ["Alaska", 64.0, -152.0], ["Arizona", 34.3, -111.7], ["Arkansas", 34.9, -92.4],
      ["California", 37.2, -119.5], ["Colorado", 39.0, -105.5], ["Connecticut", 41.6, -72.7], ["Delaware", 39.0, -75.5],
      ["Florida", 28.6, -82.4], ["Georgia", 32.7, -83.4], ["Hawaii", 20.3, -156.4], ["Idaho", 44.4, -114.6],
      ["Illinois", 40.0, -89.2], ["Indiana", 39.9, -86.3], ["Iowa", 42.0, -93.5], ["Kansas", 38.5, -98.4],
      ["Kentucky", 37.5, -85.3], ["Louisiana", 31.0, -92.0], ["Maine", 45.4, -69.2], ["Maryland", 39.0, -76.8],
      ["Massachusetts", 42.3, -71.8], ["Michigan", 44.3, -85.4], ["Minnesota", 46.3, -94.3], ["Mississippi", 32.7, -89.7],
      ["Missouri", 38.4, -92.5], ["Montana", 47.0, -109.6], ["Nebraska", 41.5, -99.8], ["Nevada", 39.3, -116.6],
      ["New Hampshire", 43.6, -71.6], ["New Jersey", 40.2, -74.7], ["New Mexico", 34.4, -106.1], ["New York", 42.9, -75.5],
      ["North Carolina", 35.6, -79.4], ["North Dakota", 47.4, -100.5], ["Ohio", 40.3, -82.8], ["Oklahoma", 35.6, -97.5],
      ["Oregon", 43.9, -120.6], ["Pennsylvania", 40.9, -77.6], ["Rhode Island", 41.7, -71.5], ["South Carolina", 33.9, -80.9],
      ["South Dakota", 44.4, -100.2], ["Tennessee", 35.8, -86.4], ["Texas", 31.5, -99.3], ["Utah", 39.3, -111.7],
      ["Vermont", 44.1, -72.7], ["Virginia", 37.5, -78.6], ["Washington", 47.4, -120.5], ["West Virginia", 38.6, -80.6],
      ["Wisconsin", 44.6, -89.7], ["Wyoming", 43.0, -107.5],
    ]),
  },
  {
    key: "europe-countries",
    name: "Countries of Europe",
    hint: "Present-day European countries. Several of the microstates sit almost on top of their neighbours at continent scale.",
    places: places([
      ["Albania", 41.0, 20.0], ["Andorra", 42.5, 1.5], ["Austria", 47.6, 14.1], ["Belarus", 53.7, 28.0],
      ["Belgium", 50.6, 4.6], ["Bosnia and Herzegovina", 44.0, 17.8], ["Bulgaria", 42.7, 25.3], ["Croatia", 45.3, 16.4],
      ["Czech Republic", 49.8, 15.4], ["Denmark", 56.1, 9.5], ["Estonia", 58.7, 25.5], ["Finland", 64.5, 26.5],
      ["France", 46.5, 2.4], ["Germany", 51.1, 10.4], ["Greece", 39.0, 22.5], ["Hungary", 47.1, 19.4],
      ["Iceland", 64.9, -18.6], ["Ireland", 53.2, -8.0], ["Italy", 42.8, 12.6], ["Kosovo", 42.6, 20.9],
      ["Latvia", 56.9, 24.9], ["Lithuania", 55.3, 23.9], ["Luxembourg", 49.8, 6.1], ["Malta", 35.9, 14.4],
      ["Moldova", 47.2, 28.5], ["Montenegro", 42.8, 19.3], ["Netherlands", 52.2, 5.5], ["North Macedonia", 41.6, 21.7],
      ["Norway", 61.0, 9.0], ["Poland", 52.1, 19.4], ["Portugal", 39.6, -8.0], ["Romania", 45.9, 25.0],
      ["Russia", 56.0, 38.0], ["Serbia", 44.2, 20.8], ["Slovakia", 48.7, 19.5], ["Slovenia", 46.1, 14.8],
      ["Spain", 40.2, -3.6], ["Sweden", 62.2, 15.3], ["Switzerland", 46.8, 8.2], ["Ukraine", 48.8, 31.2],
      ["United Kingdom", 54.2, -3.0],
    ]),
  },
  {
    key: "africa-countries",
    name: "Countries of Africa",
    hint: "All present-day African countries, including the island nations.",
    places: places([
      ["Algeria", 28.0, 2.6], ["Angola", -12.3, 17.5], ["Benin", 9.6, 2.3], ["Botswana", -22.2, 23.8],
      ["Burkina Faso", 12.3, -1.6], ["Burundi", -3.4, 29.9], ["Cabo Verde", 16.0, -24.0], ["Cameroon", 5.7, 12.7],
      ["Central African Republic", 6.6, 20.9], ["Chad", 15.4, 18.7], ["Comoros", -11.7, 43.4],
      ["Democratic Republic of the Congo", -2.9, 23.6], ["Republic of the Congo", -0.7, 15.8], ["Djibouti", 11.8, 42.6],
      ["Egypt", 26.8, 30.0], ["Equatorial Guinea", 1.6, 10.5], ["Eritrea", 15.3, 38.9], ["Eswatini", -26.5, 31.5],
      ["Ethiopia", 9.1, 40.0], ["Gabon", -0.6, 11.8], ["Gambia", 13.4, -15.4], ["Ghana", 7.9, -1.0],
      ["Guinea", 10.4, -11.0], ["Guinea-Bissau", 12.0, -15.0], ["Ivory Coast", 7.6, -5.5], ["Kenya", 0.2, 37.9],
      ["Lesotho", -29.6, 28.2], ["Liberia", 6.4, -9.4], ["Libya", 26.3, 17.2], ["Madagascar", -19.4, 46.7],
      ["Malawi", -13.2, 34.3], ["Mali", 17.6, -4.0], ["Mauritania", 20.3, -10.4], ["Mauritius", -20.3, 57.6],
      ["Morocco", 31.8, -6.5], ["Mozambique", -18.2, 35.5], ["Namibia", -22.1, 17.2], ["Niger", 17.6, 8.1],
      ["Nigeria", 9.1, 8.7], ["Rwanda", -1.9, 29.9], ["Sao Tome and Principe", 0.3, 6.6], ["Senegal", 14.5, -14.5],
      ["Seychelles", -4.6, 55.5], ["Sierra Leone", 8.5, -11.8], ["Somalia", 5.2, 46.2], ["South Africa", -29.0, 25.1],
      ["South Sudan", 7.3, 30.3], ["Sudan", 15.6, 30.2], ["Tanzania", -6.4, 34.9], ["Togo", 8.6, 0.8],
      ["Tunisia", 34.1, 9.6], ["Uganda", 1.4, 32.3], ["Zambia", -13.5, 27.9], ["Zimbabwe", -19.0, 29.8],
    ]),
  },
  {
    key: "south-america-countries",
    name: "Countries of South America",
    hint: "The twelve South American countries, plus French Guiana.",
    places: places([
      ["Argentina", -35.5, -65.0], ["Bolivia", -16.7, -64.7], ["Brazil", -10.3, -52.0], ["Chile", -35.0, -71.0],
      ["Colombia", 4.0, -73.0], ["Ecuador", -1.4, -78.5], ["French Guiana", 4.0, -53.0], ["Guyana", 5.0, -58.9],
      ["Paraguay", -23.3, -58.0], ["Peru", -9.5, -75.0], ["Suriname", 4.1, -55.9], ["Uruguay", -32.8, -56.0],
      ["Venezuela", 7.1, -66.0],
    ]),
  },
  {
    key: "world-physical",
    name: "World physical features",
    hint: "Mountain ranges, deserts, rivers and seas that show up on most physical-geography units.",
    places: places([
      ["Rocky Mountains", 44.0, -110.0], ["Appalachian Mountains", 37.5, -81.5], ["Andes Mountains", -20.0, -68.0],
      ["Amazon River", -3.0, -60.0], ["Mississippi River", 35.0, -90.5], ["Nile River", 24.0, 32.9],
      ["Congo River", -1.5, 18.0], ["Sahara Desert", 23.0, 12.0], ["Kalahari Desert", -23.5, 21.5],
      ["Gobi Desert", 43.0, 105.0], ["Himalayas", 29.0, 84.0], ["Ural Mountains", 60.0, 59.0],
      ["Alps", 46.5, 10.0], ["Great Lakes", 45.5, -84.5], ["Mediterranean Sea", 35.5, 18.0],
      ["Caribbean Sea", 15.0, -75.0], ["Red Sea", 20.0, 38.5], ["Persian Gulf", 27.0, 51.0],
      ["Bay of Bengal", 15.0, 88.0], ["Yangtze River", 30.5, 112.0],
    ]),
  },
];

/** Looks up a built-in set by key. */
export function findBuiltInSet(key) {
  return BUILT_IN_LABEL_SETS.find(s => s.key === key) || null;
}

/** True if `places` is a usable list of {name, lat, lon} — used to validate a custom set before saving or applying it. */
export function isValidPlaceList(list) {
  return Array.isArray(list) && list.length > 0 && list.every(p =>
    p && typeof p.name === "string" && p.name.trim() && Number.isFinite(p.lat) && Number.isFinite(p.lon));
}
