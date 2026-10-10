/* Where the booking server lives. Leave it empty and the pages run in demo mode:
   the same rules, kept in this browser only. After deploying the Worker
   (worker/README.md), set it to the Worker's address, e.g.
     window.CONF_API = 'https://conference-signup.<your-subdomain>.workers.dev';
   and commit this file. Nothing else needs to change. */
window.CONF_API = 'https://conference-signup.devons-moore.workers.dev';
