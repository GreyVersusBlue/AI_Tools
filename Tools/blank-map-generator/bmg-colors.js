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
