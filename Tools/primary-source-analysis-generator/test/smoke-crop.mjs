// smoke-crop.mjs — image crop, zoom, and the printed detail callout.
//
//   node Tools/primary-source-analysis-generator/test/smoke-crop.mjs
//
// The point of the feature is "look closely at THIS part": a teacher drags a
// rectangle over a photograph and the worksheet prints that region enlarged,
// with its position outlined on the whole image. What this suite holds down:
//
//   1. A dragged rectangle becomes a crop, and the printed detail really is
//      the cropped region scaled up — asserted from the geometry (the inner
//      image's width and offset), not from "an img exists".
//   2. The callout prints BOTH panels and outlines the detail's position on
//      the whole image. Without that outline the second panel is just a
//      second picture, and the worksheet stops making its own point.
//   3. With the callout off, only the detail prints — the other thing a
//      teacher means by cropping.
//   4. No crop means the printed markup is exactly what it was before this
//      feature existed. Every worksheet already saved is in that state, and
//      none of them may change on paper.
//   5. A crop belongs to a particular picture: uploading or clearing an
//      image resets it, rather than pointing at the wrong part of the new one.
//   6. It survives a save/reload, and it works the same for Source B.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8235;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/028-primary-source-analysis-generator.html';

// A 4x4 PNG, uploaded rather than linked: the harness blocks offsite requests
// (correctly), and an uploaded image is the path the feature is written for.
const PNG_4x4 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAHElEQVQI12P4//8/AzYMEmDEJgYTZBg1jGgDAd4gI/1t4jhnAAAAAElFTkSuQmCC';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b} ±${tol})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

console.log('Primary Source Analysis — image crop and detail callout');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page);

/* Upload the image through the real file input, so the whole path runs
   (downscale, preview, crop panel appearing). */
async function uploadTo(selector, name = 'source.png') {
  const buffer = Buffer.from(PNG_4x4.split(',')[1], 'base64');
  await page.setInputFiles(selector, { name, mimeType: 'image/png', buffer });
  await settle(page, 400);
}

/* ── 0. no image, no crop panel ──────────────────────────────────────────── */
ok(await page.isHidden('#cropPanelA'), 'the crop panel stays out of the way until there is an image');

await uploadTo('#imageFile');
ok(await page.isVisible('#cropPanelA'), 'uploading an image reveals the crop panel');
ok((await page.textContent('#cropHintA')).includes('whole image'),
   'and it says the whole image prints until a detail is picked');
eq(await page.isDisabled('#detailCalloutA'), true,
   'the side-by-side option is disabled while there is nothing to put beside it');

/* ── 1. the printed markup is untouched with no crop ─────────────────────── */
const printedNoCrop = await page.evaluate(() => {
  const wrap = document.querySelector('#previewArea .source-image-wrap');
  return {
    html: wrap ? wrap.innerHTML.trim() : '',
    hasPair: !!document.querySelector('#previewArea .source-image-pair'),
    hasFrame: !!document.querySelector('#previewArea .crop-frame'),
  };
});
ok(printedNoCrop.html.startsWith('<img'), 'with no crop the worksheet prints the plain image it always did');
eq(printedNoCrop.hasPair, false, 'no side-by-side pair');
eq(printedNoCrop.hasFrame, false, 'and no crop frame');

/* ── 2. dragging a rectangle sets a crop ─────────────────────────────────── */
/** Drags from (x1,y1) to (x2,y2) as fractions of the crop tool's box. */
async function dragCrop(panelSel, x1, y1, x2, y2) {
  // boundingBox() is viewport-relative and does not scroll, so a tool below
  // the fold would otherwise be "dragged" over whatever is at those
  // coordinates instead.
  await page.locator(`${panelSel} .crop-tool`).scrollIntoViewIfNeeded();
  const box = await page.locator(`${panelSel} .crop-tool`).boundingBox();
  await page.mouse.move(box.x + box.width * x1, box.y + box.height * y1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * ((x1 + x2) / 2), box.y + box.height * ((y1 + y2) / 2), { steps: 4 });
  await page.mouse.move(box.x + box.width * x2, box.y + box.height * y2, { steps: 4 });
  await page.mouse.up();
  await settle(page, 300);
}

await dragCrop('#cropPanelA', 0.5, 0.5, 0.75, 0.75);

const crop = await page.evaluate(() => {
  const name = localStorage.getItem('gvb-primary-source:current');
  const doc = JSON.parse(localStorage.getItem('gvb-primary-source:data:' + name) || 'null');
  return doc && doc.imageCrop;
});
ok(!!crop, 'the drag was saved as a crop');
near(crop.x, 0.5, 0.06, 'crop x is where the drag started');
near(crop.y, 0.5, 0.06, 'crop y is where the drag started');
near(crop.w, 0.25, 0.06, 'crop width matches the drag');
near(crop.h, 0.25, 0.06, 'crop height matches the drag');

ok((await page.textContent('#cropHintA')).includes('×'),
   'the hint reports the zoom in plain terms: ' + JSON.stringify(await page.textContent('#cropHintA')));
eq(await page.isChecked('#detailCalloutA'), true,
   'picking a detail turns the side-by-side on, which is what a teacher almost always wants');

/* ── 3. the printed detail is really the cropped region, enlarged ────────── */
const printed = await page.evaluate(() => {
  const area = document.getElementById('previewArea');
  const pair = area.querySelector('.source-image-pair');
  const frame = area.querySelector('.crop-frame');
  const inner = frame ? frame.querySelector('img') : null;
  const marker = area.querySelector('.detail-marker');
  const style = inner ? inner.getAttribute('style') : '';
  const num = (re) => { const m = style.match(re); return m ? parseFloat(m[1]) : null; };
  return {
    hasPair: !!pair,
    hasMarker: !!marker,
    markerStyle: marker ? marker.getAttribute('style') : '',
    innerWidthPct: num(/width:\s*([\d.]+)%/),
    innerLeftPct: num(/left:\s*(-?[\d.]+)%/),
    innerTopPct: num(/top:\s*(-?[\d.]+)%/),
    captions: Array.from(area.querySelectorAll('.detail-caption')).map(c => c.textContent),
    wholeImages: area.querySelectorAll('.detail-anchor .source-image').length,
  };
});
eq(printed.hasPair, true, 'the worksheet prints the whole image and the detail side by side');
eq(printed.wholeImages, 1, 'the whole image is still there');
eq(printed.hasMarker, true, 'and the detail’s position is outlined on it');
// A 0.25-wide crop means the inner image is blown up to 400% of the frame,
// and shifted left by (x/w) = 2 frame-widths. That arithmetic IS the zoom.
near(printed.innerWidthPct, 400, 40, 'the detail is enlarged by 1/width — 4x for a quarter-width crop');
near(printed.innerLeftPct, -200, 40, 'and offset so the crop is what shows');
near(printed.innerTopPct, -200, 40, 'in both axes');
ok(/left:\s*5[01](\.\d+)?%/.test(printed.markerStyle), 'the outline sits at the crop’s position: ' + printed.markerStyle);
ok(/width:\s*2[45](\.\d+)?%/.test(printed.markerStyle), 'and is the crop’s size');
ok(printed.captions.some(c => /whole source/i.test(c)), 'the two panels are labelled: whole source');
ok(printed.captions.some(c => /detail/i.test(c)), 'and detail');

/* ── 4. callout off → only the detail prints ─────────────────────────────── */
await page.uncheck('#detailCalloutA');
await settle(page, 250);
const detailOnly = await page.evaluate(() => {
  const area = document.getElementById('previewArea');
  return {
    hasPair: !!area.querySelector('.source-image-pair'),
    hasFrame: !!area.querySelector('.crop-frame'),
    wholeImages: area.querySelectorAll('.detail-anchor').length,
  };
});
eq(detailOnly.hasPair, false, 'with the side-by-side off there is no pair');
eq(detailOnly.hasFrame, true, 'the detail still prints');
eq(detailOnly.wholeImages, 0, 'and the whole image does not');

/* ── 5. reset puts it back exactly as it was ─────────────────────────────── */
await page.click('#resetCropA');
await settle(page, 250);
const afterReset = await page.evaluate(() => {
  const wrap = document.querySelector('#previewArea .source-image-wrap');
  return wrap ? wrap.innerHTML.trim() : '';
});
eq(afterReset, printedNoCrop.html, 'reset restores byte-identical markup to the no-crop state');
eq(await page.isDisabled('#detailCalloutA'), true, 'and the side-by-side option is disabled again');

/* ── 6. a crop belongs to one picture ────────────────────────────────────── */
await dragCrop('#cropPanelA', 0.1, 0.1, 0.4, 0.4);
ok(await page.evaluate(() => {
  const name = localStorage.getItem('gvb-primary-source:current');
  const doc = JSON.parse(localStorage.getItem('gvb-primary-source:data:' + name));
  return doc.imageCrop.w < 0.9;
}), 'a crop is set again');
await uploadTo('#imageFile', 'different.png');
ok(await page.evaluate(() => {
  const name = localStorage.getItem('gvb-primary-source:current');
  const doc = JSON.parse(localStorage.getItem('gvb-primary-source:data:' + name));
  return doc.imageCrop.w === 1 && doc.imageCrop.h === 1 && doc.imageDetail === false;
}), 'uploading a different image resets the crop rather than pointing at the wrong part of it');

await dragCrop('#cropPanelA', 0.2, 0.2, 0.6, 0.6);
await page.click('#clearImageFileBtn');
await settle(page, 250);
ok(await page.evaluate(() => {
  const name = localStorage.getItem('gvb-primary-source:current');
  const doc = JSON.parse(localStorage.getItem('gvb-primary-source:data:' + name));
  return doc.imageCrop.w === 1;
}), 'removing the image clears the crop too');
ok(await page.isHidden('#cropPanelA'), 'and the panel goes away with the image');

/* ── 7. it survives a reload, and Source B works the same ────────────────── */
await uploadTo('#imageFile');
await dragCrop('#cropPanelA', 0.3, 0.3, 0.7, 0.7);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
const reloaded = await page.evaluate(() => {
  const name = localStorage.getItem('gvb-primary-source:current');
  const doc = JSON.parse(localStorage.getItem('gvb-primary-source:data:' + name));
  return { w: doc.imageCrop.w, detail: doc.imageDetail, pair: !!document.querySelector('#previewArea .source-image-pair') };
});
near(reloaded.w, 0.4, 0.08, 'the crop survives a reload');
eq(reloaded.detail, true, 'and so does the side-by-side choice');
eq(reloaded.pair, true, 'and the worksheet still prints both panels');

await page.check('#corroborationEnabled');
await settle(page, 250);
await uploadTo('#sourceBImageFile');
ok(await page.isVisible('#cropPanelB'), 'Source B gets the same crop panel');
await dragCrop('#cropPanelB', 0.5, 0.1, 0.9, 0.5);
ok(await page.evaluate(() => {
  const name = localStorage.getItem('gvb-primary-source:current');
  const doc = JSON.parse(localStorage.getItem('gvb-primary-source:data:' + name));
  return doc.sourceBImageCrop.w < 0.9 && doc.sourceBImageDetail === true;
}), 'and cropping Source B saves against Source B, not Source A');
ok(await page.evaluate(() => {
  const name = localStorage.getItem('gvb-primary-source:current');
  const doc = JSON.parse(localStorage.getItem('gvb-primary-source:data:' + name));
  return doc.imageCrop.w > 0.3 && doc.imageCrop.w < 0.5;
}), "Source A's crop is untouched by it");

/* ── 8. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
