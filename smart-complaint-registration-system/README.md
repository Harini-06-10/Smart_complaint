# Smart Complaint Registration System — v3

A web app for reporting civic problems (potholes, garbage, broken streetlights, water leaks and so on) with photo evidence and a location. Each complaint goes automatically to the right department and the nearest worker. You can track it until it is fixed.

**Stack:** React (Vite) · Node.js + Express · MongoDB (Mongoose) · JWT · Socket.IO · Leaflet / OpenStreetMap

Department of CSE, Prathyusha Engineering College. Team: Bavani K, Bhavya B, B Harini.

---

## Project flow

```
Citizen sees a large pothole
  → uploads a photo        (v3: GPS read from the photo drops the map pin)
  → location + category    (category, department and priority are predicted automatically)
  → submits                (complaint no. CMP-2026-xxxxxx + QR receipt)
  → authority receives it  (live notification, dashboard, assignment board)
  → a worker is assigned   (v3: nearest worker with the lightest workload)
  → worker fixes it        (v3: planned route, GPS check-in at the site, proof photo)
  → status = Resolved      (v3: before/after slider; the citizen rates it or reopens it)
```

---

## 1. Install these once

| Software | Why you need it | Download |
|---|---|---|
| **Node.js 20 or 22 (LTS)** | runs the backend and frontend | https://nodejs.org |
| **VS Code** | code editor | https://code.visualstudio.com |
| MongoDB Community Server *(optional)* | only if you want to view the data in MongoDB Compass | https://www.mongodb.com/try/download/community |

> **You do NOT need to install MongoDB.** If MongoDB is not running, the backend automatically uses its **built-in database**: a small MongoDB-compatible engine written in JavaScript (`backend/src/config/embeddedDb.js`). Nothing is downloaded, and the data is saved in `backend/.data/scrs_db.json`. If MongoDB *is* installed and running, it is used automatically instead.

To check Node.js, open a terminal and type `node -v`. It should print v20.x or v22.x.

---

## 2. Run it in VS Code

1. Unzip the project (right-click → **Extract All**). In VS Code, choose **File → Open Folder…** and select the extracted folder, the one that **directly contains `package.json`**, `backend` and `frontend`.
2. Open the terminal: **Terminal → New Terminal** (or press ``Ctrl+` ``).
3. Install the packages. This is needed only the first time and takes 2–4 minutes:
   ```bash
   npm run setup
   ```
4. Start the backend and the frontend together:
   ```bash
   npm run dev
   ```
5. Wait until you see `🚀 API running on http://localhost:5000` and `Local: http://localhost:5173`.
6. Open **http://localhost:5173** in Chrome or Edge.

On the first start, the database is filled automatically with demo users and 48 complaints.

**Shortcuts**
- **Windows:** double-click `START-WINDOWS.bat`. It installs (first time only), starts both servers and opens the browser.
- **macOS / Linux:** run `./start-mac-linux.sh`.
- **In VS Code:** press `Ctrl+Shift+B` to run the task "Start project". Use **Terminal → Run Task…** for "Install everything" and "Reset demo data".
- **Stop:** press `Ctrl+C` in the terminal.
- **Reset the demo data to fresh:** stop the project (`Ctrl+C`), then run `npm run seed`, then `npm run dev` again.

---

## 3. Demo logins

The login page has one-click buttons for these accounts.

| Role | Email | Password |
|---|---|---|
| Citizen | `citizen@demo.com` | `citizen123` |
| Citizen 2 (for the duplicate-photo demo) | `bhavya@demo.com` | `citizen123` |
| **Authority (Admin)** | `admin@scrs.in` | `admin123` |
| Worker · Roads (base T. Nagar) | `ravi@scrs.in` | `worker123` |
| Worker · Roads (base Tambaram) | `suresh@scrs.in` | `worker123` |
| Worker · Street lights | `arun@scrs.in` | `worker123` |
| Worker · Water | `meena@scrs.in` | `worker123` |
| Other workers | `lakshmi@`, `gokul@`, `karthik@`, `divya@`, `vignesh@` + `scrs.in` | `worker123` |

---

## 4. Live demo script for the review (about 5 minutes)

The folder `demo-photos/` contains test photos. `1_pothole_with_gps.jpg` has real GPS data inside it (Velachery, Chennai).

1. **Citizen reports.** Log in as Citizen, click **Report a problem** and type a title such as "Large pothole on main road". Upload `demo-photos/1_pothole_with_gps.jpg`.
   - The map pin drops automatically: *"📍 Photo location detected"*.
   - Category **Pothole → Roads & Highways** and the priority are suggested automatically.
   - Similar complaints within 250 m are shown.
2. **Submit.** You get the complaint number, the assigned nearest worker, and **Download receipt (QR)**. To make the QR work on a phone, open the app on the laptop using the **Network** address Vite prints (for example `http://192.168.1.5:5173`) instead of localhost. The phone must be on the same Wi-Fi.
3. **Fake/copied photo.** Log out and log in as `bhavya@demo.com`. Upload the **same photo** and you see the warning *"This photo looks identical to …"*.
4. **Authority.** Log in as Authority.
   - **Dashboard:** the integrity checks show reused photos and GPS-verified fixes.
   - **Assign board:** drag a card from "New" onto a worker. Workers are ranked by department, distance and workload.
5. **Worker.** Log in as the worker named on the complaint (usually `ravi@scrs.in`).
   - **Today's route:** an optimised visiting order with a route on the map and "Open in Google Maps".
   - Open the complaint and click **Accept task**, then **📍 I have reached the site**. This is GPS-verified if you are within 300 m.
   - Upload `demo-photos/2_road_fixed_after.jpg` and click **Mark resolved**.
6. **Citizen again.** Open the complaint and drag the **before/after slider**. You see *"✔ Fix GPS-verified on site"*. Rate it 5★ to close it. Then check **Leaderboard** for points and badges.
7. **Chatbot.** Click the 💬 button and type `track CMP-2026-000049` (use your complaint number).
8. Toggle **☾ dark mode** and **தமிழ்** in the navbar.

> **GPS check-in tip:** the demo pothole is in Chennai, so a check-in from college will say "Not at the site". To show a *verified* check-in live, file a **new** complaint using **Use my location**, then check in as the worker from the same laptop.

---

## 5. What's new in v3 (compared with v2)

| # | Feature | Where to see it | Main code |
|---|---|---|---|
| 1 | **Photo GPS auto-location**: reads the latitude, longitude and time stored inside the photo (EXIF) | Report a problem | `frontend/src/utils/photo.js` |
| 2 | **Same-photo fraud detection**: a 64-bit perceptual hash (dHash) of each photo, compared using Hamming distance | Report form warning, authority dashboard, 📷 flag | `utils/photo.js`, `backend/src/utils/photoHash.js` |
| 3 | **Nearest-worker smart assignment**: score = distance (km) + 2 × open tasks, and the lowest score wins | Complaint "How assigned", authority worker list | `backend/src/services/routing.js` |
| 4 | **GPS-verified resolution**: the worker checks in at the site; within 300 m counts as verified | Worker complaint page, ✔ badges | `routes/complaints.js` (`/checkin`) |
| 5 | **Before / after slider**: the citizen's photo compared with the worker's proof | Complaint page, public tracking page | `components/BeforeAfter.jsx` |
| 6 | **QR acknowledgement receipt**: printable, can be saved as PDF, and the QR opens public tracking | After submitting | `pages/Receipt.jsx` |
| 7 | **Worker route planner**: priority-aware nearest-neighbour ordering, map route, Google Maps navigation | Worker → Today's route | `routing.js` (`planRoute`), `pages/staff/RoutePlanner.jsx` |
| 8 | **Drag-and-drop assignment board**: Kanban view of the whole workflow | Authority → Assign board | `pages/admin/AssignBoard.jsx` |
| 9 | **Civic points, levels, badges and leaderboard** | Citizen dashboard, Leaderboard | `routes/stats.js` |
| 10 | **Civic Assistant chatbot**: tracks complaints and answers FAQs in English, with some Tamil keywords | 💬 button on every page | `routes/assistant.js`, `components/Assistant.jsx` |
| 11 | **Dark mode** | ☾ button in the navbar | `styles.css` |
| 12 | Rebranded to match the deck: Authority / Worker / Citizen roles, complaint IDs `CMP-YYYY-NNNNNN`, and new columns in the CSV report | everywhere | — |

**Kept from v2:** JWT login with 3 roles, AI category/priority prediction, duplicate clustering within 250 m, "I'm affected too" support, SLA deadlines with auto-escalation, live notifications (Socket.IO), voice input, English/Tamil, public dashboard with hotspots, CSV report, chat between citizen and worker, and rating or reopening.

---

## 6. Project structure

```
smart-complaint-registration-system/
├── package.json            ← npm run setup / dev / seed
├── START-WINDOWS.bat       ← double-click to run on Windows
├── demo-photos/            ← test photos (one has GPS inside)
├── .vscode/                ← tasks (Ctrl+Shift+B), debugger, recommended extensions
├── backend/                ← Node.js + Express API  (port 5000)
│   ├── .env                ← settings (MongoDB URL, JWT secret)
│   ├── .data/              ← built-in database file (created automatically)
│   ├── uploads/            ← uploaded photos
│   └── src/
│       ├── server.js       ← starts Express + Socket.IO, auto-seeds an empty DB
│       ├── seed.js         ← demo data
│       ├── config/         ← db connection, categories, SLA, points rules
│       ├── models/         ← User, Complaint, Notification, Counter
│       ├── middleware/     ← JWT auth, file upload
│       ├── routes/         ← auth, complaints, stats, assistant, misc
│       ├── services/       ← AI classifier, routing, SLA engine, notifications
│       └── utils/          ← geo distance, photo hash, complaint IDs
└── frontend/               ← React + Vite  (port 5173)
    └── src/
        ├── App.jsx         ← routes
        ├── pages/          ← Home, Login, Track, Receipt, Leaderboard, citizen/, staff/, admin/
        ├── components/     ← Navbar, Maps, BeforeAfter, Assistant, PointsCard, …
        └── utils/photo.js  ← EXIF GPS + photo fingerprint
```

## 7. Main API endpoints

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | all | account and JWT |
| POST | `/api/complaints` | citizen | submit (photos + hashes + GPS) |
| POST | `/api/complaints/check-duplicates` | citizen | nearby duplicates + photo reuse |
| GET | `/api/complaints/track/:id` | public | tracking (no login) |
| GET | `/api/complaints/staff/route` | worker | optimised route |
| PATCH | `/api/complaints/:id/accept` · `/checkin` · `/progress` | worker | accept → GPS check-in → resolve |
| PATCH | `/api/complaints/:id/assign` · `/priority` · `/reject` | authority | manage |
| POST | `/api/complaints/:id/feedback` | citizen | rate or reopen |
| GET | `/api/stats/admin` · `/public` · `/leaderboard` · `/my-points` | — | dashboards |
| POST | `/api/assistant` | public | chatbot |

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `'npm' is not recognized` | Install Node.js LTS, then **restart VS Code**. |
| "Cannot reach the server. Is the backend running on port 5000?" | Make sure `npm run dev` is still running and the terminal shows `API running`. |
| `EADDRINUSE: port 5000` (or 5173) | Another copy is already running. Close the other terminal, or change `PORT` in `backend/.env`. |
| `npm error enoent Could not read package.json` | You opened the wrong folder. In VS Code, open the folder that **directly** contains `package.json`, `backend` and `frontend`. |
| `❌ Cannot start yet` | Read the numbered list it prints. It tells you exactly what to do (install packages, close the other terminal, etc.). |
| `npm run setup` fails with network errors | You need internet for the first install. College Wi-Fi sometimes blocks npm, so try a mobile hotspot. |
| PowerShell says "running scripts is disabled" | Run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use the **Command Prompt** terminal in VS Code. |
| The map is grey | The map tiles come from the internet (OpenStreetMap). Check your connection. |
| "Use my location" doesn't work | Allow location in the browser. It works on `localhost` or HTTPS only. |
| I want fresh demo data | `npm run seed` |
