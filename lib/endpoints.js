'use strict';

// The 8 read-only endpoints of the Notify Me! Public API v1.
// Source of truth: https://api.notify-me.app/v1/schema/ (snapshot in openapi/).
// `npm run check-spec` diffs this table against the live schema.
// There are NO write endpoints in the Public API. Do not add any here.

const PAGINATION = ['limit', 'offset', 'ordering'];

const RESOURCES = {
  subscriptions: {
    path: '/v1/subscriptions/',
    summary: 'Back-in-stock subscriptions (one row per shopper signup for a variant).',
    listOperationId: 'subscriptions_list',
    getOperationId: 'subscriptions_retrieve',
    filters: [
      'created_at_gte', 'created_at_lte', 'email', 'is_imported', 'phone_number',
      'product_id', 'sent_at_gte', 'sent_at_isnull', 'sent_at_lte', 'sku', 'status',
      'subscribe_at_gte', 'subscribe_at_lte', 'variant_id', 'whatsapp_number',
    ],
    ordering: ['id', 'created_at', 'sent_at', 'subscribe_at'],
    enums: {
      status: ['WAITING_RESTOCK', 'RESTOCKED', 'ORDERED', 'EXPIRED', 'WAITING_UPGRADE',
        'PENDING_GDPR', 'SCHEDULED', 'FRAUD_DETECTED_BY_AI'],
    },
  },
  'subscription-notifications': {
    path: '/v1/subscription-notifications/',
    summary: 'Back-in-stock notifications sent (email / SMS / push / WhatsApp) with delivery status.',
    listOperationId: 'subscription_notifications_list',
    getOperationId: 'subscription_notifications_retrieve',
    filters: [
      'bundle', 'email', 'email_status', 'phone_number', 'product_id', 'push_status',
      'sent_at_gte', 'sent_at_lte', 'sku', 'sms_status', 'subscription_id', 'variant_id',
      'whatsapp_number', 'whatsapp_status',
    ],
    ordering: ['id', 'sent_at'],
    enums: { bundle: ['FIRST_ALERT', 'AFTER_SUBSCRIPTION', 'REMINDER', 'GDPR'] },
  },
  'pre-orders': {
    path: '/v1/pre-orders/',
    summary: 'Pre-orders placed through Notify Me! selling plans.',
    listOperationId: 'pre_orders_list',
    getOperationId: 'pre_orders_retrieve',
    filters: [
      'cancelled_at_isnull', 'created_at_gte', 'created_at_lte', 'email', 'financial_status',
      'fulfillment_status', 'product_id', 'selling_plan_settings_name', 'shopify_order_id',
      'sku', 'variant_id',
    ],
    ordering: ['id', 'created_at', 'total_price'],
    enums: {
      financial_status: ['AUTHORIZED', 'PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED',
        'PENDING', 'REFUNDED', 'VOIDED'],
      fulfillment_status: ['FULFILLED', 'IN_PROGRESS', 'ON_HOLD', 'OPEN', 'RESTOCKED',
        'PARTIALLY_FULFILLED', 'PENDING_FULFILLMENT', 'SCHEDULED', 'UNFULFILLED'],
    },
  },
  'pre-order-notifications': {
    path: '/v1/pre-order-notifications/',
    summary: 'Pre-order and delayed-shipment notifications sent to customers.',
    listOperationId: 'pre_order_notifications_list',
    getOperationId: 'pre_order_notifications_retrieve',
    filters: [
      'bundle', 'email', 'email_status', 'phone_number', 'pre_order_id',
      'sent_at_gte', 'sent_at_lte', 'sms_status',
    ],
    ordering: ['id', 'sent_at'],
    enums: { bundle: ['PRE_ORDER', 'DELAYED_SHIPMENT'] },
  },
};

module.exports = { RESOURCES, PAGINATION };
