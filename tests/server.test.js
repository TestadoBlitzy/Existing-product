/**
 * Comprehensive Jest Test Suite for server.js
 *
 * Tests the Node.js HTTP server for:
 * - HTTP method coverage (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD)
 * - Multi-path validation (/, /test, /nonexistent, /a/b/c/d, /path?query=value)
 * - Response contract enforcement (status 200, Content-Type text/plain, body "Hello, World!\n")
 * - Console startup message verification
 * - Server lifecycle management (address binding, clean shutdown)
 *
 * Targets 100% line, function, branch, and statement coverage of server.js.
 */

const request = require('supertest');

// Spy on console.log BEFORE requiring server.js
// (server.js calls console.log in the listen callback during module evaluation)
const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

const server = require('../server');

describe('Server', () => {
  // Ensure the server is fully listening before any tests execute.
  // server.listen() is called during require('../server') but it is asynchronous —
  // without this guard, supertest may find the server not yet bound and manage the
  // lifecycle itself (calling listen(0)/close per request), leaving the server
  // closed for non-supertest assertions like server.address().
  beforeAll((done) => {
    if (server.listening) {
      done();
    } else {
      server.on('listening', done);
    }
  });

  afterAll((done) => {
    consoleSpy.mockRestore();
    server.close(done);
  });

  // ---------------------------------------------------------------------------
  // HTTP Method Coverage Matrix — Root Path /
  // ---------------------------------------------------------------------------

  test('should return 200 with "Hello, World!\\n" for GET /', async () => {
    const res = await request(server).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('Hello, World!\n');
  });

  test('should return 200 with "Hello, World!\\n" for POST /', async () => {
    const res = await request(server).post('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('Hello, World!\n');
  });

  test('should return 200 with "Hello, World!\\n" for PUT /', async () => {
    const res = await request(server).put('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('Hello, World!\n');
  });

  test('should return 200 with "Hello, World!\\n" for DELETE /', async () => {
    const res = await request(server).delete('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('Hello, World!\n');
  });

  test('should return 200 with "Hello, World!\\n" for PATCH /', async () => {
    const res = await request(server).patch('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('Hello, World!\n');
  });

  test('should return 200 with "Hello, World!\\n" for OPTIONS /', async () => {
    const res = await request(server).options('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('Hello, World!\n');
  });

  test('should return 200 with correct headers for HEAD /', async () => {
    const res = await request(server).head('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    // HEAD responses have empty body per HTTP specification — no body assertion
  });

  // ---------------------------------------------------------------------------
  // Multi-Path Validation — Server responds identically to any URL path
  // ---------------------------------------------------------------------------

  test('should return identical response for GET /test', async () => {
    const res = await request(server).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('Hello, World!\n');
  });

  test('should return identical response for GET /nonexistent', async () => {
    const res = await request(server).get('/nonexistent');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('Hello, World!\n');
  });

  test('should return identical response for deeply nested path GET /a/b/c/d', async () => {
    const res = await request(server).get('/a/b/c/d');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('Hello, World!\n');
  });

  test('should return identical response for path with query string GET /path?query=value', async () => {
    const res = await request(server).get('/path?query=value');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('Hello, World!\n');
  });

  // ---------------------------------------------------------------------------
  // Response Contract Enforcement
  // ---------------------------------------------------------------------------

  test('should return response body with exact trailing newline', async () => {
    const res = await request(server).get('/');
    expect(res.text).toBe('Hello, World!\n');
    expect(res.text).toHaveLength(14);
  });

  test('should return identical responses for consecutive requests', async () => {
    const res1 = await request(server).get('/');
    const res2 = await request(server).get('/');
    expect(res1.text).toBe(res2.text);
    expect(res1.status).toBe(res2.status);
  });

  // ---------------------------------------------------------------------------
  // Server Startup Console Message Verification
  // ---------------------------------------------------------------------------

  test('should log the correct startup message on server start', () => {
    expect(consoleSpy).toHaveBeenCalledWith(
      'Server running at http://127.0.0.1:3000/'
    );
  });

  // ---------------------------------------------------------------------------
  // Server Lifecycle — Address Binding Verification
  // ---------------------------------------------------------------------------

  test('should be listening on the correct host and port', () => {
    const address = server.address();
    expect(address.address).toBe('127.0.0.1');
    expect(address.port).toBe(3000);
  });
});
