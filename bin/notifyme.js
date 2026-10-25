#!/usr/bin/env node
'use strict';

// Notify Me! CLI - a thin, zero-dependency wrapper over the read-only Public API v1
// plus an `mcp-config` helper. Requires Node 18+ (global fetch).

const { RESOURCES, PAGINATION } = require('../lib/endpoints');
const mcp = require('../lib/mcp-config');
const pkg = require('../package.json');

const BASE = (process.env.NOTIFYME_API_BASE || 'https://api.notify-me.app').replace(/\/+$/, '');
// Always identify ourselves (some default library UAs were blocked by Cloudflare until Oct 2026).
const USER_AGENT = `notifyme-cli/${pkg.version} (+https://notify-me.io; node/${process.versions.node})`;
const MAX_RETRIES = 5;

const HELP = `notifyme ${pkg.version} - Notify Me! (Shopify back-in-stock & pre-order app) from the terminal

Usage:
  notifyme <resource> list [--filter value ...] [--limit N] [--offset N] [--ordering f] [--all]
  notifyme <resource> get <id>
  notifyme endpoints                  Show every endpoint and its allowed filters
  notifyme mcp-config [--client claude-code|cursor|codex|all] [--with-key]
  notifyme --help | --version

Resources (all GET, read-only):
${Object.entries(RESOURCES).map(([n, r]) => `  ${n.padEnd(27)} ${r.summary}`).join('\n')}

Auth:
  export NOTIFYME_API_KEY=...   API key from the Notify Me! admin panel (needs the Public API
                                entitlement; the MCP server additionally needs the "mcp" entitlement)

Options:
  --all             Follow "next" links and return every page (merged into one results array)
  --max-pages N     Safety cap for --all (default 50)
  --raw             Print compact JSON instead of pretty JSON
  Any --<filter> from "notifyme endpoints" is passed as a query param (dashes -> underscores).
  Multi-value filters are comma-separated, e.g. --status WAITING_RESTOCK,SCHEDULED

Examples:
  notifyme subscriptions list --status WAITING_RESTOCK --ordering -created_at --limit 50
  notifyme subscriptions list --sku TEE-BLK-M --all
  notifyme pre-orders list --created-at-gte 2026-10-01T00:00:00Z --financial-status PAID
  notifyme subscription-notifications list --bundle FIRST_ALERT --email-status delivered
  notifyme mcp-config --client cursor

The REST API is read-only. Changing settings or widgets is done through the MCP server
(https://mcp.notify-me.app/mcp); everything else lives in the Notify Me! admin panel.
Docs: https://api.notify-me.app/v1/docs/  OpenAPI: https://api.notify-me.app/v1/schema/
`;

// Throw instead of process.exit(): exiting while fetch sockets are still closing
// trips a libuv assertion on Windows. main() turns this into process.exitCode.
class CliExit extends Error {
  constructor(code) { super(`exit ${code}`); this.code = code; }
}

function fail(msg, code = 1) {
  if (msg) process.stderr.write(`notifyme: ${msg}\n`);
  throw new CliExit(code);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const name = (eq > -1 ? a.slice(2, eq) : a.slice(2));
      let value;
      if (eq > -1) value = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) value = argv[++i];
      else value = true;
      flags[name] = value;
    } else if (a === '-h') {
      flags.help = true;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry-After header first, then the "Expected available in N seconds" hint in the
// 429 body, then exponential backoff (1, 2, 4, 8, 16s) with jitter.
function backoffMs(res, bodyText, attempt) {
  const ra = Number(res.headers.get('retry-after'));
  if (Number.isFinite(ra) && ra > 0) return Math.min(ra, 120) * 1000;
  const m = /available in (\d+) seconds?/i.exec(bodyText || '');
  if (m) return Math.min(Number(m[1]), 120) * 1000;
  return 1000 * 2 ** attempt + Math.floor(Math.random() * 250);
}

async function request(url) {
  const key = process.env.NOTIFYME_API_KEY;
  if (!key) fail('NOTIFYME_API_KEY is not set. Create a key in the Notify Me! admin panel and export it.', 2);
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        headers: { 'X-Api-Key': key, 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
    } catch (e) {
      if (attempt < 2) { await sleep(1000 * (attempt + 1)); continue; }
      fail(`network error: ${e.cause ? e.cause.code || e.cause.message : e.message}`, 3);
    }
    const text = await res.text();
    const retryable = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
    if (retryable && attempt < MAX_RETRIES) {
      const wait = backoffMs(res, text, attempt);
      process.stderr.write(`notifyme: HTTP ${res.status}, retrying in ${Math.round(wait / 1000)}s (${attempt + 1}/${MAX_RETRIES})\n`);
      await sleep(wait);
      continue;
    }
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (res.ok) return body;
    const detail = body && typeof body === 'object' ? (body.detail || body.error || JSON.stringify(body)) : String(body).slice(0, 200);
    const hints = {
      401: 'The API key is missing or invalid.',
      403: 'The key was rejected: it is invalid, revoked, or the shop lacks the Public API entitlement.',
      404: 'No object with that id in this shop.',
      429: 'Rate limit (60 requests/minute) still exceeded after retries.',
    };
    process.stderr.write(JSON.stringify({ status: res.status, detail, hint: hints[res.status] || null }) + '\n');
    fail(null, res.status === 401 || res.status === 403 ? 4 : 5);
  }
}

function buildQuery(resource, flags) {
  const allowed = new Set([...resource.filters, ...PAGINATION]);
  const reserved = new Set(['all', 'max-pages', 'raw', 'help']);
  const qs = new URLSearchParams();
  for (const [rawName, value] of Object.entries(flags)) {
    if (reserved.has(rawName)) continue;
    const name = rawName.replace(/-/g, '_');
    if (!allowed.has(name)) {
      fail(`unknown filter --${rawName}. Allowed: ${[...allowed].join(', ')}`, 2);
    }
    if (value === true) fail(`--${rawName} needs a value`, 2);
    qs.set(name, String(value));
  }
  return qs;
}

async function list(name, resource, flags) {
  const qs = buildQuery(resource, flags);
  let url = `${BASE}${resource.path}${qs.toString() ? `?${qs}` : ''}`;
  const first = await request(url);
  if (!flags.all) return first;
  const maxPages = Number(flags['max-pages'] || 50);
  const results = [...(first.results || [])];
  let next = first.next;
  let pages = 1;
  while (next && pages < maxPages) {
    // Keep requests on the configured host even if the API returns an absolute URL.
    const u = new URL(next);
    url = `${BASE}${u.pathname}${u.search}`;
    const page = await request(url);
    results.push(...(page.results || []));
    next = page.next;
    pages++;
  }
  return { count: first.count, fetched: results.length, truncated: Boolean(next), results };
}

function print(data, flags) {
  process.stdout.write((flags.raw ? JSON.stringify(data) : JSON.stringify(data, null, 2)) + '\n');
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [cmd, sub, id] = positional;

  if (flags.version) return void process.stdout.write(`${pkg.version}\n`);
  if (!cmd || flags.help || cmd === 'help') return void process.stdout.write(HELP);

  if (cmd === 'endpoints') {
    const out = Object.entries(RESOURCES).map(([n, r]) => ({
      resource: n,
      list: `GET ${r.path}`,
      get: `GET ${r.path}{id}/`,
      summary: r.summary,
      filters: r.filters,
      ordering: r.ordering.flatMap((f) => [f, `-${f}`]),
      enums: r.enums,
    }));
    return print(out, flags);
  }

  if (cmd === 'mcp-config') {
    const client = flags.client && flags.client !== true ? flags.client : 'all';
    const withKey = Boolean(flags['with-key']);
    const key = process.env.NOTIFYME_API_KEY || '';
    if (withKey && !key) fail('--with-key needs NOTIFYME_API_KEY to be set', 2);
    const clients = client === 'all' ? mcp.CLIENTS : [client];
    let out;
    try { out = clients.map((c) => mcp.render(c, { withKey, key })).join('\n\n'); } catch (e) { fail(e.message, 2); }
    process.stdout.write(`${out}\n\n# The key needs the "mcp" entitlement. Server: ${mcp.MCP_URL} (Streamable HTTP, tools only).\n`);
    return;
  }

  const resource = RESOURCES[cmd];
  if (!resource) fail(`unknown command "${cmd}". Run "notifyme --help".`, 2);

  if (sub === 'list') return print(await list(cmd, resource, flags), flags);
  if (sub === 'get') {
    if (!id || !/^\d+$/.test(id)) fail(`usage: notifyme ${cmd} get <numeric id>`, 2);
    return print(await request(`${BASE}${resource.path}${id}/`), flags);
  }
  fail(`usage: notifyme ${cmd} list|get <id>  (the API is read-only; there is no create/update/delete)`, 2);
}

main().catch((e) => {
  if (e instanceof CliExit) { process.exitCode = e.code; return; }
  process.stderr.write(`notifyme: ${e.stack || e}\n`);
  process.exitCode = 1;
});
