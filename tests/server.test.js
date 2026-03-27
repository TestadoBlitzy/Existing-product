const request = require('supertest');
const app = require('../server');

describe('GET /', () => {
  it('should return 200 with "Hello, World!\\n"', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('Hello, World!\n');
  });

  it('should return Content-Type text/plain', async () => {
    const res = await request(app).get('/');
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });

  it('should not have x-powered-by header', async () => {
    const res = await request(app).get('/');
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });
});

describe('GET /good-evening', () => {
  it('should return 200 with "Good evening"', async () => {
    const res = await request(app).get('/good-evening');
    expect(res.status).toBe(200);
    expect(res.text).toBe('Good evening');
  });

  it('should return Content-Type text/plain', async () => {
    const res = await request(app).get('/good-evening');
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });

  it('should not have x-powered-by header', async () => {
    const res = await request(app).get('/good-evening');
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });
});

describe('404 handling', () => {
  it('should return 404 for GET /nonexistent', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Cannot GET /nonexistent');
  });

  it('should return 404 for GET /foo/bar/baz', async () => {
    const res = await request(app).get('/foo/bar/baz');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Cannot GET /foo/bar/baz');
  });

  it('should not have x-powered-by header on 404 responses', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });
});
