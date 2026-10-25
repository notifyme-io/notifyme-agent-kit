#!/usr/bin/env node
'use strict';

// Drift check: fetch the live OpenAPI schema and compare it with lib/endpoints.js.
// Fails (exit 1) if the API gained/lost a path, a method other than GET appeared,
// or a filter parameter changed. Run before every release.

const { RESOURCES, PAGINATION } = require('../lib/endpoints');
const pkg = require('../package.json');

const URL_ = process.env.NOTIFYME_SCHEMA_URL || 'https://api.notify-me.app/v1/schema/?format=json';

(async () => {
  const res = await fetch(URL_, { headers: { 'User-Agent': `notifyme-cli/${pkg.version} check-spec`, Accept: 'application/json' } });
  if (!res.ok) { console.error(`schema fetch failed: HTTP ${res.status}`); process.exit(2); }
  const spec = JSON.parse(await res.text());
  const problems = [];
  const known = new Map(Object.values(RESOURCES).map((r) => [r.path, r]));

  for (const [path, ops] of Object.entries(spec.paths)) {
    for (const method of Object.keys(ops)) {
      if (method === 'parameters') continue;
      if (method !== 'get') problems.push(`NEW non-GET operation: ${method.toUpperCase()} ${path}`);
    }
    const base = path.replace(/\{id\}\/$/, '');
    const r = known.get(base);
    if (!r) { problems.push(`NEW path not in CLI: ${path}`); continue; }
    if (path === base && ops.get) {
      const live = new Set(ops.get.parameters.map((p) => p.name).filter((n) => !PAGINATION.includes(n)));
      const ours = new Set(r.filters);
      for (const n of live) if (!ours.has(n)) problems.push(`${path}: live filter missing in CLI: ${n}`);
      for (const n of ours) if (!live.has(n)) problems.push(`${path}: CLI filter no longer in API: ${n}`);
    }
  }
  for (const r of Object.values(RESOURCES)) {
    if (!spec.paths[r.path]) problems.push(`REMOVED from API: ${r.path}`);
    if (!spec.paths[`${r.path}{id}/`]) problems.push(`REMOVED from API: ${r.path}{id}/`);
  }

  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`OK: ${Object.keys(spec.paths).length} paths, all GET, filters match (${spec.info.title} ${spec.info.version}).`);
})().catch((e) => { console.error(e); process.exit(2); });
