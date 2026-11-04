MARRIAGE4DUMMIES INSTALLABLE WEB APP — NETLIFY

1. Upload the CONTENTS of this folder to your Netlify site, or drag and drop the ZIP into Netlify Deploys.
2. Ensure index.html, manifest.webmanifest, service-worker.js, _headers, and icons/ all appear at the site ROOT. Do not upload just index.html for the installable app.
3. Open your Netlify HTTPS URL in Chrome/Edge on Android or desktop, then tap the “Install M4D App” button if offered. Alternatively use your browser menu.
4. On iPhone, open your site in Safari > Share > Add to Home Screen. iOS web push requires an installed Home Screen web app.
5. Test the app launches from the icon and that current site navigation, sign-in, Merch, Vault, and chat work.

IMPORTANT
- This package INSTALLS the site as a PWA. It does NOT yet send real push notifications. Sending push messages requires VAPID keys, a secure server-side push sender (such as Netlify Functions), per-device subscriptions, explicit permission, and Supabase storage / access policies. Do not place push private keys in the HTML.
- An installed app does not make Supabase, YouTube, voice calls, or live messages available offline. Offline support is limited to a previously loaded app shell.
- Google Sites HTML embedding / iframe is not a substitute for deploying the PWA files at the root of your Netlify HTTPS domain.
- If the install prompt is unavailable, use browser menu instructions; not every browser offers the same install event.
- If you replace an older deploy and see an old screen, reload once while online to refresh the service worker cache.

HOME SCREEN ICON TROUBLESHOOTING
1. Deploy the ENTIRE extracted folder to the existing Netlify site. It must contain index.html, manifest.webmanifest, apple-touch-icon.png, favicon.png and icons/.
2. After publishing, visit https://YOUR-SITE.netlify.app/apple-touch-icon.png directly. It MUST show the complete black-and-red Marriage4Dummies logo. If it returns the website instead, icons were not deployed to the root.
3. Delete the OLD Home Screen shortcut/app, open the published site in Safari (iPhone) or Chrome (Android), refresh, and add/install it again.
4. If still showing an M, clear the site's cached data or wait for the browser's icon cache to refresh and reinstall.
5. Don't deploy only the single HTML file: the app icons are separate PNGs.
