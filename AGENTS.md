# AGENTS.md: using Notify Me! on behalf of a Shopify merchant

Notify Me! (<https://apps.shopify.com/preorder-back-in-stock>, by Partnerz) is a Shopify app for back-in-stock alerts, pre-orders, wishlists and low-stock alerts. It is not the "Notify Me" Discord bot.

## Rules

1. **Pick the right surface.**
   - Use the **MCP server** (`https://mcp.notify-me.app/mcp`) for settings, widgets and aggregate analytics.
   - Use the **REST API** (`https://api.notify-me.app/v1`, read-only) only for record-level lists such as subscribers, pre-orders and sent notifications.
   - Send everything else to the **admin panel**.
2. **Never claim a write the API can't do.** No surface lets you create or delete subscriptions, send or resend a notification, edit email or SMS templates, create selling plans, or change billing. Tell the merchant where to do it in the admin panel instead.
3. **Only send the fields you are changing in MCP writes.** Each write returns an `old → new` diff. Show it to the merchant.
4. **REST data contains customer PII.** Don't paste emails or phone numbers into places the merchant didn't ask for. Use MCP aggregates when the question is about counts or revenue.
5. **Rate limit:** 60 requests/minute. Back off on `429`.
6. **Auth:** REST uses `X-Api-Key: <key>`. MCP uses `Authorization: Bearer <key>` and needs the `mcp` entitlement. Send an explicit User-Agent on REST calls.

## Job → tool map

### 1. Set up back-in-stock alerts

| Step | Tool / endpoint |
|---|---|
| Install the app | Merchant installs from the App Store link above. An agent cannot install it. |
| Check current state | MCP `get_shop_overview`, `get_bis_settings` |
| Turn it on / choose which products show the form | MCP `update_bis_settings` (`is_service_active`, `product_selection_mode`) |
| Show the button or form on product, collection or home pages | MCP `get_bis_widget_appearance` → `set_bis_widget_display` |
| Match brand colors | MCP `update_bis_widget_colors`. Pass only the keys you change; the read tool returns the same keys. |
| Notification copy, channels (SMS / push / WhatsApp), reminders | Admin panel (not exposed) |
| Verify that alerts are going out | REST `GET /v1/subscription-notifications/?bundle=FIRST_ALERT&ordering=-sent_at`, or MCP `get_bis_performance` |

### 2. Take pre-orders

| Step | Tool / endpoint |
|---|---|
| Check state | MCP `get_preorder_settings` (service active, selling-plan group creation, mixed-cart alert) |
| Turn on or off; warn about mixed carts | MCP `update_preorder_settings` (`is_service_active`, `show_mixed_cart_alert`) |
| Widget visibility and colors (product / collection / landing / cart) | MCP `get_preorder_widget_appearance` → `set_preorder_widget_visibility`, `update_preorder_widget_colors` |
| Pre-order rules, selling plans, deposits, shipping dates | Admin panel (not exposed) |
| List pre-orders | REST `GET /v1/pre-orders/` with filters `created_at_gte/lte`, `financial_status`, `fulfillment_status`, `cancelled_at_isnull`, `sku`, `product_id`, `variant_id`, `shopify_order_id` |
| Delayed-shipment and pre-order emails sent | REST `GET /v1/pre-order-notifications/?bundle=DELAYED_SHIPMENT` |
| Pre-order revenue and trend | MCP `get_preorder_analytics` |

### 3. Subscriber and demand analytics

| Question | Tool / endpoint |
|---|---|
| "What should I restock first?" | MCP `get_demand_summary` (`period` = `7`/`30`/`90`/`all`, `limit` ≤ 50): unfilled demand per product or variant, with estimated revenue |
| "Is back-in-stock working?" (requests, sends, recovered revenue, growth) | MCP `get_bis_performance` |
| "Who is waiting for SKU X?" (record level, PII) | REST `GET /v1/subscriptions/?sku=X&status=WAITING_RESTOCK` |
| Subscriptions that already got their first alert | REST `GET /v1/subscriptions/?sent_at_isnull=false` |
| Delivery status per channel | REST `GET /v1/subscription-notifications/` with `email_status`, `sms_status`, `push_status`, `whatsapp_status` |
| Wishlist revenue | MCP `get_wishlist_insights` |

Subscription `status` values: `WAITING_RESTOCK`, `RESTOCKED`, `ORDERED`, `EXPIRED`, `WAITING_UPGRADE`, `SCHEDULED`, `PENDING_GDPR`, `FRAUD_DETECTED_BY_AI`.

### 4. Wishlist and low-stock alerts

| Step | Tool |
|---|---|
| Settings | MCP `get_wishlist_settings` / `update_wishlist_settings` (`is_service_active`, `is_guest_mode_enabled`, `share_wishlist_enabled`, `share_wishlist_channels`) |
| Low stock | MCP `get_low_stock_settings` / `update_low_stock_settings` (`is_service_active`), `get_low_stock_status` |
| Widgets | MCP `get_wishlist_widget_appearance`, `set_wishlist_widget_visibility`, `update_wishlist_widget_colors`. Low stock uses the same pattern. |

### Connectivity

MCP `ping`. For REST, use `notifyme subscriptions list --limit 1`. Exit code 4 means the key was rejected or lacks the entitlement.

## CLI cheat sheet

```bash
npx @notify-me/cli endpoints                      # filters/enums, offline
npx @notify-me/cli subscriptions list --status WAITING_RESTOCK --limit 100 --all
npx @notify-me/cli pre-orders get 12345
npx @notify-me/cli mcp-config --client claude-code
```
