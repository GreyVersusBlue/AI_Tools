/* Where the booking server lives. Leave it empty and the pages run in demo mode:
   the same rules, kept in this browser only. After deploying the Worker
   (worker/README.md), set it to the Worker's address, e.g.
     window.CONF_API = 'https://conference-signup.<your-subdomain>.workers.dev';
   and commit this file. Then bump the `?v=` on config.js in index.html and admin.html:
   the site's CDN keeps static files for four hours, and a new URL is what makes a changed
   address reach families at once. */
window.CONF_API = 'https://conference-signup.devons-moore.workers.dev';
