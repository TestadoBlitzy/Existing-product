'use strict';

/**
 * Log and URL Sanitization Utility
 *
 * Provides pure utility functions for sanitizing user-controlled input before
 * it is passed to the Winston logger or included in JSON response bodies.
 * Prevents log injection/forging attacks and reflected content injection.
 *
 * Exported Functions:
 *   - sanitizeLogInput(str) — Strips control characters and ANSI escape
 *     sequences from strings before logging. Caps length to prevent log DoS.
 *   - sanitizeUrl(str) — Encodes HTML-unsafe characters in URLs for safe
 *     inclusion in JSON response bodies. Strips control characters and caps
 *     length to prevent oversized reflected content.
 *
 * Usage:
 *   const { sanitizeLogInput, sanitizeUrl } = require('./utils/sanitizer');
 *   logger.warn(`404 - Not Found - ${sanitizeLogInput(req.originalUrl)}`);
 *   res.json({ message: `Not Found - ${sanitizeUrl(req.originalUrl)}` });
 *
 * Consumers:
 *   - src/middleware/notFound.js — imports { sanitizeLogInput, sanitizeUrl }
 *   - src/middleware/errorHandler.js — imports { sanitizeLogInput }
 *
 * @module src/utils/sanitizer
 */

// SECURITY: Log injection prevention utility — sanitizes user-controlled input
// before logging and response inclusion. While Winston's JSON structured logging
// provides inherent resistance to some log injection vectors (since log entries
// are serialized as JSON objects rather than concatenated strings), explicit
// sanitization is applied as defense-in-depth per OWASP recommendations.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum allowed length for sanitized log input strings.
 * Strings exceeding this limit are truncated with a '...[truncated]' indicator
 * to prevent extremely long malicious inputs from bloating log files.
 * @type {number}
 */
const MAX_LOG_LENGTH = 1000;

/**
 * Maximum allowed length for sanitized URL strings in response bodies.
 * 2048 characters is a widely adopted URL length limit (matching browser and
 * server conventions) to prevent oversized reflected content in JSON responses.
 * @type {number}
 */
const MAX_URL_LENGTH = 2048;

/**
 * Truncation indicator appended to strings that exceed the maximum length.
 * @type {string}
 */
const TRUNCATION_INDICATOR = '...[truncated]';

// ---------------------------------------------------------------------------
// Regex Patterns
// ---------------------------------------------------------------------------

// SECURITY: ANSI escape sequences (e.g., \x1b[31m for red, \x1b[0m for reset)
// can be injected into log output to manipulate terminal rendering, hide log
// entries, or forge log content when viewed in terminal-based log viewers.
const ANSI_ESCAPE_PATTERN = /\x1b\[[\d;]*[a-zA-Z]/g;

// SECURITY: Control characters in ranges \x00-\x1f (C0 controls including
// newline \x0a, carriage return \x0d, tab \x09, null \x00) and \x7f (DEL)
// can be used for log injection by inserting fake log lines via \r\n sequences,
// corrupting log parsers, or injecting invisible characters.
const CONTROL_CHAR_PATTERN = /[\x00-\x1f\x7f]/g;

// ---------------------------------------------------------------------------
// sanitizeLogInput
// ---------------------------------------------------------------------------

/**
 * Sanitizes a string for safe inclusion in log entries.
 *
 * Strips ANSI escape sequences and control characters (newlines, carriage
 * returns, tabs, null bytes, DEL, and all C0 control codes) from the input
 * to prevent log injection and log forging attacks. Caps the output length
 * at {@link MAX_LOG_LENGTH} characters to prevent log DoS via oversized input.
 *
 * Vulnerability addressed: Log injection via user-controlled input such as
 * req.originalUrl and req.method being passed directly to Winston logger
 * calls in notFound.js and errorHandler.js. An attacker could craft URLs
 * containing \r\n sequences to inject fake log entries.
 *
 * @param {*} str - The input value to sanitize. Accepts any type; null and
 *   undefined return empty string, non-strings are converted via String().
 * @returns {string} The sanitized string safe for logging.
 */
function sanitizeLogInput(str) {
  // Handle null and undefined gracefully — return empty string
  if (str === null || str === undefined) {
    return '';
  }

  // Convert non-string types (numbers, objects, etc.) to string representation
  let sanitized = typeof str === 'string' ? str : String(str);

  // SECURITY: Strip ANSI escape sequences first (multi-character patterns)
  // before stripping individual control characters, to ensure complete removal
  // of escape code sequences like \x1b[31m (red text) or \x1b[0m (reset).
  sanitized = sanitized.replace(ANSI_ESCAPE_PATTERN, '');

  // SECURITY: Strip all remaining control characters in the C0 range
  // (\x00-\x1f) and DEL (\x7f). This covers newlines (\n), carriage returns
  // (\r), tabs (\t), null bytes (\x00), and all other non-printable characters
  // that could be used to forge or corrupt log entries.
  sanitized = sanitized.replace(CONTROL_CHAR_PATTERN, '');

  // SECURITY: Cap string length to prevent extremely long malicious inputs
  // (e.g., megabyte-sized URLs) from bloating log files and consuming disk
  // space. The truncation indicator makes it clear the value was shortened.
  if (sanitized.length > MAX_LOG_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LOG_LENGTH) + TRUNCATION_INDICATOR;
  }

  return sanitized;
}

// ---------------------------------------------------------------------------
// sanitizeUrl
// ---------------------------------------------------------------------------

/**
 * Sanitizes a URL string for safe inclusion in JSON response bodies.
 *
 * Strips control characters and encodes HTML-unsafe characters to prevent
 * reflected content injection when URLs are echoed back in response messages
 * (e.g., the 404 handler: { message: "Not Found - <url>" }). Caps the output
 * length at {@link MAX_URL_LENGTH} characters to prevent oversized reflected
 * content in API responses.
 *
 * Vulnerability addressed: Reflected content injection in notFound.js where
 * req.originalUrl is interpolated directly into the JSON response body. An
 * attacker could craft a URL containing <script> tags or HTML entities that
 * might be rendered if the JSON response is accidentally interpreted as HTML.
 *
 * @param {*} str - The URL string to sanitize. Accepts any type; null and
 *   undefined return empty string, non-strings are converted via String().
 * @returns {string} The sanitized URL string safe for JSON response inclusion.
 */
function sanitizeUrl(str) {
  // Handle null and undefined gracefully — return empty string
  if (str === null || str === undefined) {
    return '';
  }

  // Convert non-string types to string representation
  let sanitized = typeof str === 'string' ? str : String(str);

  // SECURITY: Strip ANSI escape sequences and control characters using the
  // same patterns as sanitizeLogInput to remove newlines, carriage returns,
  // and other non-printable characters from the URL before encoding.
  sanitized = sanitized.replace(ANSI_ESCAPE_PATTERN, '');
  sanitized = sanitized.replace(CONTROL_CHAR_PATTERN, '');

  // SECURITY: Encode HTML-unsafe characters to prevent injection if the JSON
  // response is accidentally rendered as HTML by a browser or downstream
  // consumer. This is defense-in-depth — JSON responses should be served with
  // Content-Type: application/json, but encoding provides an extra safety layer.
  //   < → &lt;   (prevents <script>, <img>, etc.)
  //   > → &gt;   (closes injected HTML tags)
  //   " → &quot; (prevents attribute injection)
  //   ' → &#x27; (prevents attribute injection in single-quoted contexts)
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // SECURITY: Cap URL length to prevent excessively long reflected URLs in
  // response bodies. 2048 characters is the common browser/server URL limit.
  if (sanitized.length > MAX_URL_LENGTH) {
    sanitized = sanitized.substring(0, MAX_URL_LENGTH) + TRUNCATION_INDICATOR;
  }

  return sanitized;
}

// ---------------------------------------------------------------------------
// Module Exports
// ---------------------------------------------------------------------------

module.exports = { sanitizeLogInput, sanitizeUrl };
