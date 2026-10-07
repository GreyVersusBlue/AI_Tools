// Shared fixtures for the 015 worksheet / ordering suites: made-up timelines
// written straight into localStorage the way the page saves them.

export const mk = (id, title, yearStart, extra = {}) => Object.assign({
  id, track: 0, yearStart, yearEnd: null, title, category: '', displayDate: null,
  description: '', photo: null, place: null
}, extra);

/** Twelve invented events: a BCE-to-CE span, two in the same year, a range, a
    display date, one with no title (never an answer) and two with markup. */
export function riverTimeline(name = 'Rivers') {
  return {
    name, title: 'The River Kingdoms', lineStyle: 'solid', compactLabels: false,
    scaleMode: 'linear', eras: [], tracks: [{ id: 0, name: 'Main' }],
    events: [
      mk(1, 'First canal dug', -2500, { category: 'Work' }),
      mk(2, 'Salt road opened', -1200, { category: 'Trade' }),
      mk(3, 'Harbour wall <b>built</b>', -300, { category: 'Work' }),
      mk(4, 'Bridge of Orn', 40, { yearEnd: 55, category: 'Work' }),
      mk(5, 'Market charter', 410, { displayDate: 'Autumn 410' }),
      mk(6, 'Flood of the lower fields', 410, { category: 'Weather' }),
      mk(7, '', 700),
      mk(8, 'Ferry guild founded & chartered', 1020, { category: 'Trade' }),
      mk(9, 'Lock keepers’ strike', 1480),
      mk(10, 'Steam dredger arrives', 1860, { category: 'Work' }),
      mk(11, 'The "Great Drought"', 1921, { yearEnd: 1923, category: 'Weather' }),
      mk(12, 'Dam opened', 1974, { category: 'Work' })
    ]
  };
}

export function smallTimeline(n, name = 'Small') {
  const years = [1500, 1600, 1700, 1800, 1900, 1950, 1990, 2000];
  return {
    name, title: name, lineStyle: 'solid', compactLabels: false, scaleMode: 'linear',
    eras: [], tracks: [{ id: 0, name: 'Main' }],
    events: years.slice(0, n).map((y, i) => mk(i + 1, 'Event ' + String.fromCharCode(65 + i), y))
  };
}

/** Put a timeline in storage before the page boots. */
export async function seed(page, timeline) {
  await page.addInitScript(t => {
    if (localStorage.getItem('__seeded')) return;
    localStorage.setItem('__seeded', '1');
    localStorage.setItem('gvb-timeline:list', JSON.stringify([t.name]));
    localStorage.setItem('gvb-timeline:data:' + t.name, JSON.stringify(t));
    localStorage.setItem('gvb-timeline:current', t.name);
  }, timeline);
}
