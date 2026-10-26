# Put the Diya Wall online (free): Render

Why Render: it is the one mainstream host that still runs a real Node server for free. This app needs that,
because wishes from many phones have to land in one place. (Static hosts like Netlify or GitHub Pages can't do it.)

You need two free accounts: **GitHub** (holds the code) and **Render** (runs it). About 10 minutes.

## Step 1: Get the code onto GitHub

### Route A: drag and drop (no tools needed)
1. Unzip `diya-wall.zip` on your computer.
2. github.com > **New repository** > name it `diwali-wall` > Public or Private > **Create repository**.
3. On the empty repo page click **uploading an existing file**.
4. Open the unzipped folder, select **all the files inside it** (index.html, server.js, package.json, Dockerfile,
   render.yaml, README.md, firestore.rules) and drag them into the browser. Upload the files, not the zip and not the outer folder.
   `render.yaml` must sit at the top level of the repo.
5. **Commit changes**.

### Route B: script (if Git is installed)
Create the empty repo as above and copy its URL, then from inside the folder run:
- Windows: `powershell -ExecutionPolicy Bypass -File .\deploy-to-github.ps1`
- Mac/Linux: `bash deploy-to-github.sh`

## Step 2: Run it on Render
1. render.com > sign up (you can sign in with GitHub).
2. **New > Blueprint** > connect your GitHub > pick `diwali-wall` > **Apply**.
   (No Blueprint option? Use **New > Web Service**, pick the repo, runtime Node, build command `npm install`, start command `npm start`, instance type **Free**.)
3. Wait 2 to 3 minutes for the first build. You get a link like `https://diwali-wall.onrender.com`.
4. Check it: open `https://<your-link>/api/health`. You should see `{"ok":true,"wishes":0}`.

## Step 3: Your three links
- Participants / QR: `https://<your-link>/`
- Main screen: `https://<your-link>/#screen`
- Moderation: `https://<your-link>/admin?key=<ADMIN_KEY>`. The key is in Render > your service > **Environment** > `ADMIN_KEY`.

## Step 4: Rehearse (do this a day before)
1. Open `/#screen` on the laptop that will share its screen. The QR on it already points to your live link.
2. Scan with 2 to 3 phones, on mobile data and office Wi-Fi. Ask a colleague at another location to try too.
3. Open `/admin?key=...` > **Delete all wishes** to clear the test wishes.

## Free-tier things to plan around
- The free service sleeps after 15 idle minutes and takes about a minute to wake. **Open `/#screen` 10 minutes before the event and leave it open**; it checks for wishes every 2 seconds, which keeps the server awake.
- A restart or redeploy clears wishes (free instances have no permanent disk). Don't push changes during the event.
- Render may restart a free service at any time, which also clears the wishes. Diyas already lit on the main screen stay lit, and new wishes keep working, but people who open the wall afterwards start from zero. Worth knowing, unlikely to matter.
- Insurance option: the cheapest paid instance (about $7 a month, billed only for the days you keep it) never sleeps and has more CPU. Create it the day before and delete it after the event if you want zero risk.
- Load tested locally with 500 simultaneous page loads, 500 simultaneous wishes and 30 seconds of polling from 500 phones: no failures. The server used about 1.3 CPU-seconds and 65 MB of memory in total.
- If you want a shorter link for the QR, rename the service in Render (Settings > Name).

## If Render doesn't work for you
- **Run on your laptop + Cloudflare tunnel:** `node server.js`, then `cloudflared tunnel --url http://localhost:3000` gives a public link. The laptop must stay on.
- **Paid but tiny:** Render's cheapest paid instance never sleeps and keeps a disk if you need that.
- Fly.io, Railway and Koyeb no longer offer a proper free server for new accounts, so I did not build for them.
