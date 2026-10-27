# AeroFlow HVAC — Premium full-stack demo (v3)

A complete fictional HVAC demo website and functional inquiry-management admin dashboard. Built with **HTML, CSS, JavaScript, Node.js built-in HTTP server**; **no npm dependencies** and no database setup required.

## Start on Windows (VS Code)

1. Extract this ZIP to a new folder (do not merge it with an existing Vite project).
2. Open the extracted `aeroflow-studio` folder in VS Code.
3. Open Terminal and run `npm start`.
4. Public website: `http://localhost:3000`
5. Admin dashboard: `http://localhost:3000/admin.html`
6. For local testing, initial demo password: `CHANGE_ME_BEFORE_DEPLOY`.

**Before deploying anywhere publicly**, set a long, unique admin password with the `ADMIN_PASSWORD` environment variable. PowerShell example:

```powershell
$env:ADMIN_PASSWORD="replace-with-a-long-unique-random-password"
npm start
```

**Do not use `npm run dev` from the old Vite project**. This is a separate Node application with its own server. You can run `npm run dev` in this new folder to enable Node watch mode.

## Working functionality

- Public: responsive homepage, animated reveal, mobile navigation, six editable service cards, FAQ accordion, working inquiry form.
- Backend: `POST /api/inquiries` validates and saves demo inquiries into `data/store.json`.
- Admin: password login, HTTP-only session cookie, dashboard metrics, search/filter inquiries, change statuses, private notes, delete inquiries, CSV export, edit services and site settings.
- No fake client reviews, certifications or business contact details.
- Demo inquiries are stored **locally on the server**. They do not email anyone or confirm appointments.

## Deployment notes

- Requires a hosting service that runs persistent Node.js processes and provides **persistent disk storage**. Static-only Cloudflare Pages / Workers deployment will **not** run this server unchanged.
- Set `ADMIN_PASSWORD`, configure HTTPS, protect the admin route, and add real business information before production.
- For real customer data, move from JSON storage to a managed database, add CSRF protections, abuse monitoring, backups, email delivery, privacy policy, retention/deletion policy, and proper authentication.
- Sessions are in-memory and reset on server restart; intended for a single-process demo only.
- Images load from Unsplash and fonts from Google Fonts and require internet. Confirm usage rights and replace with licensed client photography for commercial launch.
- The website is a **concept demo**. Do not represent it as a real HVAC company.

## Project structure

```
aeroflow-studio/
  package.json
  server.js
  public/
    index.html
    style.css
    app.js
    admin.html
    admin.css
    admin.js
  data/ (created automatically on first run)
```


## V4 Services navigation
Homepage includes an accessible Services dropdown with six links. Each opens /service.html?service=<id>, populated from /api/public and detailed demo content in public/service.js. No extra dependencies. Restart npm start after extracting.


## V5 additions
- Unified footer on all six service pages with working homepage section links and current year.
- Floating contact dock on homepage and service pages: estimate form, optional call, email and WhatsApp buttons populated from Admin > Site settings. Empty contact fields do not generate fake links. Use a real internationally formatted business phone number (e.g. +countrycode...).
- Rule-based demo chat assistant for basic HVAC FAQs. It is NOT an actual LLM/AI integration.
- Admin: last refreshed indicator, direct customer email, call and WhatsApp actions in inquiry details.
- For real clients: verify contact details, connect email/notifications, add a real AI provider server-side if desired, and review security, privacy and storage before production.
