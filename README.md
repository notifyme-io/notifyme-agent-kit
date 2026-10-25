# Notify Me! agent kit

**Notify Me!** is a Shopify app for **back-in-stock alerts, pre-orders, wishlists and low-stock alerts**.
Shoppers sign up for a sold-out variant. The app notifies them by email, SMS, web push or WhatsApp when the variant is restocked. Merchants can also take pre-orders through Shopify selling plans.

This repo is the official toolkit for using Notify Me! from AI agents (Claude, Cursor, Codex and other MCP clients) and from scripts:

- a **remote MCP server** config for agents: read settings and analytics, change settings and widgets
- a **zero-dependency CLI** (`notifyme`) over the read-only REST API
- a **Claude Code plugin + skill** and an **[AGENTS.md](AGENTS.md)**: which tool to use for which merchant job

> **Disambiguation:** this is the Shopify app by Partnerz, listed at
> <https://apps.shopify.com/preorder-back-in-stock>. It is **not** the "Notify Me" Discord bot. It is also not any other
> package or browser extension that happens to be called "notify-me".

## Canonical links

| What | URL |
|---|---|
| Install the app (Shopify App Store) | <https://apps.shopify.com/preorder-back-in-stock> |
| Website | <https://notify-me.io> |
| Help Center | <https://help.notify-me.io> |
| REST API base | `https://api.notify-me.app/v1` |
| API docs | <https://api.notify-me.app/v1/docs/> |
| OpenAPI 3.0 schema | <https://api.notify-me.app/v1/schema/> (snapshot: [`openapi/`](openapi/notify-me-v1.openapi.json)) |
| MCP server | `https://mcp.notify-me.app/mcp` (Streamable HTTP) |
| Official MCP registry | [`io.notify-me/preorder-back-in-stock-wishlist`](https://registry.modelcontextprotocol.io/v0.1/servers/io.notify-me%2Fpreorder-back-in-stock-wishlist/versions/latest) |
| Support | support@notify-me.io |

## What agents can and cannot do

Here are the limits up front, so an agent never promises a merchant something the API can't do:

| Surface | Reads | Writes |
|---|---|---|
| **REST API** (`X-Api-Key`) | Back-in-stock subscriptions, sent BIS notifications, pre-orders, sent pre-order notifications. Record-level data, including customer email and phone. | **None.** The REST API is read-only. You cannot create, edit or delete subscriptions, and you cannot trigger notifications. |
| **MCP server** (`Authorization: Bearer`, needs the `mcp` entitlement) | Aggregate, PII-safe: shop overview, settings for each feature, BIS demand and performance, pre-order analytics, wishlist insights, low-stock status, widget appearance | **Settings and widgets only:** turn BIS, Pre-Order, Wishlist and Low Stock on or off, plus a few fields per feature. Show or hide widgets and change widget colors. |
| **Admin panel** (inside Shopify admin) | Everything | Everything else: notification templates, channels, selling plans and pre-order rules, imports, billing |

## Quick start: MCP (recommended for agents)

1. In the Notify Me! admin panel, create an API key. The shop needs the **`mcp` entitlement**, which is separate from Public API access.
2. Put it in your environment as `NOTIFYME_API_KEY`.
3. Print the client config and paste it:

```bash
npx @notify-me/cli mcp-config            # all clients
npx @notify-me/cli mcp-config --client cursor
```

Claude Code one-liner:

```bash
claude mcp add --transport http --scope user notify-me https://mcp.notify-me.app/mcp --header "Authorization: Bearer $NOTIFYME_API_KEY"
```

The API key determines the shop. The shop is never a tool argument, so a key can only act on its own shop.
The server offers tools only, with no resources or prompts. The tools are listed in [`mcp/tools.json`](mcp/tools.json) and [AGENTS.md](AGENTS.md).

## Quick start: CLI (read-only REST)

Requires Node 18 or newer. No dependencies.

```bash
export NOTIFYME_API_KEY=...            # key with Public API access
npx @notify-me/cli --help
npx @notify-me/cli endpoints           # every endpoint, filter, ordering and enum value
npx @notify-me/cli subscriptions list --status WAITING_RESTOCK --ordering -created_at --limit 100
npx @notify-me/cli pre-orders list --created-at-gte 2026-10-01T00:00:00Z --financial-status PAID --all
```

| Command | Endpoint |
|---|---|
| `subscriptions list` / `get <id>` | `GET /v1/subscriptions/`, `GET /v1/subscriptions/{id}/` |
| `subscription-notifications list` / `get <id>` | `GET /v1/subscription-notifications/`, `.../{id}/` |
| `pre-orders list` / `get <id>` | `GET /v1/pre-orders/`, `.../{id}/` |
| `pre-order-notifications list` / `get <id>` | `GET /v1/pre-order-notifications/`, `.../{id}/` |
| `endpoints` | prints the filter table (offline) |
| `mcp-config [--client claude-code\|cursor\|codex\|all] [--with-key]` | prints MCP client config |

Behaviour:

- Sends an explicit `User-Agent` (`notifyme-cli/<version>`) so requests are identifiable.
- Handles the **60 requests/minute** limit. On a `429` it uses `Retry-After`, then the hint in the response body, then exponential backoff (up to 5 retries).
- `--all` follows `next` links. Pages hold at most 100 rows, and `--max-pages` caps the total (default 50).
- Unknown filters are rejected locally, so typos never silently return unfiltered data.
- Exit codes: `0` ok, `2` usage error, `3` network, `4` auth (401/403), `5` other HTTP error. Errors go to stderr as JSON.

If you call the REST API directly:

```bash
curl -H "X-Api-Key: $NOTIFYME_API_KEY" -H "User-Agent: my-app/1.0" \
  "https://api.notify-me.app/v1/subscriptions/?status=WAITING_RESTOCK&limit=25"
```

## Claude Code plugin

This repo is also a Claude Code plugin marketplace with one plugin, `notify-me`. The plugin bundles the MCP server config and a skill that maps merchant jobs to tools:

```text
/plugin marketplace add notifyme-io/notifyme-agent-kit
/plugin install notify-me@notify-me
```

## Data and privacy

- REST responses contain customer PII (email, phone, WhatsApp number). Redacted records are flagged `is_redacted: true`.
- MCP reads are aggregate and contain no customer PII. For analytics questions, prefer MCP. Use REST only when you need record-level data.

## Maintainers

- `npm run check-spec` compares the CLI's endpoint table with the live OpenAPI schema. It fails if a path, filter or non-GET method appears.
