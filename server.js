/**
 * server.js
 * ---------------------------------------------------------------------------
 * PROG2002 Web Development II - Assessment 3
 * Charity Event dynamic website - Node.js / Express RESTful API
 *
 * The API serves BOTH the client-side website (public/) and the admin-side
 * website (public/admin/). It was extended from Assessment 2 with:
 *
 *   Client-side endpoints
 *     GET    /api/categories                      list all event categories
 *     GET    /api/events/upcoming                 upcoming events (home page)
 *     GET    /api/events/search                   filter by category/location/date
 *     GET    /api/events/:eventId                 event details + registrations
 *     GET    /api/events/:eventId/weather         weather forecast (Open-Meteo)
 *     GET    /api/weather/upcoming                weather for the next events
 *
 *   Registration endpoints (Part 2 / Part 3)
 *     GET    /api/events/:eventId/registrations   list registrations of an event
 *     POST   /api/events/:eventId/registrations   create a registration
 *
 *   Admin-side endpoints (Part 2 / Part 4 - full C.R.U.D.)
 *     GET    /api/admin/events                    all events (any status)
 *     POST   /api/events                          create a new event
 *     PUT    /api/events/:eventId                 update an existing event
 *     DELETE /api/events/:eventId                 delete (blocked if registered)
 *
 * All responses use a consistent JSON envelope: { success, data } or
 * { success:false, message } together with a meaningful HTTP status code.
 * ---------------------------------------------------------------------------
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./event_db');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());                                  // parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// Static hosting:
//   /            -> client-side website (public/)
//   /admin       -> admin-side website  (public/admin/)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Turn an event row into the status shown in the admin list.
 * Suspended wins over the date based status.
 */
function deriveEventStatus(event) {
  if (event.is_suspended) return 'Suspended';
  return new Date(event.event_date) < new Date() ? 'Past' : 'Active';
}

/**
 * Translate an Open-Meteo WMO weather code into readable text
 * (mapping taken from the assessment brief, page 6).
 */
function describeWeatherCode(code) {
  if (code === 0) return 'Clear sky';
  if ([1, 2, 3].includes(code)) return 'Mainly clear, partly cloudy and overcast';
  if ([45, 48].includes(code)) return 'Fog and depositing rime fog';
  if ([51, 53, 55].includes(code)) return 'Drizzle: light, moderate and dense';
  if ([61, 63, 65].includes(code)) return 'Rain: light, moderate and heavy';
  if ([80, 81, 82].includes(code)) return 'Rain showers: light, moderate and violent';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm: slight or moderate';
  return 'Unknown weather condition';
}

/** Simple e-mail format check shared by the registration endpoint. */
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate the payload used to create / update a charity event.
 * @returns {string|null} an error message, or null when the payload is valid.
 */
function validateEventPayload(body) {
  const required = ['event_title', 'event_date', 'category_id', 'organisation_id', 'location'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') {
      return `Missing required field: ${field}`;
    }
  }
  if (Number.isNaN(Date.parse(body.event_date))) {
    return 'event_date must be a valid date/time value.';
  }
  if (Number(body.ticket_price) < 0) {
    return 'ticket_price cannot be negative.';
  }
  if (Number(body.fundraising_goal) < 0) {
    return 'fundraising_goal cannot be negative.';
  }
  return null;
}

// ===========================================================================
// Read endpoints - shared by the client-side website
// ===========================================================================

// GET /api/health  (quick check used when deploying to the cPanel server)
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Charity Event API is running.' });
});

// GET /api/categories  -> fill the category dropdown on the search page
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM event_categories ORDER BY category_name');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/organisations  -> fill the organisation dropdown on the admin form
app.get('/api/organisations', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM charity_organisations ORDER BY organisation_name');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/events/upcoming  -> home page ("Upcoming Charity Events")
// NOTE: this route must be declared before /api/events/:eventId so that
//       "upcoming" is not treated as an event id.
app.get('/api/events/upcoming', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, c.category_name, o.organisation_name
      FROM charity_events e
      JOIN event_categories c ON e.category_id = c.category_id
      JOIN charity_organisations o ON e.organisation_id = o.organisation_id
      WHERE e.is_suspended = false AND e.event_date > NOW()
      ORDER BY e.event_date ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/events/search?categoryId=&location=&date=&keyword=
app.get('/api/events/search', async (req, res) => {
  try {
    const { categoryId, location, date, keyword } = req.query;
    let sql = `
      SELECT e.*, c.category_name, o.organisation_name
      FROM charity_events e
      JOIN event_categories c ON e.category_id = c.category_id
      JOIN charity_organisations o ON e.organisation_id = o.organisation_id
      WHERE e.is_suspended = false
    `;
    const params = [];
    if (categoryId) {
      sql += ' AND e.category_id = ?';
      params.push(categoryId);
    }
    if (location) {
      sql += ' AND e.location LIKE ?';
      params.push(`%${location}%`);
    }
    if (date) {
      sql += ' AND DATE(e.event_date) = ?';
      params.push(date);
    }
    if (keyword) {
      sql += ' AND (e.event_title LIKE ? OR e.event_description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    sql += ' ORDER BY e.event_date ASC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===========================================================================
// Admin read endpoint (Part 4 - "List feature")
// ===========================================================================

// GET /api/admin/events
// Returns EVERY event regardless of status (Active / Past / Suspended) together
// with the registration count and tickets sold, which the admin needs.
app.get('/api/admin/events', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, c.category_name, o.organisation_name,
        (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.event_id) AS registration_count,
        (SELECT COALESCE(SUM(r.tickets_purchased), 0) FROM event_registrations r WHERE r.event_id = e.event_id) AS tickets_sold,
        CASE
          WHEN e.is_suspended = true THEN 'Suspended'
          WHEN e.event_date < NOW() THEN 'Past'
          ELSE 'Active'
        END AS event_status
      FROM charity_events e
      JOIN event_categories c ON e.category_id = c.category_id
      JOIN charity_organisations o ON e.organisation_id = o.organisation_id
      ORDER BY e.event_date DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===========================================================================
// Single event + its registrations
// ===========================================================================

// GET /api/events/:eventId
// Part 2 requirement: one endpoint returns the event details AND the complete
// list of registrations for that event (latest purchase first).
app.get('/api/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const [rows] = await pool.query(`
      SELECT e.*, c.category_name, o.organisation_name, o.mission, o.contact_email
      FROM charity_events e
      JOIN event_categories c ON e.category_id = c.category_id
      JOIN charity_organisations o ON e.organisation_id = o.organisation_id
      WHERE e.event_id = ?
    `, [eventId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const event = rows[0];
    event.event_status = deriveEventStatus(event);
    event.registrations = await getRegistrationsForEvent(eventId);
    event.tickets_sold = event.registrations.reduce((sum, r) => sum + r.tickets_purchased, 0);

    res.json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Query helper reused by the details page, the registration endpoint and the
 * admin update page. Registrations are always returned newest first.
 */
async function getRegistrationsForEvent(eventId) {
  const [rows] = await pool.query(`
    SELECT registration_id, event_id, attendee_name, attendee_email, contact_phone,
           tickets_purchased, total_amount, registration_date, registration_status
    FROM event_registrations
    WHERE event_id = ?
    ORDER BY registration_date DESC, registration_id DESC
  `, [eventId]);
  return rows;
}

// GET /api/events/:eventId/registrations
app.get('/api/events/:eventId/registrations', async (req, res) => {
  try {
    const rows = await getRegistrationsForEvent(req.params.eventId);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===========================================================================
// Registration create (Part 2 / Part 3)
// ===========================================================================

// POST /api/events/:eventId/registrations
// Body: { attendee_name, attendee_email, contact_phone, tickets_purchased,
//         registration_date? }
// Rules: all user details required, valid e-mail, >= 1 ticket, the event must
//        exist and not be suspended, and a user may register for the same event
//        only once.
app.post('/api/events/:eventId/registrations', async (req, res) => {
  const { eventId } = req.params;
  const {
    attendee_name: attendeeName,
    attendee_email: attendeeEmail,
    contact_phone: contactPhone,
    tickets_purchased: ticketsPurchased,
    registration_date: registrationDate
  } = req.body || {};

  // ---- server-side validation (never trust the browser) ----
  if (!attendeeName || String(attendeeName).trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Please enter the attendee name.' });
  }
  if (!isValidEmail(attendeeEmail)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid e-mail address.' });
  }
  if (!contactPhone || String(contactPhone).trim().length < 6) {
    return res.status(400).json({ success: false, message: 'Please enter a valid contact phone number.' });
  }
  const tickets = Number(ticketsPurchased);
  if (!Number.isInteger(tickets) || tickets < 1 || tickets > 10) {
    return res.status(400).json({ success: false, message: 'Number of tickets must be between 1 and 10.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // The event must exist and must not be suspended.
    const [eventRows] = await connection.query(
      'SELECT event_id, ticket_price, is_suspended FROM charity_events WHERE event_id = ? FOR UPDATE',
      [eventId]
    );
    if (eventRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (eventRows[0].is_suspended) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'This event is suspended and cannot be registered for.' });
    }

    // One user can only register for the same event once.
    const [duplicates] = await connection.query(
      'SELECT registration_id FROM event_registrations WHERE event_id = ? AND attendee_email = ?',
      [eventId, String(attendeeEmail).trim().toLowerCase()]
    );
    if (duplicates.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'This e-mail address has already registered for this event.'
      });
    }

    const totalAmount = Number(eventRows[0].ticket_price || 0) * tickets;
    const [result] = await connection.query(`
      INSERT INTO event_registrations
        (event_id, attendee_name, attendee_email, contact_phone, tickets_purchased,
         total_amount, registration_date, registration_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed')
    `, [
      eventId,
      String(attendeeName).trim(),
      String(attendeeEmail).trim().toLowerCase(),
      String(contactPhone).trim(),
      tickets,
      totalAmount,
      registrationDate ? new Date(registrationDate) : new Date()
    ]);

    // Keep the fundraising progress up to date using the ticket revenue.
    await connection.query(
      'UPDATE charity_events SET current_progress = current_progress + ? WHERE event_id = ?',
      [totalAmount, eventId]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Registration confirmed.',
      data: {
        registration_id: result.insertId,
        event_id: Number(eventId),
        tickets_purchased: tickets,
        total_amount: totalAmount
      }
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

// ===========================================================================
// Admin write endpoints (Part 2 / Part 4 - Create / Update / Delete)
// ===========================================================================

// POST /api/events  -> create a new charity event
app.post('/api/events', async (req, res) => {
  const error = validateEventPayload(req.body || {});
  if (error) return res.status(400).json({ success: false, message: error });

  const {
    organisation_id: organisationId,
    category_id: categoryId,
    event_title: eventTitle,
    event_description: eventDescription,
    event_date: eventDate,
    location,
    latitude,
    longitude,
    ticket_price: ticketPrice,
    fundraising_goal: fundraisingGoal,
    current_progress: currentProgress,
    is_suspended: isSuspended
  } = req.body;

  try {
    const [result] = await pool.query(`
      INSERT INTO charity_events
        (organisation_id, category_id, event_title, event_description, event_date,
         location, latitude, longitude, ticket_price, fundraising_goal,
         current_progress, is_suspended)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      organisationId, categoryId, eventTitle, eventDescription || null, new Date(eventDate),
      location, latitude || null, longitude || null,
      ticketPrice || 0, fundraisingGoal || 0,
      currentProgress || 0, isSuspended ? 1 : 0
    ]);
    res.status(201).json({
      success: true,
      message: 'Event created successfully.',
      data: { event_id: result.insertId }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/events/:eventId  -> update an existing event
app.put('/api/events/:eventId', async (req, res) => {
  const { eventId } = req.params;
  const error = validateEventPayload(req.body || {});
  if (error) return res.status(400).json({ success: false, message: error });

  const {
    organisation_id: organisationId,
    category_id: categoryId,
    event_title: eventTitle,
    event_description: eventDescription,
    event_date: eventDate,
    location,
    latitude,
    longitude,
    ticket_price: ticketPrice,
    fundraising_goal: fundraisingGoal,
    current_progress: currentProgress,
    is_suspended: isSuspended
  } = req.body;

  try {
    const [result] = await pool.query(`
      UPDATE charity_events SET
        organisation_id = ?, category_id = ?, event_title = ?, event_description = ?,
        event_date = ?, location = ?, latitude = ?, longitude = ?, ticket_price = ?,
        fundraising_goal = ?, current_progress = ?, is_suspended = ?
      WHERE event_id = ?
    `, [
      organisationId, categoryId, eventTitle, eventDescription || null, new Date(eventDate),
      location, latitude || null, longitude || null,
      ticketPrice || 0, fundraisingGoal || 0,
      currentProgress || 0, isSuspended ? 1 : 0, eventId
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.json({ success: true, message: 'Event updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/events/:eventId
// Data integrity: an event that already has registrations cannot be deleted.
app.delete('/api/events/:eventId', async (req, res) => {
  const { eventId } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [eventRows] = await connection.query(
      'SELECT event_id FROM charity_events WHERE event_id = ? FOR UPDATE', [eventId]
    );
    if (eventRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const [[{ count }]] = await connection.query(
      'SELECT COUNT(*) AS count FROM event_registrations WHERE event_id = ?', [eventId]
    );
    if (count > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `This event cannot be deleted because it already has ${count} registration(s).`,
        registration_count: count
      });
    }

    await connection.query('DELETE FROM charity_events WHERE event_id = ?', [eventId]);
    await connection.commit();
    res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

// ===========================================================================
// Optional external API - Open-Meteo weather forecast (extra points)
// ===========================================================================
// The forecast is requested from the free Open-Meteo service using the
// latitude / longitude stored on each event. Responses are cached in memory for
// 30 minutes so that repeated page views do not hammer the public API.

const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;
const weatherCache = new Map();          // cache key -> { expires, days }

/** Emoji icon for a WMO weather code (rendered by the AngularJS templates). */
function getWeatherIcon(code) {
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if ([51, 53, 55].includes(code)) return '🌦️';
  if ([61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return '❔';
}

/** Friendly, human readable advice derived from a single forecast day. */
function buildWeatherAdvice(day) {
  const tips = [];
  if (day.precipitation_probability >= 50) {
    tips.push('Rain is likely, so bring an umbrella and waterproof shoes.');
  } else if (day.precipitation_probability >= 25) {
    tips.push('There is a chance of showers, so a light jacket may help.');
  }
  if (day.temp_max >= 30) tips.push('It will be hot, remember to bring water and sunscreen.');
  else if (day.temp_min <= 10) tips.push('It will be chilly, so wear warm clothing.');
  if (day.wind_max >= 40) tips.push('Strong winds are expected.');
  if (tips.length === 0) tips.push('Great conditions for an outdoor charity event.');
  return tips.join(' ');
}

/** Format a JS date as YYYY-MM-DD using the server's local time zone. */
function formatLocalDate(value) {
  const d = new Date(value);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Whole days between today and a YYYY-MM-DD date (negative = in the past). */
function daysUntil(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

/** Map the Open-Meteo "daily" block into an array of clean day objects. */
function mapForecastDays(daily) {
  if (!daily || !daily.time) return [];
  return daily.time.map((date, i) => ({
    date,
    weather_code: daily.weather_code[i],
    description: describeWeatherCode(daily.weather_code[i]),
    icon: getWeatherIcon(daily.weather_code[i]),
    temp_max: daily.temperature_2m_max[i],
    temp_min: daily.temperature_2m_min[i],
    precipitation_probability: daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null,
    wind_max: daily.wind_speed_10m_max ? daily.wind_speed_10m_max[i] : null
  }));
}

/**
 * Call Open-Meteo for a location and date range, using a 30 minute cache.
 * @returns {Promise<Array>} the forecast days.
 */
async function getForecast(latitude, longitude, startDate, endDate) {
  const key = `${latitude},${longitude},${startDate},${endDate}`;
  const cached = weatherCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.days;

  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${latitude}&longitude=${longitude}`
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max'
    + '&timezone=Australia%2FSydney'
    + `&start_date=${startDate}&end_date=${endDate}`;

  const response = await fetch(url);              // global fetch (Node 18+)
  if (!response.ok) throw new Error(`Open-Meteo responded with ${response.status}`);
  const forecast = await response.json();
  const days = mapForecastDays(forecast.daily);

  weatherCache.set(key, { expires: Date.now() + WEATHER_CACHE_TTL_MS, days });
  return days;
}

// GET /api/events/:eventId/weather
// Returns the forecast for the event day, a short outlook for the following
// days and a friendly recommendation for the attendees.
app.get('/api/events/:eventId/weather', async (req, res) => {
  const { eventId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT event_title, event_date, location, latitude, longitude FROM charity_events WHERE event_id = ?',
      [eventId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const event = rows[0];
    if (event.latitude === null || event.longitude === null) {
      return res.json({ success: false, message: 'No coordinates are stored for this event.' });
    }

    const eventDate = formatLocalDate(event.event_date);
    const offset = daysUntil(eventDate);
    if (offset < 0) {
      return res.json({ success: false, message: 'This event has already taken place.' });
    }
    if (offset > 16) {
      return res.json({
        success: false,
        message: 'A weather forecast is not yet available because the event is more than 16 days away.'
      });
    }

    // Outlook = the event day plus the following four days, capped at the end
    // of the Open-Meteo forecast window (about 16 days ahead).
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + 15);
    const outlookEnd = new Date(eventDate + 'T00:00:00');
    outlookEnd.setDate(outlookEnd.getDate() + 4);
    const endDate = formatLocalDate(outlookEnd < windowEnd ? outlookEnd : windowEnd);

    const days = await getForecast(event.latitude, event.longitude, eventDate, endDate);
    if (days.length === 0) {
      return res.json({ success: false, message: 'The forecast is not yet available for this date.' });
    }

    res.json({
      success: true,
      data: {
        location: event.location,
        event_date: eventDate,
        event_day: days[0],
        advice: buildWeatherAdvice(days[0]),
        outlook: days
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: `Weather service unavailable: ${err.message}` });
  }
});

// GET /api/weather/upcoming
// Compact weather summaries for the next upcoming events, used by the event
// cards on the client home page. Events without coordinates, events in the past
// and events outside the forecast window are skipped.
app.get('/api/weather/upcoming', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT event_id, event_date, latitude, longitude
      FROM charity_events
      WHERE is_suspended = false
        AND event_date > NOW()
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      ORDER BY event_date ASC
      LIMIT 6
    `);

    const summaries = await Promise.all(rows.map(async (event) => {
      const eventDate = formatLocalDate(event.event_date);
      const offset = daysUntil(eventDate);
      if (offset < 0 || offset > 16) return null;
      try {
        const days = await getForecast(event.latitude, event.longitude, eventDate, eventDate);
        if (days.length === 0) return null;
        return {
          event_id: event.event_id,
          date: days[0].date,
          icon: days[0].icon,
          description: days[0].description,
          temp_max: days[0].temp_max,
          temp_min: days[0].temp_min,
          precipitation_probability: days[0].precipitation_probability
        };
      } catch (e) {
        return null;   // one failing location must not break the whole list
      }
    }));

    res.json({ success: true, data: summaries.filter(Boolean) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// 404 + global error handling
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Unexpected server error.' });
});

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Charity Event API running on http://localhost:${PORT}`);
  console.log(`Client site : http://localhost:${PORT}/index.html`);
  console.log(`Admin  site : http://localhost:${PORT}/admin/index.html`);
});

module.exports = app;
