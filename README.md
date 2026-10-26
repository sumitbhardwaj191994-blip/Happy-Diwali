# Diya Wall: Diwali wishes, live

One small app. Phones send wishes, the main screen lights a diya for each one.

| Who | Link | What it does |
|---|---|---|
| Participants (QR) | `https://your-site/` | Write a wish, tap **Light my diya** |
| Host / main screen | `https://your-site/#screen` | Rangoli lights up, latest wishes float in on the right, QR is shown |
| Host moderation | `https://your-site/admin?key=YOUR_KEY` | See all wishes, delete one, or clear test wishes |

After someone sends a wish, their phone switches to a **live wall**: the same rangoli, lighting up as colleagues share theirs, with their own diya marked by a golden ring and the latest wish shown underneath.

Host keys on the main screen: **R** final reveal, **F** fullscreen. Click a floating wish to hide it.

The page picks its backend automatically: **its own server** (this folder's `server.js`) > Firebase (optional) > **demo mode** (no server, wishes stay in the browser).

## 1. Run it on your laptop (2 minutes)
Needs Node 18+ (nodejs.org). No `npm install` required.

    cd diya-wall
    node server.js

Open `http://localhost:3000/#screen` on your laptop and `http://localhost:3000/` in another tab or on your phone (same Wi-Fi: use `http://<laptop-ip>:3000/`).
Press **T** on the screen page to add sample wishes. The terminal prints the moderation link.

## 2. Host it free (pick one)

### A. Render (free web service): recommended
1. Create a GitHub repo and upload this folder's files (index.html, server.js, package.json, render.yaml, Dockerfile).
2. render.com > **New > Blueprint** > pick the repo > Apply. (Or **New > Web Service**, build `npm install`, start `npm start`.)
3. When it's live you get `https://diwali-wall-xxxx.onrender.com`. Your moderation key is the `ADMIN_KEY` value under the service's **Environment** tab.
4. Optional: rename the service to something short (it becomes part of the URL, nicer for the QR code).

Free-tier behaviour to plan for:
- The free service sleeps after 15 minutes without traffic, and the first request afterwards takes about a minute. **Open the screen link 10 minutes before the event** and leave it open. It polls every 2 seconds, which keeps the server awake.
- Free instances have no permanent disk. A restart or redeploy clears saved wishes. Don't redeploy during the event.
- Free-tier terms change, so check render.com/docs/free before relying on it.

### B. Any container host
`Dockerfile` is included (Koyeb, Azure Container Apps, AWS App Runner, Google Cloud Run, a company VM). Set `ADMIN_KEY` as an environment variable. Port comes from `PORT`.

### C. Your laptop + a public link (no account)
Run `node server.js`, then in a second terminal use a Cloudflare quick tunnel:

    cloudflared tunnel --url http://localhost:3000

It prints an `https://something.trycloudflare.com` link that works from every office. Needs your laptop to stay on and awake, and may be blocked by Deloitte laptop policy, so check with IT.

### D. Static hosting + Firebase (alternative)
If you can only use static hosting (Netlify Drop, GitHub Pages): create a Firebase project with Firestore, paste `firestore.rules` into Rules, and put your web config into `const FIREBASE_CONFIG = null;` in `index.html`. Upload `index.html` only. Wishes then live in Google Cloud.

### Load note for the live wall on phones
Phones check for new wishes every 6 to 8 seconds (randomised), the main screen every 2 seconds. With 500 phones that is roughly 70 to 80 tiny requests a second at peak, which a free Render instance can handle but not with much room to spare. Test it with a few colleagues first. In Firebase mode (option D) the phone wall is switched off, because every phone listening to every wish would exceed the free read quota. Phones show a simple "look up at the main screen" message instead.

## 3. Test before the event
1. Open `/#screen` on the laptop that will share its screen.
2. Scan the QR with 2 to 3 phones, on mobile data and on Wi-Fi. Ask a colleague at another location to try too. Office networks sometimes block unfamiliar domains.
3. Open `/admin?key=...` and **Delete all wishes** to clear your tests.

## On the day
- Share the browser window showing `/#screen` in Teams. Press **F** for fullscreen.
- Show the QR for 2 to 3 minutes while wishes arrive. Read a few aloud.
- Press **R** for the final reveal: all remaining diyas light from the centre outward.
- Bad wish on screen? Click its card to hide it, and delete it in `/admin` so it never reappears.

## Before you use it officially
- Wishes are stored on whichever host you choose, which is outside Deloitte systems. Get the IT / risk go-ahead and delete the data after the event.
- Only wish text and an optional first name are collected. No login, no tracking, no cookies.
- Server rules: 100 characters max, profanity filter, rate limit of 300 wishes a minute per IP (an office shares one IP, so it is deliberately generous).
- Fallback: keep a PowerPoint with the same artwork and a few pre-written wishes ready in case the network fails.

## Customising
- Prompt, title, colours: `index.html` (search "Share your Diwali wish", `--gold`).
- Wish length: `MAX_LEN` in both `index.html` and `server.js` (and `maxlength` on the textarea).
- Number of diyas: the `RINGS` array in `index.html` (currently 400).
