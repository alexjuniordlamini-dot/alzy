'use strict';
/** Money helpers — everything is stored in cents (SZL × 100). */
const config = require('./config');

const fmt = (cents) => {
  const n = Number(cents || 0) / 100;
  return `${config.currency.symbol}${n.toLocaleString('en-SZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const short = (cents) => {
  const n = Number(cents || 0) / 100;
  if (n >= 1000000) return `${config.currency.symbol}${(n / 1000000).toFixed(1)}m`;
  if (n >= 10000) return `${config.currency.symbol}${(n / 1000).toFixed(0)}k`;
  return `${config.currency.symbol}${n.toLocaleString('en-SZ', { maximumFractionDigits: 0 })}`;
};

const toCents = (v) => Math.round(Number(v || 0) * 100);
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** Logistics coordination fee for a region + order size. */
function deliveryFee(regionName, subtotalCents) {
  const region = config.deliveryRegions.find(r => r.name === regionName);
  const km = region ? region.km : 50;
  const { baseFee, perKm, freeKm, wholesaleSurcharge } = config.revenue.logistics;
  const distancePart = Math.max(0, km - freeKm) * perKm;
  const bulkPart = subtotalCents > 500000 ? Math.round(subtotalCents * wholesaleSurcharge) : 0;
  return baseFee + distancePart + bulkPart;
}

/** Commission for a seller given their subscription tier. */
function commissionFor(plan, lineTotalCents) {
  const rate = config.revenue.commissionByTier[plan] ?? config.revenue.commissionRate;
  return Math.round(lineTotalCents * rate);
}

module.exports = { fmt, short, toCents, clamp, deliveryFee, commissionFor };
