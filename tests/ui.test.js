/**
 * UI Route Test Suite for server.js
 *
 * Tests the GET /ui route that serves public/ui.html for:
 * - Status code 200
 * - Content-Type text/html
 * - HTML body markers (<button>, "Run Validation", <main>)
 * - Regression guard: GET / still returns plain text "Hello, World!\n"
 */

const request = require('supertest');

// Spy on console.log BEFORE requiring server.js
// (server.js calls console.log in the listen callback during module evaluation)
const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

const server = require('../server');

describe('UI Route', () => {
  // Ensure the server is fully listening before any tests execute.
  // server.listen() is called during require('../server') but it is asynchronous —
  // without this guard, supertest may find the server not yet bound and manage the
  // lifecycle itself, leaving the server in an inconsistent state.
  beforeAll((done) => {
    if (server.listening) {
      done();
    } else {
      server.on('listening', done);
      server.on('error', (err) => done(err));
    }
  });

  afterAll((done) => {
    consoleSpy.mockRestore();
    server.close(done);
  });

  // ---------------------------------------------------------------------------
  // GET /ui — Serves the HTML validation page
  // ---------------------------------------------------------------------------

  test('should return 200 for GET /ui', async () => {
    const res = await request(server).get('/ui');
    expect(res.status).toBe(200);
  });

  test('should return Content-Type text/html for GET /ui', async () => {
    const res = await request(server).get('/ui');
    expect(res.headers['content-type']).toMatch(/html/);
  });

  test('should return response body with expected HTML markers for GET /ui', async () => {
    const res = await request(server).get('/ui');
    expect(res.text).toContain('<button');
    expect(res.text).toContain('Run Validation');
    expect(res.text).toContain('<main');
  });

  // ---------------------------------------------------------------------------
  // Regression Guard — GET / still returns plain text "Hello, World!\n"
  // ---------------------------------------------------------------------------

  test('should still return "Hello, World!\\n" as plain text for GET / (regression guard)', async () => {
    const res = await request(server).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('Hello, World!\n');
  });
});
