# PROG2002 Web Development II — Assessment 3

**Case study:** Charity Event — a complete dynamic website with a **client-side** website and an **admin-side** website, powered by a Node.js / Express RESTful API and a MySQL database.

| | |
|---|---|
| **Unit** | PROG2002 Web Development II |
| **Assessment** | A3 — Complete dynamic website (40%) |
| **Group** | 2 students |
| **Member 1** | Tianyu Xue — GitHub `xuety0416` — `xty3488543330@qq.com` |
| **Member 2** | Liwei Jin — GitHub `M1lkteaLiweiJin` — `1778257879@qq.com` |
| **Technology** | Node.js 18, Express 5, MySQL 8, HTML, CSS, JavaScript (DOM + Promises) |

---

## 1. Project structure

```
Charity_Event/
├── server.js                 # Express RESTful API (all endpoints)
├── event_db.js               # MySQL connection pool
├── charityevents_db.sql      # Full database schema + sample data (single file)
├── package.json              # Dependencies and npm scripts
├── README.md
└── public/
    ├── index.html            # Client - home page (upcoming events)
    ├── search.html           # Client - search / filter page
    ├── event-detail.html     # Client - event details + registrations + weather
    ├── register.html         # Client - event registration page  (NEW in A3)
    ├── css/style.css         # Shared stylesheet for both websites
    ├── js/api.js             # Shared API helper (fetch wrapper, formatters)
    └── admin/
        ├── index.html        # Admin - dashboard / list of all events (C.R.U.D read + delete)
        ├── new.html          # Admin - create a new event
        └── edit.html         # Admin - update an event + view its registrations
```

The client website is served from `/` and the admin website from `/admin`.

---

## 2. How to run the project

**Prerequisites:** Node.js 18+, MySQL 8.

```bash
# 1. Import the database (schema + sample data)
mysql -u root -p < charityevents_db.sql

# 2. Install dependencies
npm install

# 3. Start the API + websites
npm start
```

Then open:

* Client website: <http://localhost:3000/index.html>
* Admin website:  <http://localhost:3000/admin/index.html>

Database credentials default to `root / 123456` on `localhost`. They can be overridden with the environment variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (used when deploying to the SCU cPanel).

---

## 3. Database design

Four tables, three of them reused from Assessment 2 and one new in A3:

| Table | Purpose |
|---|---|
| `charity_organisations` | The charity that owns the events |
| `event_categories` | Event category lookup (Fun Run, Gala Dinner, …) |
| `charity_events` | Master event table. **A3 additions:** `latitude`, `longitude` (for the weather API) |
| `event_registrations` | **NEW in A3.** Records each ticket purchase |

`event_registrations` contains a unique identifier, the attendee details (name, email, phone), the number of tickets, the total amount, the registration date and a status. It is linked to `charity_events` with the `event_id` foreign key.

Business rules:

* One user may register for **many** events.
* A user can register for the **same** event **only once** — enforced by the composite `UNIQUE (event_id, attendee_email)` key.
* An event that already has registrations **cannot be deleted** (`FOREIGN KEY … ON DELETE RESTRICT` plus an application-level check).

The sample data contains 11 events (active, past and suspended) and 14 registrations.

---

## 4. RESTful API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/categories` | List all event categories |
| GET | `/api/organisations` | List all organisations |
| GET | `/api/events/upcoming` | Upcoming events (home page) |
| GET | `/api/events/search` | Filter by `categoryId`, `location`, `date`, `keyword` |
| GET | `/api/events/:eventId` | Event details **and its complete registration list** (latest first) |
| GET | `/api/events/:eventId/registrations` | Registrations of one event |
| POST | `/api/events/:eventId/registrations` | Create a registration (validation + duplicate check) |
| GET | `/api/events/:eventId/weather` | Weather forecast for the event day (Open-Meteo) |
| GET | `/api/admin/events` | **All** events with status + registration counts (admin list) |
| POST | `/api/events` | Create a new event |
| PUT | `/api/events/:eventId` | Update an existing event |
| DELETE | `/api/events/:eventId` | Delete an event (blocked when registrations exist → HTTP 409) |

All responses use the envelope `{ success: true, data }` or `{ success: false, message }` together with a meaningful HTTP status code (`400` validation, `404` not found, `409` conflict, `500` server error).

### Optional external API — Open-Meteo

The event details page calls `GET /api/events/:eventId/weather`. The API reads the `latitude` / `longitude` stored on the event, requests the daily forecast from `api.open-meteo.com` and translates the WMO weather code into readable text (e.g. `51 → Drizzle: light, moderate and dense`). Because Open-Meteo only forecasts about 16 days ahead, a friendly message is returned for events further in the future.

---

## 5. Features implemented

### Client-side website
* **Home** — lists upcoming events from the API.
* **Search** — filters events by category, location, date and keyword; results are rendered dynamically.
* **Event details** — shows the event, a fundraising progress bar, the weather forecast and the list of registrations **sorted by the latest purchase date**.
* **Registration (new)** — a validated form that collects the attendee details, the number of tickets and the registration date; it displays the event being registered for, calls the registration API and shows a confirmation message before navigating back to the event page.

### Admin-side website
* **List** — every event regardless of status (Active / Past / Suspended) with registration and ticket counts.
* **New** — validated form that creates an event.
* **Update** — select an event, edit its details and see its registrations; the same page can delete the event.
* **Delete** — inline delete button with clear feedback when the deletion is blocked by existing registrations.
* **Navigation** — the admin menu is present on every admin page.

---

## 6. Team contribution

| Area | Member |
|---|---|
| Part 1 — Database design and sample data | Tianyu Xue |
| Part 4 — Admin-side website | Tianyu Xue |
| Part 2 — RESTful API (C.R.U.D., registration, weather proxy) | Liwei Jin |
| Part 3 — Client-side website (registration page, event details) | Liwei Jin |
| Documentation and final integration | Both |

Work progress is recorded through the Git commit history in this repository.

---

## 7. Deploying to the SCU cPanel

1. Zip and upload the API (`server.js`, `event_db.js`, `package.json`) and the two website folders.
2. Create the MySQL database in cPanel and import `charityevents_db.sql` through phpMyAdmin.
3. Set the `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` environment variables (or edit the defaults in `event_db.js`).
4. If the websites are hosted on a different origin from the API, set `window.API_BASE` in `public/js/api.js` to the API URL.
