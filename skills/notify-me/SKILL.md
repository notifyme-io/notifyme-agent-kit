---
name: notify-me
description: Operate the Notify Me! Shopify app (back-in-stock alerts, pre-orders, wishlist, low-stock alerts) for a merchant. Use when the user wants to set up or troubleshoot restock / back-in-stock / "notify me when available" alerts, take pre-orders, see which sold-out products have the most waiting customers, check alert or pre-order performance, change Notify Me! widget visibility or colors, or list subscribers and pre-orders. Not the "Notify Me" Discord bot.
---

# Notify Me! (Shopify back-in-stock & pre-order app)

App Store: https://apps.shopify.com/preorder-back-in-stock · Docs: https://api.notify-me.app/v1/docs/

## Choose the surface

- **MCP tools** (server `notify-me`, `https://mcp.notify-me.app/mcp`): settings, widgets and aggregate analytics. Prefer these, because they contain no customer PII.
- **REST API** (read-only, `X-Api-Key`): record-level subscribers, pre-orders and sent notifications. From a shell, use `npx @notify-me/cli` (run `npx @notify-me/cli endpoints` to see the filters).
- **Admin panel**: everything else. Tell the merchant to go there for notification templates, channels, selling plans and pre-order rules, imports and billing.

If MCP tools are missing, the key is not set or lacks the `mcp` entitlement. Run `npx @notify-me/cli mcp-config --client claude-code` and ask the merchant to set `NOTIFYME_API_KEY`.

## Job → tool

| Merchant job | Do this |
|---|---|
| Turn on back-in-stock | `get_bis_settings` → `update_bis_settings {is_service_active: true}`. Then use `get_bis_widget_appearance` → `set_bis_widget_display` for the pages they want. |
| Brand the BIS / pre-order / wishlist / low-stock widget | `get_<feature>_widget_appearance`, then `update_<feature>_widget_colors` with only the changed keys |
| Turn on pre-orders | `get_preorder_settings` → `update_preorder_settings {is_service_active: true}`. Optionally set `show_mixed_cart_alert`. Selling plans and pre-order rules are set up in the admin panel. |
| "What should I restock first?" | `get_demand_summary {period: "30", limit: 20}` |
| "Is it working / how much revenue?" | `get_bis_performance`, `get_preorder_analytics`, `get_wishlist_insights` |
| "Who is waiting for SKU X?" | REST `GET /v1/subscriptions/?sku=X&status=WAITING_RESTOCK` (contains PII, so only show what was asked) |
| "Were alerts delivered?" | REST `GET /v1/subscription-notifications/?ordering=-sent_at` and check `email_stat` / `sms_stat` / `push_stat` / `whatsapp_stat` |
| List pre-orders / unpaid / unfulfilled | REST `GET /v1/pre-orders/?financial_status=PENDING` or `?fulfillment_status=UNFULFILLED` |

## Never

- Never claim you created or deleted subscriptions, sent or resent alerts, or edited templates. No API supports these.
- Never pass a shop domain to a tool. The key determines the shop.
- Never make a write without first reading the current state. Show the merchant the `old → new` diff that the write returns.
