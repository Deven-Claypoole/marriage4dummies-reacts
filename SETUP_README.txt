MARRIAGE4DUMMIES — ONESIGNAL WEB PUSH UPDATE
===========================================
THIS IS A COMPLETE STATIC NETLIFY DEPLOYMENT PACKAGE.
The original website, new M4D app icon, Vault, mobile fixes, member XP,
and App Settings are included. Live Theatre is not included.

1. On Netlify, open your EXISTING M4D project > Deploys.
2. Unzip Marriage4Dummies_OneSignal_Ready.zip and upload its contents
   together (the folder containing index.html). Do not upload only HTML.
3. Wait for Published. On https://marriage4dummies-reacts.netlify.app/ verify:
   https://marriage4dummies-reacts.netlify.app/OneSignalSDKWorker.js
   https://marriage4dummies-reacts.netlify.app/service-worker.js
   Both must show JavaScript, not the homepage.
4. Remove/reinstall the M4D Home Screen app on iPhone if notifications or icon
   remain stale. Open the INSTALLED app and allow notifications.
5. Go to Members > App Settings & Rewards > Enable Notifications.
   Or use the OneSignal slide prompt after a pageview.
6. OneSignal > Audience > Users & subscriptions should show your test device.
7. OneSignal > Messages > Push > Create message to send a test notification.

APP ID: c43c6075-5953-4ea7-98d7-2b0e887322e5 (public ID)

NOTE: OneSignal is configured to use the EXISTING service-worker.js at scope
'/' to prevent conflicting root service workers. We also include the downloaded
OneSignalSDKWorker.js for file verification. OneSignal's SDK controls delivery
and notification clicks; M4D PWA retains its offline shell caching.

The existing member settings in Supabase aren't automatically passed to OneSignal
when you send broadcast messages from the dashboard. Members can opt in or out;
per-category enforcement and automatic personalized alerts require a separate
trusted OneSignal integration. No VAPID secrets or Netlify functions are required
for sending manual broadcasts through OneSignal.
