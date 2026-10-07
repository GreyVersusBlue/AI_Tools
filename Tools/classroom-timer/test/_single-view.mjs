// _single-view.mjs — what the single-timer view looks like and writes, so a
// suite can hold it to the page as it was before the timer board existed.
//
//   capture(page, base)  -> { dom, prefs, running, old }
//
// `dom` is the SHA-256 of the outerHTML of each part of the single-timer view
// after init in a fresh profile; `prefs`/`running` are the exact strings the
// page writes to ct_prefs and ct_running_v1 after one fixed sequence of
// actions on a frozen clock; `old` is what a save written by the old page
// reads back as. golden-single-view.json was captured from the v276 page.


const URL_PAGE = (base) => base + '/Tools/004-Classroom%20Timer.html';
const T0 = new Date('2026-03-02T15:00:00Z').getTime();

export const OLD_SAVE = JSON.stringify({
  v: 1, activeTab: 'transition',
  countdown: { minutes: 12, seconds: 30, untilEnabled: false, untilTime: '' },
  transition: { minutes: 3, seconds: 15 },
  sound: { choice: 'bell', volume: 0.4, muted: true, flashEnabled: true },
  display: { amberPct: 30, redPct: 12, overtimeEnabled: false, endMessage: 'Pencils down.' },
  customPresets: [{ name: 'Bell ringer', minutes: 4, seconds: 0, icon: '🔔', color: '#2a6db0' }]
});

export async function capture(browser, base) {
  const out = {};
  // 1. the markup of the single-timer view, fresh profile
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.clock.install({ time: T0 }); await page.clock.pauseAt(T0 + 1000);
    await page.goto(URL_PAGE(base), { waitUntil: 'load' });
    await page.waitForSelector('#timeDisplay');
    out.dom = await page.evaluate(async () => {
      const h = async (s) => {
        const b = new TextEncoder().encode(s);
        const d = await crypto.subtle.digest('SHA-256', b);
        return Array.from(new Uint8Array(d)).map(x => x.toString(16).padStart(2, '0')).join('');
      };
      const parts = {
        tabs: document.querySelector('nav.mode-tabs'),
        stage: document.querySelector('main.timer-stage'),
        settings: document.getElementById('modeSettings'),
        soundCard: document.getElementById('soundChoice').closest('section.card'),
        displayCard: document.getElementById('amberPct').closest('section.card'),
        strip: document.getElementById('ambientStrip'),
      };
      const r = {};
      for (const k of Object.keys(parts)) r[k] = await h(parts[k].outerHTML);
      r.display = document.getElementById('timeDisplay').textContent;
      r.prefsWritten = localStorage.getItem('ct_prefs');
      return r;
    });
    await ctx.close();
  }
  // 2. the bytes it writes after a fixed sequence on a frozen clock
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.clock.install({ time: T0 }); await page.clock.pauseAt(T0 + 1000);
    await page.goto(URL_PAGE(base), { waitUntil: 'load' });
    await page.waitForSelector('#timeDisplay');
    await page.fill('#cdMinutes', '7'); await page.dispatchEvent('#cdMinutes', 'change');
    await page.fill('#cdPresetName', 'Quiz'); await page.click('#cdSavePreset');
    await page.click('#startBtn');
    await page.clock.runFor(30000);
    await page.click('#pauseBtn');
    out.prefs = await page.evaluate(() => localStorage.getItem('ct_prefs'));
    out.running = await page.evaluate(() => localStorage.getItem('ct_running_v1'));
    await ctx.close();
  }
  // 3. a save written by the old page loads and is not rewritten by a load
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.clock.install({ time: T0 }); await page.clock.pauseAt(T0 + 1000);
    await page.addInitScript((s) => { if (!localStorage.getItem('ct_prefs')) localStorage.setItem('ct_prefs', s); }, OLD_SAVE);
    await page.goto(URL_PAGE(base), { waitUntil: 'load' });
    await page.waitForSelector('#timeDisplay');
    out.old = await page.evaluate(() => ({
      time: document.getElementById('timeDisplay').textContent,
      active: document.querySelector('.mode-tab.active').dataset.mode,
      sound: document.getElementById('soundChoice').value,
      muted: document.getElementById('soundMute').checked,
      end: document.getElementById('endMessage').value,
      presets: document.getElementById('cdCustomPresets').textContent.replace(/\s+/g, ' ').trim(),
      stored: localStorage.getItem('ct_prefs'),
    }));
    await ctx.close();
  }
  return out;
}
