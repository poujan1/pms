import { Decimal } from 'decimal.js';

export function toDecimal(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

export function round(value: Decimal | string | number, places = 2): Decimal {
  return new Decimal(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
}

export function calculateNetWeight(grossKg: number | string, tareKg: number | string): Decimal {
  const net = new Decimal(grossKg).minus(new Decimal(tareKg));
  if (net.isNegative()) {
    throw new Error('Net weight cannot be negative (tare is greater than gross).');
  }
  return round(net, 3);
}

export function calculatePurchaseAmount(
  netWeightKg: Decimal | number | string,
  rate: Decimal | number | string,
  rateUnit: 'KG' | 'QUINTAL'
): Decimal {
  const net = new Decimal(netWeightKg);
  const r = new Decimal(rate);
  if (rateUnit === 'QUINTAL') {
    // 1 quintal = 100 kg
    return round(net.dividedBy(100).times(r), 2);
  }
  return round(net.times(r), 2);
}
