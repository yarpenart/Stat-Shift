import { FORMS, MODULE_ID, VARIANTS } from "./constants.mjs";

export function emptyDustStats() {
  return {
    successes: 0,
    failures: 0,
    forms: Object.fromEntries(Object.keys(FORMS).map(id => [id, 0])),
    variants: Object.fromEntries(Object.keys(VARIANTS).map(id => [id, 0])),
    history: []
  };
}

export function normalizeDustStats(value = {}) {
  const base = emptyDustStats();
  base.successes = Math.max(0, Number(value.successes) || 0);
  base.failures = Math.max(0, Number(value.failures) || 0);
  for (const key of Object.keys(base.forms)) base.forms[key] = Math.max(0, Number(value.forms?.[key]) || 0);
  for (const key of Object.keys(base.variants)) base.variants[key] = Math.max(0, Number(value.variants?.[key]) || 0);
  base.history = Array.isArray(value.history) ? value.history : [];
  return base;
}

export function getDustStats(actor) {
  return normalizeDustStats(actor?.getFlag(MODULE_ID, "dustStats"));
}

export async function setDustStats(actor, stats) {
  if (!actor) return;
  await actor.setFlag(MODULE_ID, "dustStats", normalizeDustStats(stats));
}

export async function recordDustOutcome(actor, data) {
  const stats = getDustStats(actor);
  if (data.outcome === "success") stats.successes += 1;
  else stats.failures += 1;
  if (data.formId in stats.forms) stats.forms[data.formId] += 1;
  if (data.variantId in stats.variants) stats.variants[data.variantId] += 1;
  stats.history.push({
    id: foundry.utils.randomID(),
    at: Date.now(),
    worldTime: game.time.worldTime,
    calendarDate: calendarDateLabel(),
    ...data
  });
  if (stats.history.length > 1000) stats.history.splice(0, stats.history.length - 1000);
  await setDustStats(actor, stats);
  return stats;
}

export async function transferDustStats(source, target, { clearSource = true } = {}) {
  const sourceStats = getDustStats(source);
  const targetStats = getDustStats(target);
  targetStats.successes += sourceStats.successes;
  targetStats.failures += sourceStats.failures;
  for (const key of Object.keys(targetStats.forms)) targetStats.forms[key] += sourceStats.forms[key] ?? 0;
  for (const key of Object.keys(targetStats.variants)) targetStats.variants[key] += sourceStats.variants[key] ?? 0;
  targetStats.history = [...targetStats.history, ...sourceStats.history]
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
    .slice(-1000);
  await setDustStats(target, targetStats);
  if (clearSource) await setDustStats(source, emptyDustStats());
}

function calendarDateLabel() {
  try {
    const display = globalThis.SimpleCalendar?.api?.currentDateTimeDisplay?.();
    return display ? `${display.date} ${display.time}`.trim() : null;
  } catch (_error) {
    return null;
  }
}
