# PROG2002 Web Development II — Assessment 3

**Case study:** Charity Event — a complete dynamic website with a **client-side** website and an **admin-side** website, powered by a Node.js / Express RESTful API, a MySQL database and an **AngularJS** front-end.

| | |
|---|---|
| **Unit** | PROG2002 Web Development II |
| **Assessment** | A3 — Complete dynamic website (40%) |
| **Group** | 2 students |
| **Member 1** | Tianyu Xue — GitHub `xuety0416` — `xty3488543330@qq.com` |
| **Member 2** | Liwei Jin — GitHub `M1lkteaLiweiJin` — `1778257879@qq.com` |
| **Front-end** | AngularJS 1.8.3 (vendored locally, client-side **and** admin-side) |
| **Back-end** | Node.js 18, Express 5, MySQL 8 |
| **External API** | Open-Meteo weather forecast (optional task) |

---

## 1. Project structure

```
Charity_Event/
├── server.js                 # Express RESTful API (all endpoints)
├── event_db.js               # MySQL connection pool
├── charityevents_db.sql      # Full database schema + sample data (single file)
├── package.json              # Dependencies and npm scripts
├── README.md
└── public/                   # AngularJS front-end
    ├── index.html            # Client - home page (upcoming events + weather chips)
    ├── search.html           # Client - search / filter page
    ├── event-detail.html     # Client - event details, registrations, weather outlook
    ├── register.html         # Client - event registration page
    ├── css/style.css         # Shared stylesheet for both websites
    ├── js/
    │   ├── app.js            # AngularJS module: services, filters, directives, controllers
    │   └── vendor/
    │       └── angular.min.js  # AngularJS 1.8.3 (vendored so no CDN is required)
    └── admin/                # Admin website (same AngularJS module)
        ├── index.html        # Dashboard / list of all events (read + delete)
        ├── new.html          # Create a new event
        └── edit.html         # Update an event + view its registrations
```

The client website is served from `/` and the admin website from `/admin` (Express static folders).

---

## 2. How to run the project

**Prerequisites:** Node.js 18+ and MySQL 8.

```bash
# 1. Import the database (schema + sample data)
mysql -u root -p < charityevents_db.sql

# 2. Install dependencies
npm install

# 3. Start the API and both websites
npm start
```

Then open:

* Client website: <http://localhost:3000/index.html>
* Admin website:  <http://localhost:3000/admin/index.html>

Database credentials default to `root / 123456` on `localhost` and can be overridden with the environment variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — required when deploying to the SCU cPanel.

---

## 3. AngularJS architecture

The whole front-end is one AngularJS application (`ng-app="charityApp"`). Every page is a view that
declares its own controller, so the same module and the same reusable components are shared by the
client website and the admin website.

**Module:** `public/js/app.js`

| Type | Name | Purpose |
|---|---|---|
| Constant | `API_BASE` | API origin (`window.API_BASE`), empty when the API is on the same host |
| Factory | `apiService` | `$http` wrapper: `get / post / put / remove`, normalises the `{ success, data }` envelope and rejects with a readable `Error` |
| Factory | `queryParams` | Reads the query string (`?id=...`) of the current page |
| Filter | `auDate` | Formats a database datetime for display |
| Filter | `shortDate` | Formats a date for the weather outlook cards |
| Filter | `auCurrency` | Formats money as AUD |
| Filter | `statusClass` | Maps `Active / Past / Suspended` to the badge CSS class |
| Directive | `<event-card>` | One event card (used by home and search) with an optional weather chip |
| Directive | `<registration-table>` | Renders an event's registrations, newest purchase first |

**Controllers**

| Page | Controller | Data used |
|---|---|---|
| Home | `HomeController` | `GET /api/events/upcoming`, `GET /api/weather/upcoming` |
| Search | `SearchController` | `GET /api/categories`, `GET /api/events/search` |
| Event details | `EventDetailController` | `GET /api/events/:id`, `GET /api/events/:id/weather` |
| Registration | `RegisterController` | `GET /api/events/:id`, `POST /api/events/:id/registrations` |
| Admin dashboard | `AdminDashboardController` | `GET /api/admin/events`, `DELETE /api/events/:id` |
| Admin new event | `AdminNewEventController` | `GET /api/organisations`, `/api/categories`, `POST /api/events` |
| Admin update | `AdminEditEventController` | `GET /api/admin/events`, `GET /api/events/:id`, `PUT /api/events/:id` |

AngularJS features used: dependency injection (array notation so the code survives minification),
`ng-app` / `ng-controller` / `ng-repeat` / `ng-if` / `ng-model` / `ng-options` / `ng-class` / `ng-style` /
`ng-submit` / `ng-disabled`, form validation (`$valid`, `$touched`, `$invalid`), `$http` with promises,
custom filters, custom directives with isolate scopes, two-way data binding and `ng-cloak`.

---

## 4. Database design

Four tables, three reused from Assessment 2 and one added in A3:

| Table | Purpose |
|---|---|
| `charity_organisations` | The charity that owns the events |
| `event_categories` | Event category lookup (Fun Run, Gala Dinner, …) |
| `charity_events` | Master event table. **A3 additions:** `latitude`, `longitude` (for the weather API) |
| `event_registrations` | **New in A3.** Records each ticket purchase |

`event_registrations` stores a unique identifier, the attendee details (name, email, phone), the number
of tickets, the total amount, the registration date and a status. It is linked to `charity_events`
through the `event_id` foreign key.

Business rules:

* One user may register for **many** events.
* A user can register for the **same** event **only once** — enforced by `UNIQUE (event_id, attendee_email)`.
* An event that already has registrations **cannot be deleted** (`ON DELETE RESTRICT` plus an application check).

The sample data contains 11 events (active, past and suspended) and 14 registrations.

---

## 5. RESTful API

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
| GET | `/api/events/:eventId/weather` | Event-day forecast, 5-day outlook and advice (Open-Meteo) |
| GET | `/api/weather/upcoming` | Compact weather summary for the next events (home page chips) |
| GET | `/api/admin/events` | **All** events with status + registration counts (admin list) |
| POST | `/api/events` | Create a new event |
| PUT | `/api/events/:eventId` | Update an existing event |
| DELETE | `/api/events/:eventId` | Delete an event (blocked when registrations exist → HTTP 409) |

Responses use the envelope `{ success: true, data }` or `{ success: false, message }` with a meaningful
status code (`400` validation, `404` not found, `409` conflict, `500` server error).

---

## 6. Optional external API — Open-Meteo

`GET /api/events/:eventId/weather` reads the `latitude` / `longitude` stored on the event and requests
the daily forecast from the free **Open-Meteo** service (`api.open-meteo.com`). The API then:

* translates the WMO weather code into readable text and an icon
  (e.g. `51 → 🌦️ Drizzle: light, moderate and dense`);
* returns the event-day summary plus a five-day outlook;
* generates a friendly recommendation for attendees (umbrella, water, warm clothing …);
* **caches the response for 30 minutes** so repeated page views do not hammer the public API.

Because Open-Meteo only forecasts about 16 days ahead, a friendly message is returned for events
further in the future, for past events and for events without stored coordinates.

The client event cards on the home page use `GET /api/weather/upcoming`, which returns a compact
summary (icon, temperatures, chance of rain) for the next events.

---

## 7. Features implemented

### Client-side website
* **Home** — upcoming events with a weather chip on each card.
* **Search** — filters events by category, location, date and keyword, with client-side validation.
* **Event details** — event information, fundraising progress, weather forecast + outlook, and the
  list of registrations **sorted by the latest purchase date**.
* **Registration** — a validated form that collects the attendee details, ticket count and
  registration date, displays the event being registered for, calls the API and shows a confirmation
  message before navigating back to the event page.

### Admin-side website
* **List** — every event regardless of status (Active / Past / Suspended) with registration and ticket counts.
* **New** — validated form that creates an event.
* **Update** — select an event, edit its details and see its registrations.
* **Delete** — inline delete with clear feedback when the API blocks the deletion.
* **Navigation** — the admin menu is present on every admin page.

---

## 8. Team contribution

| Area | Member |
|---|---|
| Part 1 — Database design and sample data | Tianyu Xue |
| Part 4 — Admin-side website | Tianyu Xue |
| AngularJS framework and shared front-end module | Tianyu Xue |
| Client-side website converted to AngularJS | Tianyu Xue |
| Admin-side website converted to AngularJS | Tianyu Xue |
| Part 2 — RESTful API (C.R.U.D., registration) | Liwei Jin |
| Part 3 — Client-side website (registration page, event details) | Liwei Jin |
| Open-Meteo weather integration | Liwei Jin |
| Documentation | Liwei Jin |

Work progress is recorded through the Git commit history in this repository.

---

## 9. Deploying to the SCU cPanel

1. Zip and upload the API (`server.js`, `event_db.js`, `package.json`) and the two website folders
   (remember to include `public/js/vendor/angular.min.js`).
2. Create the MySQL database in cPanel and import `charityevents_db.sql` through phpMyAdmin.
3. Set the `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` environment variables (or edit the defaults
   in `event_db.js`).
4. If the websites are hosted on a different origin from the API, set `window.API_BASE` before
   `js/app.js` is loaded.
