import type { Settings } from "./types";

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const kgToLb = (kg: number) => kg / KG_PER_LB;

export function cmToFtIn(cm: number) {
  const totalIn = cm / CM_PER_IN;
  let ft = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - ft * 12);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  return { ft, inches };
}

export const ftInToCm = (ft: number, inches: number) => (ft * 12 + inches) * CM_PER_IN;

type Units = Settings["units"];

export function displayWeight(kg: number, units: Units, digits = 1) {
  const v = units.weight === "lb" ? kgToLb(kg) : kg;
  return Number(v.toFixed(digits));
}

export function formatWeight(kg: number | null | undefined, units: Units, digits = 1) {
  if (kg == null) return "—";
  return `${displayWeight(kg, units, digits)} ${units.weight}`;
}

export function inputWeightToKg(v: number, units: Units) {
  return units.weight === "lb" ? lbToKg(v) : v;
}

export function formatRate(kgPerWeek: number, units: Units) {
  const v = Math.abs(displayWeight(kgPerWeek, units, units.weight === "lb" ? 1 : 2));
  if (v < 0.05) return "Hold steady";
  const dir = kgPerWeek < 0 ? "Lose" : "Gain";
  return `${dir} ${v} ${units.weight}/week`;
}

export function formatHeight(cm: number, units: Units) {
  if (units.height === "metric") return `${Math.round(cm)} cm`;
  const { ft, inches } = cmToFtIn(cm);
  return `${ft}′${inches}″`;
}

/** Round a load to sensible plate increments in the user's unit, returned as kg. */
export function roundLoadKg(kg: number, units: Units) {
  if (units.weight === "lb") return lbToKg(Math.round(kgToLb(kg) / 5) * 5);
  return Math.round(kg / 2.5) * 2.5;
}
