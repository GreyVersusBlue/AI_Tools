// bmg-colors.js — the 6-color palette shared by shaded regions and colored
// markers, so the two annotation types draw from one consistent named set
// of colors instead of each module defining (and risking drifting from)
// its own copy of the same hex values.

export const PALETTE = [
  { key: "red", name: "Red", hex: "#a3372b" },
  { key: "blue", name: "Blue", hex: "#2e6b8f" },
  { key: "green", name: "Green", hex: "#2e6b3e" },
  { key: "gold", name: "Gold", hex: "#b8862b" },
  { key: "purple", name: "Purple", hex: "#6b4c9a" },
  { key: "teal", name: "Teal", hex: "#1f7a72" },
];

export function colorHex(key) {
  return (PALETTE.find(c => c.key === key) || PALETTE[0]).hex;
}

// Text labels draw from a wider set than the six shared annotation colors.
// The reason is the auto-color toggle in 046-blank-map-generator.html: with
// it on, every label placed takes the next color in this list so that each
// one becomes its own row in the key ("blue = rivers, green = mountains").
// Six colors runs out fast on a map with a dozen labelled features, so this
// extends the shared palette rather than replacing it — the first six keys
// are the same six PALETTE keys, so a label colored before this existed
// still resolves to exactly the color it had, and the extras below are only
// ever reachable from a label.
export const LABEL_PALETTE = [
  ...PALETTE,
  { key: "orange", name: "Orange", hex: "#c2571a" },
  { key: "magenta", name: "Magenta", hex: "#9c3f6d" },
  { key: "navy", name: "Navy", hex: "#26456e" },
  { key: "olive", name: "Olive", hex: "#6b7a24" },
  { key: "brown", name: "Brown", hex: "#7a4a24" },
  { key: "slate", name: "Slate", hex: "#4a5560" },
];

/** Like colorHex(), but over the wider label palette. An unknown key falls back to the first color rather than throwing, same as colorHex(). */
export function labelPaletteHex(key) {
  return (LABEL_PALETTE.find(c => c.key === key) || LABEL_PALETTE[0]).hex;
}
