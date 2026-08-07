// bmg-geography.js — static continent -> country picker data for the map
// search UI, paired with a best-effort guess at each place's Wikimedia
// Commons category name (almost always "Category:Blank maps of <place>").
//
// These category guesses are NOT verified against the live Commons API —
// this repo's dev sandbox can't reach commons.wikimedia.org to check —
// so bmg-commons.js's searchByRegion() always tries the category first and
// silently falls back to an ordinary keyword search if it comes up empty.
// A wrong guess here never breaks the picker; it just means that one place
// gets today's keyword-search quality instead of a curated category. Fixing
// a wrong category is just editing the string below, no code changes.

// A handful of countries' common English name takes "the" in prose/category
// titles ("the United States", "the Philippines") where Commons generally
// follows that convention; everything else defaults to plain "Blank maps of
// <name>" via place() below.
const THE_PREFIXED = new Set([
  "Bahamas", "Central African Republic", "Comoros", "Czech Republic", "Democratic Republic of the Congo",
  "Dominican Republic", "Gambia", "Ivory Coast", "Maldives", "Marshall Islands", "Netherlands", "Philippines",
  "Republic of the Congo", "Solomon Islands", "Sudan", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States",
]);

function place(name) {
  const commonsName = THE_PREFIXED.has(name) ? `the ${name}` : name;
  return { name, category: `Blank maps of ${commonsName}` };
}

export const CONTINENTS = [
  {
    key: "africa", name: "Africa", category: "Blank maps of Africa",
    countries: [
      "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Cameroon",
      "Central African Republic", "Chad", "Comoros", "Democratic Republic of the Congo", "Republic of the Congo",
      "Djibouti", "Egypt", "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana",
      "Guinea", "Guinea-Bissau", "Ivory Coast", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi",
      "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda",
      "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan",
      "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe",
    ].map(place),
  },
  {
    key: "asia", name: "Asia", category: "Blank maps of Asia",
    countries: [
      "Afghanistan", "Armenia", "Azerbaijan", "Bahrain", "Bangladesh", "Bhutan", "Brunei", "Cambodia", "China",
      "Georgia", "India", "Indonesia", "Iran", "Iraq", "Israel", "Japan", "Jordan", "Kazakhstan", "Kuwait",
      "Kyrgyzstan", "Laos", "Lebanon", "Malaysia", "Maldives", "Mongolia", "Myanmar", "Nepal", "North Korea",
      "Oman", "Pakistan", "Palestine", "Philippines", "Qatar", "Saudi Arabia", "Singapore", "South Korea",
      "Sri Lanka", "Syria", "Taiwan", "Tajikistan", "Thailand", "Timor-Leste", "Turkey", "Turkmenistan",
      "United Arab Emirates", "Uzbekistan", "Vietnam", "Yemen",
    ].map(place),
  },
  {
    key: "europe", name: "Europe", category: "Blank maps of Europe",
    countries: [
      "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia",
      "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
      "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta",
      "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal",
      "Romania", "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland",
      "Ukraine", "United Kingdom", "Vatican City",
    ].map(place),
  },
  {
    key: "north-america", name: "North America", category: "Blank maps of North America",
    countries: [
      "Antigua and Barbuda", "Bahamas", "Barbados", "Belize", "Canada", "Costa Rica", "Cuba", "Dominica",
      "Dominican Republic", "El Salvador", "Grenada", "Guatemala", "Haiti", "Honduras", "Jamaica", "Mexico",
      "Nicaragua", "Panama", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines",
      "Trinidad and Tobago", "United States",
    ].map(place),
  },
  {
    key: "south-america", name: "South America", category: "Blank maps of South America",
    countries: [
      "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay", "Peru",
      "Suriname", "Uruguay", "Venezuela",
    ].map(place),
  },
  {
    key: "oceania", name: "Oceania", category: "Blank maps of Oceania",
    countries: [
      "Australia", "Fiji", "Kiribati", "Marshall Islands", "Micronesia", "Nauru", "New Zealand", "Palau",
      "Papua New Guinea", "Samoa", "Solomon Islands", "Tonga", "Tuvalu", "Vanuatu",
    ].map(place),
  },
];
