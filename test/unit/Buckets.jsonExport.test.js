import fs from 'fs';
import path from 'path';

describe('Buckets.vue JSON export', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/views/Buckets.vue'), 'utf8');

  test('does not parse or pretty-print large export JSON in the WebView', () => {
    expect(src).toMatch(/responseType:\s*'blob'/);
    expect(src).toMatch(/LONG_TIMEOUT_MS/);
    expect(src).not.toMatch(/timeout:\s*0/);
    expect(src).toMatch(/downloadBlob\(/);
    expect(src).toMatch(/this\.\$aw\.req\.get/);
    expect(src).not.toMatch(/JSON\.stringify\(response\.data/);
    expect(src).not.toMatch(/await fetch\(/);
    expect(src).not.toMatch(/androidExportFromUrl/);
  });
});
