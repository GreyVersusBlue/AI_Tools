# Parent conference sign-up ("Conference Book Bag")

Families name their child, search for a teacher, pick a time from that teacher's open
slots, put it in a book bag (each time is **held for 10 minutes**), add more
conferences, and check out to book them all. They get a confirmation code and a PDF of
appointment tickets. Staff get a desk to book for a family, block times, run team-style
conferences, and **Export meetings** to an Excel workbook laid out like the old
SignUpGenius sheet.

**This is the one part of the site that is not offline and not browser-only.** Shared
bookings need one place every phone talks to, so parent and student names are stored on
a Cloudflare Worker (a Durable Object). The rest of the toolkit's "nothing leaves the
browser" rule is unchanged; this folder is deliberately outside `Tools/`, is not in
`sw.js`'s precache, and `sw.js` never serves it from a cache.

## What is here

| File | What it is |
|---|---|
| `index.html`, `parent.js`, `ticket.js` | The family page and the PDF ticket (jsPDF, from `_shared/vendor/`) |
| `admin.html`, `admin.js` | The staff desk (PIN-protected) |
| `core.js` | **All the rules**: holds, checkout, the one-child-one-place block, the staff team-conference bypass, the export layout. Pure, no I/O |
| `api.js`, `config.js` | How the pages call the rules: `config.js` names the Worker, or, left empty, runs them in the browser (demo mode) |
| `teachers.json` | The 32 teachers, subjects and grades, taken from the 10/13 sheet; staff can edit the list in the desk |
| `worker/` | The Cloudflare Worker + Durable Object that runs `core.js` for real |
| `test/` | `core.test.mjs` (rules), `worker.test.mjs` (the Worker's wiring, against a fake Durable Object), `smoke-flow.mjs` (both pages in a real browser, demo mode) |

`npm run test:conference-signup` runs all three.

## Trying it now (demo mode)

Open `conference-signup/index.html` from the site (any static server). With `config.js`
empty the page runs the same rules against a copy of the event in this browser's
`localStorage`; the staff PIN is `1234`. Demo mode cannot show two families competing, because
every tab of one browser is the same family to the rules; that case is covered by
`core.test.mjs` and by `smoke-flow.mjs`, which gives a second page its own holder id.

## Putting it live

1. `cd conference-signup/worker`
2. `npx wrangler login` (once), then `npx wrangler deploy`. It prints the Worker's
   address, `https://conference-signup.<your-subdomain>.workers.dev`. The Durable Object
   is created by the migration in `wrangler.toml` (SQLite-backed, which the free plan allows).
3. `npx wrangler secret put ADMIN_PIN`, and type the staff PIN. Without it every staff
   route answers 503. The PIN is never written into the repo.
4. In `config.js`, set `window.CONF_API` to that address, and commit it. The pages ship
   with the rest of the site (GitHub Pages).
5. `ALLOWED_ORIGINS` in `wrangler.toml` is the site's address
   (`https://aspermylessonplan.com`). If the pages are ever served from another
   address, add it there and redeploy, or the browser's cross-origin check refuses the calls.
6. Open `admin.html`, enter the PIN, check the teachers and the event date in **Setup**,
   pre-book anyone who needs it, then press **Closed to families** to open sign-ups.

A custom domain for the Worker (for example `conferences-api.aspermylessonplan.com`)
works the same way: add the route in Cloudflare and put that address in `config.js`.

## How it behaves

- **A hold** is a timestamp on a slot, not a timer: a slot is free once its hold's time
  has passed. The family's countdown runs against the server's clock.
- **One request at a time.** There is exactly one Durable Object. It handles requests
  one after another, so "is this slot free? then hold it" cannot race, and nothing needs
  a lock. The whole event (32 × 12 slots) lives in its memory and is saved after every change.
- **Checkout is all or none.** If any time in the bag was lost, nothing is booked, and the
  page says which one. A retried checkout (a dropped connection) returns the same confirmation.
- **A child cannot be in two places.** A family asking for a second teacher at a time
  that child already has is refused. Staff can override it for a **team conference**: the
  extra booking shares the first one's confirmation code and keeps the family's spelling.
- **Families never see names.** The family page's data is one letter per slot (free,
  taken, held, yours, blocked). Names are only in the PIN-protected staff routes and the export.
- **Limits.** 6 held times per browser (staff can change it); 600 family requests a minute
  and 10 wrong PINs per ten minutes per address. A school's wifi is one address, which is why
  the family limit is generous.

## Before and after the evening

- **Before the link goes out:** sign-ups start **closed**. Staff can book for anyone from
  the desk while closed. Press the switch to open it.
- **After:** press **Export meetings**, save the workbook, then **Setup → Clear all
  meetings**. Names should not sit on the server for longer than the event needs them.

## Not verified (read before trusting it)

- **Nothing here has been deployed.** The Worker's wiring is tested in Node against a fake
  Durable Object, and the pages against the same rules in a browser, but not on Cloudflare:
  not `wrangler deploy`, not the migration, not the JSON import bundling, not the
  free-plan limits under a real rush. Do a dry run with two phones and a few friends
  before the link goes to families.
- **Request volume.** Each open family page asks for the state every 15 seconds. 600
  families for ten minutes is about 24,000 requests, inside the free plan's daily Worker and
  Durable Object allowances (100,000 each at the time of writing: check the current figures).
- **No phone has used it.** It passed an axe scan and was looked at on a 400 px viewport
  in Chromium, nothing more. The PDF ticket has not been printed.
- **No email, and no family-side cancel.** A family changes a time by contacting the office;
  staff cancel from the desk. That was a decision, not an oversight.
- **Free-text names.** Spellings are as typed. Two spellings of one child can book the
  same time with different teachers, because the rule matches names, not roster ids. A
  roster check would fix that and would put the student roster on the server, which this
  version deliberately does not do.
