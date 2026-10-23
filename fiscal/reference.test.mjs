import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
test('official reference schemas are archived intact and never auto-approved', () => {
  const registry = JSON.parse(
    readFileSync(new URL('./dgii-reference-registry.json', import.meta.url), 'utf8'),
  );
  assert.equal(registry.records.length, 15);
  assert.equal(registry.activation, 'reference_only_not_approved_for_emission');
  for (const r of registry.records) {
    const xml = gunzipSync(Buffer.from(r.gzipBase64, 'base64'));
    assert.equal(xml.length, r.bytes);
    assert.equal(createHash('sha256').update(xml).digest('hex'), r.sha256);
    assert.match(xml.toString(), /<(?:xs|xsd):schema/);
    assert.equal(new URL(r.url).hostname, 'dgii.gov.do');
    assert.equal(r.reviewStatus, 'reference_only');
  }
});
