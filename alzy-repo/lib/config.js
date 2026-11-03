'use strict';
/**
 * ALZY — central configuration & the marketplace economy.
 * All money values are integers in cents (SZL 100 = E1.00).
 */
const path = require('path');

const config = {
  name: 'ALZY',
  tagline: "Eswatini's agriculture & food marketplace",
  country: 'Eswatini',
  currency: { code: 'SZL', symbol: 'E', locale: 'en-SZ' },
  port: process.env.PORT || 3000,
  sessionDays: 30,
  dbFile: process.env.ALZY_DB || path.join(__dirname, '..', 'data', 'alzy.db'),

  /** How ALZY makes money ------------------------------------------------ */
  revenue: {
    // Transaction commission, charged on the goods subtotal (not delivery).
    commissionRate: 0.06,          // default 6%
    commissionByTier: { free: 0.08, growth: 0.06, pro: 0.04 },
    // Supplier subscriptions (per month, in cents)
    subscriptions: {
      free:   { label: 'Starter', price: 0,    commission: 0.08, features: ['5 listings', 'Standard placement', 'Buyer messages'] },
      growth: { label: 'Growth',  price: 29900, commission: 0.06, features: ['Unlimited listings', 'Verified badge', 'Coupon campaigns', 'Priority support'] },
      pro:    { label: 'Pro',     price: 79900, commission: 0.04, features: ['Everything in Growth', 'Featured rotation', 'Brand Studio discount 20%', 'Analytics exports', 'Dedicated manager'] }
    },
    // Featured agricultural listings
    featured: { price: 15000, days: 7, label: 'Featured listing — 7 days' },
    // Logistics coordination
    logistics: {
      baseFee: 4500,               // E45 coordination fee
      perKm: 250,                  // E2.50 / km beyond 10km
      freeKm: 10,
      pickupFee: 0,
      wholesaleSurcharge: 0.01     // 1% on bulk logistics coordination
    },
    // Private-label / Brand Studio (service revenue)
    brandStudio: { setup: 250000, perUnit: 180, label: 'ALZY Brand Studio — own-brand packaging' }
  },

  deliveryRegions: [
    { name: 'Mbabane', km: 0 },
    { name: 'Lobamba / Ezulwini', km: 18 },
    { name: 'Manzini', km: 42 },
    { name: 'Malkerns', km: 36 },
    { name: 'Matsapha', km: 38 },
    { name: 'Nhlangano', km: 105 },
    { name: 'Siteki', km: 96 },
    { name: 'Big Bend', km: 128 },
    { name: 'Piggs Peak', km: 54 },
    { name: 'Hlatikulu', km: 118 }
  ],

  paymentMethods: [
    { id: 'momo', label: 'MTN MoMo', hint: 'Mobile Money — dial *104# to approve' },
    { id: 'eswatini-mobile', label: 'Eswatini Mobile Money', hint: 'Pay from your Eswatini Mobile wallet' },
    { id: 'card', label: 'Debit / Credit card', hint: 'Visa or Mastercard' },
    { id: 'cod', label: 'Cash on delivery', hint: 'Pay the driver when your order arrives' },
    { id: 'eft', label: 'Bank transfer (EFT)', hint: 'Pay within 24 hours' }
  ]
};

module.exports = config;
