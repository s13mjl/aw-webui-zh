import fs from 'fs';
import path from 'path';

describe('Buckets.vue CSV export', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/views/Buckets.vue'), 'utf8');

  test('uses the server-side CSV endpoint instead of building CSV in the browser', () => {
    expect(src).toMatch(/export\/csv/);
    expect(src).toMatch(/getStoredApiToken/);
    expect(src).toMatch(/link\.click\(\)/);
    expect(src).toMatch(/responseType:\s*'blob'/);
    expect(src).toMatch(/downloadFile\(/);
    expect(src).not.toMatch(/Papa/);
  });
});
