const BASIC_ROLL_FORMULA = /^[0-9dD+\-*/().\s]+$/u;

export function normalizeRollModifier(value, fallback = "0") {
  const formula = String(value ?? "").trim();
  return formula || fallback;
}

export function isValidRollModifier(value) {
  const formula = normalizeRollModifier(value);
  if (!BASIC_ROLL_FORMULA.test(formula)) return false;

  try {
    return typeof Roll === "undefined" || typeof Roll.validate !== "function"
      ? true
      : Roll.validate(formula);
  } catch (_error) {
    return false;
  }
}

export function activeRollModifiers(...values) {
  return values
    .map(value => normalizeRollModifier(value))
    .filter(formula => formula !== "0");
}
