# Vendored base-map geometry

These four GeoJSON files are the geometry the Blank Map Generator's
**built-in base maps** are rendered from (`../bmg-vector.js`). They are
committed to the repo on purpose: the whole point of the feature is that a
teacher gets a correctly-calibrated blank map with no internet connection and
no searching, so nothing here may be fetched from a third party at runtime.

| File | Features | What it is |
|---|---|---|
| `world-land-110m.json` | 1 | World landmass, no internal boundaries |
| `world-countries-110m.json` | 177 | World countries (each carries a `name`) |
| `us-nation-10m.json` | 1 | United States national outline |
| `us-states-10m.json` | 56 | US states, DC and territories (each carries a `name`) |

Total ≈ 670 KB, uncompressed.

## Provenance

All four derive from **[Natural Earth](https://www.naturalearthdata.com/)**
(1:110m for the world, 1:10m for the US), by way of Mike Bostock's TopoJSON
builds of it published on npm:

- `world-atlas@2.0.2` → `countries-110m.json` (contains both the `countries`
  and `land` objects)
- `us-atlas@3.0.1` → `states-10m.json` (contains both the `states` and
  `nation` objects)

They were converted from TopoJSON to plain GeoJSON with
`topojson-client@3.1.0`'s `feature()` in a one-off Node script, run once and
not part of the site. The conversion also:

- keeps only a `name` property (everything else was dropped — nothing here
  needs FIPS codes or ISO ids);
- rounds coordinates to **3 decimal places** (≈110 m), which is finer than
  either source dataset's own accuracy, and drops points the rounding
  collapsed onto their neighbour;
- discards rings left with fewer than 4 positions, and re-closes any ring the
  rounding opened.

The script itself:

```js
import { feature } from 'topojson-client';
const topo = JSON.parse(readFileSync('countries-110m.json', 'utf8'));
const fc = feature(topo, topo.objects.countries);   // and .land, .states, .nation
// …round coordinates, keep only `name`, write JSON…
```

Regenerating is `npm pack world-atlas@2 us-atlas@3 topojson-client@3`, unpack,
run the above. There is no build step in this repo and there should not be one
— these files are checked in as data.

## Licence

Natural Earth is **public domain**. From its
[terms of use](https://www.naturalearthdata.com/about/terms-of-use/):

> All versions of Natural Earth raster + vector map data found on this
> website are in the public domain. You may use the maps in any manner,
> including modifying the content and design, electronic dissemination, and
> offset printing. The primary authors, Tom Patterson and Nathaniel Vaughn
> Kelso, and all other contributors renounce all financial claim to the
> maps and invite you to use them for personal, educational, and commercial
> purposes. No permission is needed to use Natural Earth. Crediting the
> authors is unnecessary.

Credit is given anyway — every export of a built-in base map is stamped
"Base map: … — Natural Earth (public domain)" — because the tool's whole
attribution story is about modelling good practice for students, and because
a teacher handing out a map should be able to say where it came from.

The `world-atlas` / `us-atlas` / `topojson-client` packages the conversion
went through are ISC-licensed (Copyright 2013–2019 Michael Bostock); that
licence covers the packaging software, not the public-domain geometry
reproduced here.
