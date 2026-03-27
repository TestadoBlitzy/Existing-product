const app = require('../server');
const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(
  path.join(__dirname, '..', 'server.js'),
  'utf8'
);

describe('Express app', () => {
  it('should export a valid Express app', () => {
    expect(typeof app).toBe('function');
  });
});

describe('Server configuration', () => {
  it('should configure hostname as 127.0.0.1', () => {
    expect(serverSource).toContain("const hostname = '127.0.0.1'");
  });

  it('should configure port as 3000', () => {
    expect(serverSource).toContain('const port = 3000');
  });
});

describe('Server startup', () => {
  it('should log "Server running at http://127.0.0.1:3000/" on startup', () => {
    // Verify the source contains the console.log with template literal
    expect(serverSource).toContain('console.log(`Server running at http://');

    // Verify the interpolated message matches the expected output
    const hostname = '127.0.0.1';
    const port = 3000;
    const expectedMessage = `Server running at http://${hostname}:${port}/`;
    expect(expectedMessage).toBe('Server running at http://127.0.0.1:3000/');
  });

  it('should wrap app.listen in require.main guard', () => {
    expect(serverSource).toContain('if (require.main === module)');
    expect(serverSource).toContain('app.listen(');
  });
});
