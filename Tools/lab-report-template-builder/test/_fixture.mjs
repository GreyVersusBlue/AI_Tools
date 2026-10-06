// The saved template both the golden-file capture and the packet-split suite
// seed. Made-up content; written the way the page saved it before the split
// existed (no `split` field, typed columns).
export const LEGACY = {
  name: 'Density Lab', title: 'Density of Three Samples', objective: 'Find the density of three samples.',
  hypothesisPrompt: 'If ____, then ____, because ____.',
  materials: [{ id: 'm1', text: 'Balance' }, { id: 'm2', text: 'Graduated cylinder <b>250 mL</b>' }],
  procedure: [{ id: 'p1', text: 'Mass each sample.' }, { id: 'p2', text: 'Measure its volume by displacement.' }],
  columns: [{ id: 'c1', text: 'Sample', type: 'text', units: '' }, { id: 'c2', text: 'Mass', type: 'number', units: 'g' }],
  dataRows: 4,
  observationsPrompt: 'What did you notice?',
  conclusion: [{ id: 'q1', text: 'Was your hypothesis supported?' }, { id: 'q2', text: 'What would you change?' }]
};

export const seed = (page, data = LEGACY) => page.evaluate((d) => {
  localStorage.clear();
  localStorage.setItem('lrt_list_v1', JSON.stringify([d.name]));
  localStorage.setItem('lrt_data_v1:' + d.name, JSON.stringify(d));
  localStorage.setItem('lrt_current_v1', d.name);
}, data);
