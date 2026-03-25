'use strict';

const { sanitizeLogInput, sanitizeUrl } = require('../../src/utils/sanitizer');

describe('sanitizer', () => {
  // =========================================================================
  // sanitizeLogInput
  // =========================================================================
  describe('sanitizeLogInput', () => {
    // -----------------------------------------------------------------------
    // Null / undefined handling
    // -----------------------------------------------------------------------
    test('returns empty string for null input', () => {
      expect(sanitizeLogInput(null)).toBe('');
    });

    test('returns empty string for undefined input', () => {
      expect(sanitizeLogInput(undefined)).toBe('');
    });

    // -----------------------------------------------------------------------
    // Empty and basic strings
    // -----------------------------------------------------------------------
    test('returns empty string for empty string input', () => {
      expect(sanitizeLogInput('')).toBe('');
    });

    test('returns normal string unchanged', () => {
      expect(sanitizeLogInput('hello world')).toBe('hello world');
    });

    // -----------------------------------------------------------------------
    // Non-string type coercion
    // -----------------------------------------------------------------------
    test('converts number to string', () => {
      expect(sanitizeLogInput(42)).toBe('42');
    });

    test('converts object to string via String()', () => {
      expect(sanitizeLogInput({})).toBe('[object Object]');
    });

    test('converts boolean to string', () => {
      expect(sanitizeLogInput(true)).toBe('true');
    });

    test('converts array to string', () => {
      expect(sanitizeLogInput([1, 2])).toBe('1,2');
    });

    // -----------------------------------------------------------------------
    // ANSI escape sequence removal
    // -----------------------------------------------------------------------
    test('strips ANSI red color code \\x1b[31m', () => {
      expect(sanitizeLogInput('\x1b[31mhello')).toBe('hello');
    });

    test('strips ANSI reset code \\x1b[0m', () => {
      expect(sanitizeLogInput('hello\x1b[0m')).toBe('hello');
    });

    test('strips multiple ANSI sequences from a string', () => {
      expect(sanitizeLogInput('\x1b[31mred text\x1b[0m')).toBe('red text');
    });

    test('strips ANSI bold code \\x1b[1m', () => {
      expect(sanitizeLogInput('\x1b[1mbold\x1b[0m')).toBe('bold');
    });

    test('strips complex ANSI sequences with multiple parameters like \\x1b[38;5;196m', () => {
      expect(sanitizeLogInput('\x1b[38;5;196mcolored\x1b[0m')).toBe('colored');
    });

    // -----------------------------------------------------------------------
    // Control character removal
    // -----------------------------------------------------------------------
    test('strips newline characters \\n', () => {
      expect(sanitizeLogInput('hello\nworld')).toBe('helloworld');
    });

    test('strips carriage return characters \\r', () => {
      expect(sanitizeLogInput('hello\rworld')).toBe('helloworld');
    });

    test('strips tab characters \\t', () => {
      expect(sanitizeLogInput('hello\tworld')).toBe('helloworld');
    });

    test('strips null byte \\x00', () => {
      expect(sanitizeLogInput('hello\x00world')).toBe('helloworld');
    });

    test('strips DEL character \\x7f', () => {
      expect(sanitizeLogInput('hello\x7fworld')).toBe('helloworld');
    });

    test('strips mixed control characters from string', () => {
      expect(sanitizeLogInput('a\nb\rc\td\x00e\x7ff')).toBe('abcdef');
    });

    test('strips \\r\\n (CRLF) sequences', () => {
      expect(sanitizeLogInput('line1\r\nline2')).toBe('line1line2');
    });

    // -----------------------------------------------------------------------
    // Truncation at MAX_LOG_LENGTH (1000)
    // -----------------------------------------------------------------------
    test('does not truncate string of exactly 1000 characters', () => {
      const input = 'a'.repeat(1000);
      const result = sanitizeLogInput(input);
      expect(result).toBe(input);
      expect(result).toHaveLength(1000);
    });

    test('truncates string of 1001 characters and appends ...[truncated]', () => {
      const input = 'a'.repeat(1001);
      const result = sanitizeLogInput(input);
      expect(result).toBe('a'.repeat(1000) + '...[truncated]');
    });

    test('truncates very long string and appends ...[truncated]', () => {
      const input = 'b'.repeat(5000);
      const result = sanitizeLogInput(input);
      expect(result).toBe('b'.repeat(1000) + '...[truncated]');
    });

    test('resulting truncated string is 1000 chars + "...[truncated]" indicator', () => {
      const input = 'c'.repeat(2000);
      const result = sanitizeLogInput(input);
      // '...[truncated]' is 14 characters, so total = 1000 + 14 = 1014
      expect(result).toHaveLength(1000 + '...[truncated]'.length);
      expect(result).toHaveLength(1014);
      expect(result.endsWith('...[truncated]')).toBe(true);
      expect(result.substring(0, 1000)).toBe('c'.repeat(1000));
    });

    // -----------------------------------------------------------------------
    // Combined scenarios
    // -----------------------------------------------------------------------
    test('strips ANSI sequences AND control characters in same string', () => {
      const input = '\x1b[31mhello\nworld\x1b[0m';
      expect(sanitizeLogInput(input)).toBe('helloworld');
    });

    test('handles string with only control characters returning empty string', () => {
      expect(sanitizeLogInput('\n\r\t\x00')).toBe('');
    });

    test('handles string with only ANSI sequences returning empty string', () => {
      expect(sanitizeLogInput('\x1b[31m\x1b[0m')).toBe('');
    });
  });

  // =========================================================================
  // sanitizeUrl
  // =========================================================================
  describe('sanitizeUrl', () => {
    // -----------------------------------------------------------------------
    // Null / undefined handling
    // -----------------------------------------------------------------------
    test('returns empty string for null input', () => {
      expect(sanitizeUrl(null)).toBe('');
    });

    test('returns empty string for undefined input', () => {
      expect(sanitizeUrl(undefined)).toBe('');
    });

    // -----------------------------------------------------------------------
    // Empty and basic strings
    // -----------------------------------------------------------------------
    test('returns empty string for empty string input', () => {
      expect(sanitizeUrl('')).toBe('');
    });

    test('returns normal URL path unchanged (no special chars)', () => {
      expect(sanitizeUrl('/api/health')).toBe('/api/health');
    });

    // -----------------------------------------------------------------------
    // Non-string type coercion
    // -----------------------------------------------------------------------
    test('converts number to string', () => {
      expect(sanitizeUrl(42)).toBe('42');
    });

    test('converts object to string', () => {
      expect(sanitizeUrl({})).toBe('[object Object]');
    });

    // -----------------------------------------------------------------------
    // ANSI escape sequence removal (same as sanitizeLogInput)
    // -----------------------------------------------------------------------
    test('strips ANSI escape sequences from URL', () => {
      expect(sanitizeUrl('\x1b[31m/api/test\x1b[0m')).toBe('/api/test');
    });

    // -----------------------------------------------------------------------
    // Control character removal (same as sanitizeLogInput)
    // -----------------------------------------------------------------------
    test('strips control characters from URL', () => {
      expect(sanitizeUrl('/api\n/test\r\t')).toBe('/api/test');
    });

    // -----------------------------------------------------------------------
    // HTML entity encoding — THIS IS UNIQUE TO sanitizeUrl
    // -----------------------------------------------------------------------
    test('encodes & as &amp;', () => {
      expect(sanitizeUrl('a&b')).toBe('a&amp;b');
    });

    test('encodes < as &lt;', () => {
      expect(sanitizeUrl('a<b')).toBe('a&lt;b');
    });

    test('encodes > as &gt;', () => {
      expect(sanitizeUrl('a>b')).toBe('a&gt;b');
    });

    test('encodes " as &quot;', () => {
      expect(sanitizeUrl('a"b')).toBe('a&quot;b');
    });

    test("encodes ' as &#x27;", () => {
      expect(sanitizeUrl("a'b")).toBe('a&#x27;b');
    });

    test('encodes multiple HTML special characters in one string', () => {
      expect(sanitizeUrl('a&b<c>d"e\'f')).toBe('a&amp;b&lt;c&gt;d&quot;e&#x27;f');
    });

    test('encodes <script>alert("xss")</script> fully', () => {
      expect(sanitizeUrl('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    // -----------------------------------------------------------------------
    // Truncation at MAX_URL_LENGTH (2048)
    // -----------------------------------------------------------------------
    test('does not truncate URL of exactly 2048 characters', () => {
      const input = 'a'.repeat(2048);
      const result = sanitizeUrl(input);
      expect(result).toBe(input);
      expect(result).toHaveLength(2048);
    });

    test('truncates URL of 2049 characters and appends ...[truncated]', () => {
      const input = 'a'.repeat(2049);
      const result = sanitizeUrl(input);
      expect(result).toBe('a'.repeat(2048) + '...[truncated]');
    });

    test('resulting truncated URL is 2048 chars + "...[truncated]" indicator', () => {
      const input = 'd'.repeat(5000);
      const result = sanitizeUrl(input);
      // '...[truncated]' is 14 characters, so total = 2048 + 14 = 2062
      expect(result).toHaveLength(2048 + '...[truncated]'.length);
      expect(result).toHaveLength(2062);
      expect(result.endsWith('...[truncated]')).toBe(true);
      expect(result.substring(0, 2048)).toBe('d'.repeat(2048));
    });

    // -----------------------------------------------------------------------
    // Order of operations: stripping before encoding before truncation
    // -----------------------------------------------------------------------
    test('strips control chars before HTML encoding', () => {
      // Control chars are removed first, then HTML entities are encoded
      const input = 'a\n&b';
      const result = sanitizeUrl(input);
      // \n stripped => 'a&b', then & => &amp; => 'a&amp;b'
      expect(result).toBe('a&amp;b');
    });

    test('HTML encodes after ANSI stripping', () => {
      // ANSI is stripped first, then HTML entities are encoded
      const input = '\x1b[31m<script>\x1b[0m';
      const result = sanitizeUrl(input);
      // ANSI stripped => '<script>', then HTML encoded => '&lt;script&gt;'
      expect(result).toBe('&lt;script&gt;');
    });

    // -----------------------------------------------------------------------
    // Combined edge case
    // -----------------------------------------------------------------------
    test('handles URL with ANSI, control chars, and HTML special chars together', () => {
      const input = '\x1b[31m/path\n?q=<script>"xss"</script>&x=1\x1b[0m';
      const result = sanitizeUrl(input);
      // Step 1: ANSI stripped => '/path\n?q=<script>"xss"</script>&x=1'
      // Step 2: Control chars stripped => '/path?q=<script>"xss"</script>&x=1'
      // Step 3: HTML encoded:
      //   & => &amp; first: '/path?q=<script>"xss"</script>&amp;x=1'
      //   < => &lt;:         '/path?q=&lt;script&gt;"xss"&lt;/script&gt;&amp;x=1'
      //   > => &gt;:         (already in above)
      //   " => &quot;:       '/path?q=&lt;script&gt;&quot;xss&quot;&lt;/script&gt;&amp;x=1'
      expect(result).toBe('/path?q=&lt;script&gt;&quot;xss&quot;&lt;/script&gt;&amp;x=1');
    });
  });
});
