/**
 * api.js - shared client-side helper for every page of the Charity Event site.
 *
 * Centralises the small pieces of logic that would otherwise be duplicated on
 * every page:
 *   - the API base URL (so the site can be deployed separately from the API)
 *   - a thin wrapper around fetch() that always returns JSON and throws a
 *     readable Error when the server responds with a failure
 *   - a few formatting helpers used when rendering data into the DOM
 *
 * This file is loaded by the client-side pages AND the admin-side pages
 * (admin pages reference it as ../js/api.js).
 */

// When the client website and the Node.js API are hosted on the SAME server
// (e.g. both on the SCU cPanel) an empty string is correct because the pages
// already request "/api/...". If the API is deployed on a different origin,
// set API_BASE to that origin, e.g. "https://your-domain.com".
window.API_BASE = window.API_BASE || '';

/** Build an absolute (or same-origin) URL for an API path. */
function apiUrl(path) {
  return window.API_BASE + path;
}

/**
 * Perform a JSON request against the API.
 * @param {string} path   e.g. "/api/events/upcoming"
 * @param {object} [options] { method, body }
 * @returns {Promise<object>} the parsed JSON response
 * @throws {Error} when the HTTP status is not ok
 */
async function apiRequest(path, options = {}) {
  const config = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' }
  };
  if (options.body !== undefined) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(apiUrl(path), config);
  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    throw new Error(`Unexpected response from the server (${response.status}).`);
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || payload.error || `Request failed (${response.status}).`);
  }
  return payload;
}

/** GET helper. */
function apiGet(path) {
  return apiRequest(path, { method: 'GET' });
}

/** POST helper. */
function apiPost(path, body) {
  return apiRequest(path, { method: 'POST', body });
}

/** PUT helper. */
function apiPut(path, body) {
  return apiRequest(path, { method: 'PUT', body });
}

/** DELETE helper. */
function apiDelete(path) {
  return apiRequest(path, { method: 'DELETE' });
}

/** Escape user supplied text before inserting it into innerHTML. */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a database datetime as a short readable local string. */
function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/** Format a value as Australian dollars. */
function formatCurrency(value) {
  const n = Number(value || 0);
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** CSS class for an event status badge. */
function statusBadgeClass(status) {
  if (status === 'Active') return 'badge badge-active';
  if (status === 'Past') return 'badge badge-past';
  return 'badge badge-suspended';
}

/** Read a query string parameter from the current URL. */
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
