'use strict';

const request = require('supertest');
const app = require('../server');

// ---------------------------------------------------------------------------
// Express app object verification
// ---------------------------------------------------------------------------
describe('Express app', () => {
  it('should be defined', () => {
    expect(app).toBeDefined();
  });

  it('should be a function', () => {
    expect(typeof app).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// GET / route — happy path
// ---------------------------------------------------------------------------
describe('GET /', () => {
  it('should return status 200', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  it('should return "Hello, World!\\n" with trailing newline', async () => {
    const res = await request(app).get('/');
    expect(res.text).toBe('Hello, World!\n');
  });

  it('should return Content-Type text/plain', async () => {
    const res = await request(app).get('/');
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });

  it('should not include X-Powered-By header', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GET /evening route — happy path
// ---------------------------------------------------------------------------
describe('GET /evening', () => {
  it('should return status 200', async () => {
    const res = await request(app).get('/evening');
    expect(res.status).toBe(200);
  });

  it('should return "Good evening" without trailing newline', async () => {
    const res = await request(app).get('/evening');
    expect(res.text).toBe('Good evening');
  });

  it('should return Content-Type text/plain', async () => {
    const res = await request(app).get('/evening');
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });

  it('should not include X-Powered-By header', async () => {
    const res = await request(app).get('/evening');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 404 error handling — undefined routes
// ---------------------------------------------------------------------------
describe('404 responses', () => {
  it('should return 404 for GET /nonexistent', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });

  it('should return 404 for GET /foo/bar', async () => {
    const res = await request(app).get('/foo/bar');
    expect(res.status).toBe(404);
  });

  it('should return 404 for GET /evening/extra', async () => {
    const res = await request(app).get('/evening/extra');
    expect(res.status).toBe(404);
  });

  it('should not include X-Powered-By header on 404 responses', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Unsupported HTTP methods on defined routes
// ---------------------------------------------------------------------------
describe('Unsupported HTTP methods', () => {
  describe('on / route', () => {
    it('should return 404 for POST /', async () => {
      const res = await request(app).post('/');
      expect(res.status).toBe(404);
    });

    it('should return 404 for PUT /', async () => {
      const res = await request(app).put('/');
      expect(res.status).toBe(404);
    });

    it('should return 404 for DELETE /', async () => {
      const res = await request(app).delete('/');
      expect(res.status).toBe(404);
    });

    it('should return 404 for PATCH /', async () => {
      const res = await request(app).patch('/');
      expect(res.status).toBe(404);
    });
  });

  describe('on /evening route', () => {
    it('should return 404 for POST /evening', async () => {
      const res = await request(app).post('/evening');
      expect(res.status).toBe(404);
    });

    it('should return 404 for PUT /evening', async () => {
      const res = await request(app).put('/evening');
      expect(res.status).toBe(404);
    });

    it('should return 404 for DELETE /evening', async () => {
      const res = await request(app).delete('/evening');
      expect(res.status).toBe(404);
    });

    it('should return 404 for PATCH /evening', async () => {
      const res = await request(app).patch('/evening');
      expect(res.status).toBe(404);
    });
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('should return correct response with query parameters on /', async () => {
    const res = await request(app).get('/?foo=bar');
    expect(res.status).toBe(200);
    expect(res.text).toBe('Hello, World!\n');
  });

  it('should return correct response with query parameters on /evening', async () => {
    const res = await request(app).get('/evening?time=now');
    expect(res.status).toBe(200);
    expect(res.text).toBe('Good evening');
  });

  it('should match /Evening case-insensitively and return 200', async () => {
    // Express 5.x routes are case-insensitive by default
    const res = await request(app).get('/Evening');
    expect(res.status).toBe(200);
    expect(res.text).toBe('Good evening');
  });

  it('should match /EVENING case-insensitively and return 200', async () => {
    // Express 5.x routes are case-insensitive by default
    const res = await request(app).get('/EVENING');
    expect(res.status).toBe(200);
    expect(res.text).toBe('Good evening');
  });

  it('should handle HEAD request to / with status 200 and no body', async () => {
    const res = await request(app).head('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBeFalsy();
  });

  it('should handle HEAD request to /evening with status 200 and no body', async () => {
    const res = await request(app).head('/evening');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBeFalsy();
  });

  it('should handle trailing slash GET /evening/ and return 200', async () => {
    // Express 5.x non-strict routing matches /evening/ to /evening by default
    const res = await request(app).get('/evening/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('Good evening');
  });

  it('should handle double slash GET //', async () => {
    const res = await request(app).get('//');
    // Double slashes may be normalized by Express — verify behavior
    // If normalized to /, should return 200; otherwise 404
    expect([200, 404]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// X-Powered-By header suppression — comprehensive verification
// ---------------------------------------------------------------------------
describe('X-Powered-By header suppression', () => {
  it('should be absent on GET / response', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('should be absent on GET /evening response', async () => {
    const res = await request(app).get('/evening');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('should be absent on 404 response', async () => {
    const res = await request(app).get('/unknown-path');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('should be absent on POST / response', async () => {
    const res = await request(app).post('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('should be absent on HEAD / response', async () => {
    const res = await request(app).head('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
