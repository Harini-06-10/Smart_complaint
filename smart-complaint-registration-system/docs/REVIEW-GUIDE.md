# Final Review Guide — Smart Complaint Registration System v3

## One-line pitch
A citizen photographs a civic problem. The system reads the location from the photo, routes the complaint to the right department and the nearest worker, and proves the fix with a GPS check-in and a before/after photo. Everyone can track it in real time.

## Architecture (3-tier MERN)

```
 React (Vite) SPA  ──HTTP/JSON + JWT──►  Express REST API  ──Mongoose──►  MongoDB
   :5173                                    :5000                          users, complaints,
   │  ▲                                       │                            notifications, counters
   │  └──────── Socket.IO (live updates) ─────┘
   └─ browser-side: EXIF reader, photo hash, QR code, Leaflet maps, voice input
```

Roles: **Citizen** (reports, tracks, rates) · **Worker** (accepts, checks in, resolves) · **Authority/Admin** (assigns, prioritises, monitors).

Complaint life-cycle: `Submitted → Assigned → In Progress → Resolved → Closed` (plus `Reopened`, `Rejected`).

---

## How the new v3 features work

### 1. Photo GPS auto-location
Phones save GPS coordinates and the capture time inside the JPEG's **EXIF metadata**. The browser reads them with the `exifr` library before upload (`frontend/src/utils/photo.js`) and drops the map pin automatically. The complaint stores `photoMeta.usedForLocation = true`, so the authority knows the location came from the photo.

### 2. Same-photo (fake report) detection — perceptual hashing
- **dHash algorithm:** shrink the image to 9×8 pixels in greyscale. For each row, compare each pixel with its right neighbour (brighter = 1, else 0). That gives 8×8 = **64 bits**, stored as 16 hex characters.
- The same photo, even resized or re-compressed, gives almost the same bits.
- **Hamming distance** = the number of bits that differ. ≤ 6 bits means "same photo" (`PHOTO_HASH_THRESHOLD`).
- The check runs before submit (a warning to the citizen) and on submit (the complaint is flagged, and the authority is notified).
- Why not compare the files byte by byte? Re-saving or resizing changes every byte, but the visual hash stays the same.

### 3. Nearest-worker smart assignment
```
score(worker) = distance from worker's base office (km) + 2 × worker's open tasks
lowest score wins
```
Distance uses the **Haversine formula** (great-circle distance between two lat/lng points). Example: a worker 1 km away with 3 tasks scores 7, and a worker 4 km away with 1 task scores 6, so the second worker gets it. This balances travel time against workload. Code: `backend/src/services/routing.js → rankWorkers / pickBestWorker`.

### 4. GPS-verified resolution
The worker taps **"I have reached the site"**. The browser sends the GPS position, and the server computes the Haversine distance to the complaint. **≤ 300 m = verified.** When the worker marks the complaint resolved, `resolutionVerified` is true only if a verified check-in happened during the current attempt. This stops "resolved from the office" fake closures. The authority dashboard counts verified and unverified fixes, and each worker gets a GPS-verified %.

### 5. Before / after slider
The citizen's first photo and the worker's first proof photo are stacked. The top image is clipped with CSS `clip-path: inset(0 X% 0 0)` controlled by a range slider. It appears on the complaint page and on the public tracking page.

### 6. QR acknowledgement receipt
The `qrcode` library encodes `http://<site>/track/<complaint number>`. Scanning it opens public tracking without login. "Print / Save as PDF" uses the browser's print dialog with print-only CSS.

### 7. Worker route planner
This is a variant of the **Travelling Salesman Problem**. Solving it exactly is NP-hard, so we use the **nearest-neighbour heuristic** with priority weighting:
```
next stop = the open task with the smallest  (distance × weight)
weight: Critical/escalated 0.35, High 0.6, others 1.0
```
Urgent jobs are therefore pulled earlier even if they are a little further away. The planner starts from the worker's live GPS position (or their base office), draws the route on the map and opens it in Google Maps.

### 8. Drag-and-drop assignment board
A Kanban board (New → Assigned → In progress → Resolved) built with the HTML5 Drag-and-Drop API. Drop a card on a worker to call `PATCH /complaints/:id/assign`. Tap-to-assign is the fallback for touch screens. Workers are re-ranked for the selected card.

### 9. Civic points & badges
Points: +10 per valid complaint, +2 for photo evidence, +15 when fixed, +5 for rating, +3 for supporting a neighbour. Rejected complaints earn 0. Levels: Newcomer → Active Citizen (50) → Civic Champion (150) → City Guardian (300). There are 7 badges, such as "Pothole Hunter" and "Community Voice". Points are computed live from the complaints, so they cannot be edited directly.

### 10. Civic Assistant chatbot
A rule-based intent matcher that needs no paid AI API. It detects a complaint number with a regex (`CMP-YYYY-NNNNNN`) and returns the live status. Keyword intents cover reporting, categories, deadlines, points, reopening and anonymity, plus Tamil keywords. Code: `backend/src/routes/assistant.js`.

### 11. Dark mode
CSS custom properties (design tokens) are redefined under `html[data-theme="dark"]`. The choice is saved in localStorage and applied before the page paints, so there is no flash.

---

## Features carried over from v2
- **AI category + priority prediction:** a Naive-Bayes-style text classifier with urgency keywords (`services/aiClassifier.js`).
- **Duplicate clustering:** same category within 250 m. "I'm affected too" support, and 3 supporters automatically raise the priority.
- **SLA engine:** deadlines by priority (Critical 24 h … Low 120 h). It checks every 60 s and auto-escalates in 2 levels.
- **Real-time notifications** with Socket.IO; JWT auth with bcrypt-hashed passwords; English/Tamil UI; voice input (Web Speech API).
- **Public transparency dashboard:** department scores, hotspots, trends. CSV report export.

---

## Likely viva questions

| Question | Answer |
|---|---|
| Why MongoDB? | Complaints have nested, variable data (timeline, comments, photos, GPS). A document model fits naturally, and Mongoose adds schema validation. |
| How is the password stored? | Hashed with bcrypt (10 salt rounds), never in plain text. Login returns a JWT that is valid for 7 days. |
| How do you stop a citizen from seeing others' complaints? | The `protect` middleware verifies the JWT, `authorize(role)` checks the role, and `canView()` checks ownership or department. Anonymous complaints hide the citizen's name. |
| What if the photo has no GPS? | The citizen taps "Use my location" (browser Geolocation API) or clicks the map. Address auto-fill uses OpenStreetMap reverse geocoding. |
| Can a worker fake a GPS check-in? | The browser GPS can be spoofed with developer tools. That is why the fix also needs a proof photo, and the citizen can reopen the complaint. A mobile app with device attestation is future scope. |
| Why a hash instead of AI image recognition? | It is fast, works offline in the browser and needs no training data. AI pothole detection from photos is listed as future scope. |
| Time complexity of the route planner? | O(n²) for n stops. That is fine for a worker's daily list (< 30 stops). |
| It runs without MongoDB installed — how? | `config/db.js` first tries real MongoDB (`MONGO_URI`). If that is unreachable, it starts a built-in MongoDB-compatible server (`config/embeddedDb.js`) that speaks the MongoDB wire protocol, runs queries with the *mingo* library and saves to a JSON file. Mongoose cannot tell the difference. |
| How are complaint numbers generated? | An atomic `$inc` on a Counter document per year gives `CMP-2026-000001`, `000002` and so on, without collisions. |
| What happens when a deadline is missed? | The SLA engine flags the complaint (Level 1) and notifies the authority, worker and citizen. After 24 h more (Level 2), it raises the priority. |

## Future scope
Native Android/iOS app · AI image classification of potholes and garbage · SMS/WhatsApp alerts · integration with municipal systems (CPGRAMS) · predictive hotspot analytics · more regional languages.
