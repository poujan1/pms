"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDecimal = toDecimal;
exports.round = round;
exports.calculateNetWeight = calculateNetWeight;
exports.calculatePurchaseAmount = calculatePurchaseAmount;
const decimal_js_1 = require("decimal.js");
function toDecimal(value) {
    return new decimal_js_1.Decimal(value);
}
function round(value, places = 2) {
    return new decimal_js_1.Decimal(value).toDecimalPlaces(places, decimal_js_1.Decimal.ROUND_HALF_UP);
}
function calculateNetWeight(grossKg, tareKg) {
    const net = new decimal_js_1.Decimal(grossKg).minus(new decimal_js_1.Decimal(tareKg));
    if (net.isNegative()) {
        throw new Error('Net weight cannot be negative (tare is greater than gross).');
    }
    return round(net, 3);
}
function calculatePurchaseAmount(netWeightKg, rate, rateUnit) {
    const net = new decimal_js_1.Decimal(netWeightKg);
    const r = new decimal_js_1.Decimal(rate);
    if (rateUnit === 'QUINTAL') {
        // 1 quintal = 100 kg
        return round(net.dividedBy(100).times(r), 2);
    }
    return round(net.times(r), 2);
}
