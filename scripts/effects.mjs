import {
  ABILITIES,
  ABILITY_LABELS,
  MODULE_ID,
  formIcon,
  localName,
  tr
} from "./constants.mjs";
import { recordDustOutcome } from "./stats.mjs";

function numeric(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function effectMode(mode = "add") {
  const modes = CONST.ACTIVE_EFFECT_MODES;
  return {
    add: modes.ADD,
    upgrade: modes.UPGRADE,
    override: modes.OVERRIDE,
    downgrade: modes.DOWNGRADE
  }[mode] ?? modes.ADD;
}

export function getTimeConfiguration() {
  try {
    const config = globalThis.SimpleCalendar?.api?.getTimeConfiguration?.();
    if (config) return config;
  } catch (error) {
    console.warn(`${MODULE_ID} | Simple Calendar time configuration was unavailable.`, error);
  }
  return {
    hoursInDay: 24,
    minutesInHour: 60,
    secondsInMinute: 60,
    secondsInCombatRound: 6
  };
}

function currentCalendarTimestamp() {
  try {
    return globalThis.SimpleCalendar?.api?.dateToTimestamp?.({});
  } catch (_error) {
    return null;
  }
}

export function secondsForDuration(value, unit) {
  const amount = Math.max(0, numeric(value));
  const time = getTimeConfiguration();
  const minute = numeric(time.secondsInMinute, 60);
  const hour = numeric(time.minutesInHour, 60) * minute;
  const day = numeric(time.hoursInDay, 24) * hour;
  if (unit === "minutes") return amount * minute;
  if (unit === "hours") return amount * hour;
  if (unit === "days") return amount * day;
  return 0;
}

export function buildDuration(value, unit) {
  const amount = Math.max(0, numeric(value));
  if (!amount || unit === "permanent" || unit === "rest") {
    return { duration: {}, expiresAtWorldTime: null, expiresAtCalendar: null };
  }
  if (unit === "turns") {
    return {
      duration: {
        turns: amount,
        startRound: game.combat?.round ?? 0,
        startTurn: game.combat?.turn ?? 0,
        combat: game.combat?.id ?? null
      },
      expiresAtWorldTime: null,
      expiresAtCalendar: null
    };
  }
  const seconds = secondsForDuration(amount, unit);
  const calendarNow = currentCalendarTimestamp();
  return {
    duration: { seconds, startTime: game.time.worldTime },
    expiresAtWorldTime: game.time.worldTime + seconds,
    expiresAtCalendar: Number.isFinite(calendarNow) ? calendarNow + seconds : null
  };
}

export function modifiersToChanges(modifiers, mode = "add") {
  const activeMode = effectMode(mode);
  return ABILITIES
    .map(ability => ({ ability, value: numeric(modifiers?.[ability], 0) }))
    .filter(({ value }) => value !== 0)
    .map(({ ability, value }) => ({
      key: `system.abilities.${ability}.value`,
      mode: activeMode,
      value: String(value),
      priority: 20
    }));
}

export async function createStatEffect(actor, {
  name,
  img,
  tint = null,
  changes = [],
  durationValue = 0,
  durationUnit = "permanent",
  description = "",
  kind = "custom",
  removeOnRest = null,
  extraFlags = {}
}) {
  if (!actor) throw new Error("Stat Shift actor is missing.");
  const timing = buildDuration(durationValue, durationUnit);
  const data = {
    name: name || tr("Stat Shift Effect", "Efekt Stat Shift"),
    img: img || "icons/magic/control/buff-strength-muscle-damage-orange.webp",
    type: "base",
    system: {},
    disabled: false,
    transfer: false,
    changes,
    duration: timing.duration,
    description,
    flags: {
      [MODULE_ID]: {
        kind,
        expiresAtWorldTime: timing.expiresAtWorldTime,
        expiresAtCalendar: timing.expiresAtCalendar,
        removeOnRest,
        ...extraFlags
      }
    }
  };
  if (tint) data.tint = tint;
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  return effect;
}

export async function evaluateFormula(formula, actor, { flavor, rollMode = "publicroll" } = {}) {
  const roll = await new Roll(formula || "0", actor?.getRollData?.() ?? {}).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: flavor || tr("Stat Shift roll", "Rzut Stat Shift")
  }, { rollMode });
  return roll;
}

export async function applyPreset(actor, data) {
  if (data.preset === "potion") {
    const score = Math.max(1, numeric(data.score, 21));
    const effect = await createStatEffect(actor, {
      name: data.effectName,
      img: data.icon || "icons/consumables/potions/bottle-corked-empty.webp",
      changes: [{
        key: "system.abilities.str.value",
        mode: CONST.ACTIVE_EFFECT_MODES.UPGRADE,
        value: String(score),
        priority: 20
      }],
      durationValue: data.durationValue,
      durationUnit: data.durationUnit,
      description: tr(
        `Strength becomes at least ${score}.`,
        `Siła wynosi co najmniej ${score}.`
      ),
      kind: "giantStrength"
    });
    await postEffectCard(actor, {
      title: data.effectName,
      image: effect.img,
      outcome: tr(`Strength upgraded to ${score}`, `Siła podniesiona do ${score}`),
      changes: [{ ability: "str", value: score, mode: "upgrade" }],
      durationValue: data.durationValue,
      durationUnit: data.durationUnit,
      rollMode: data.rollMode
    });
    return effect;
  }

  const roll = await evaluateFormula(data.formula || "1d4", actor, {
    flavor: data.effectName,
    rollMode: data.rollMode
  });
  const loss = Math.max(0, numeric(roll.total));
  const effect = await createStatEffect(actor, {
    name: data.effectName,
    img: data.icon || "icons/magic/unholy/hand-claw-fire-blue.webp",
    changes: [{
      key: "system.abilities.str.value",
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: String(-loss),
      priority: 20
    }],
    durationUnit: "rest",
    description: tr(
      `Strength score decreases by ${loss}. Removed after a short or long rest.`,
      `Siła zmniejsza się o ${loss}. Efekt znika po krótkim lub długim odpoczynku.`
    ),
    kind: "strengthDrain",
    removeOnRest: "shortOrLong"
  });
  await postEffectCard(actor, {
    title: data.effectName,
    image: effect.img,
    outcome: tr(`Strength −${loss}`, `Siła −${loss}`),
    changes: [{ ability: "str", value: -loss, mode: "add" }],
    durationValue: 0,
    durationUnit: "rest",
    rollMode: data.rollMode
  });
  return effect;
}

export async function applyHomebrew(actor, data) {
  const changes = modifiersToChanges(data.modifiers, data.mode);
  if (!changes.length) throw new Error(tr("At least one change is required.", "Wymagana jest co najmniej jedna zmiana."));
  const effect = await createStatEffect(actor, {
    name: data.effectName,
    img: data.icon,
    changes,
    durationValue: data.durationValue,
    durationUnit: data.durationUnit,
    description: data.description,
    kind: "homebrew"
  });
  await postEffectCard(actor, {
    title: data.effectName,
    image: effect.img,
    outcome: tr("Homebrew effect applied", "Nałożono efekt homebrew"),
    changes: changesFromEffect(changes),
    durationValue: data.durationValue,
    durationUnit: data.durationUnit,
    rollMode: data.rollMode
  });
  return effect;
}

export async function applySavingThrowOutcome(actor, request, outcome, rollData = {}) {
  const success = outcome === "success";
  const enabled = success ? request.applySuccess : request.applyFailure;
  const modifiers = success ? request.successModifiers : request.failureModifiers;
  const prefix = success ? "S" : "F";
  const name = `${prefix}. ${request.effectName || request.title}`;
  let effect = null;
  if (enabled) {
    const changes = modifiersToChanges(modifiers, request.mode || "add");
    if (changes.length) {
      effect = await createStatEffect(actor, {
        name,
        img: success ? request.successIcon : request.failureIcon,
        tint: success ? "#27ae60" : "#c0392b",
        changes,
        durationValue: request.durationValue,
        durationUnit: request.durationUnit,
        description: request.description,
        kind: "homebrewSave",
        extraFlags: { outcome, requestId: request.id }
      });
    }
  }
  await postEffectCard(actor, {
    title: request.title,
    image: effect?.img || (success ? request.successIcon : request.failureIcon),
    outcome: success ? tr("Saving throw succeeded", "Rzut obronny zdany") : tr("Saving throw failed", "Rzut obronny niezdany"),
    total: rollData.total,
    dc: request.dc,
    changes: enabled ? Object.entries(modifiers).map(([ability, value]) => ({ ability, value, mode: request.mode })) : [],
    durationValue: request.durationValue,
    durationUnit: request.durationUnit,
    rollMode: request.rollMode
  });
  return effect;
}

export async function applyDustOutcome(actor, request, outcome, rollData = {}) {
  const success = outcome === "success";
  const modifiers = success ? request.successModifiers : request.failureModifiers;
  const prefix = success ? "S" : "F";
  const effectName = `${prefix}. ${request.formName} ${request.variantName}`;
  const icon = success ? request.successIcon : request.failureIcon;
  const changes = modifiersToChanges(modifiers, "add");
  const effect = await createStatEffect(actor, {
    name: effectName,
    img: icon || formIcon(request.formId, outcome),
    tint: success ? "#27ae60" : "#c0392b",
    changes,
    durationValue: request.durationValue,
    durationUnit: request.durationUnit,
    description: tr(
      `${request.title}: ${success ? "successful" : "failed"} adaptation.`,
      `${request.title}: ${success ? "udana" : "nieudana"} adaptacja.`
    ),
    kind: "dust",
    extraFlags: {
      outcome,
      formId: request.formId,
      variantId: request.variantId,
      requestId: request.id
    }
  });

  await recordDustOutcome(actor, {
    outcome,
    title: request.title,
    formId: request.formId,
    formName: request.formName,
    variantId: request.variantId,
    variantName: request.variantName,
    modifiers,
    total: rollData.total ?? null,
    dc: request.dc,
    effectId: effect.id,
    manual: Boolean(rollData.manual)
  });

  await postEffectCard(actor, {
    title: request.title,
    image: effect.img,
    outcome: `${success ? tr("Success", "Sukces") : tr("Failure", "Porażka")} — ${request.formName}, ${request.variantName}`,
    total: rollData.total,
    dc: request.dc,
    changes: Object.entries(modifiers).map(([ability, value]) => ({ ability, value, mode: "add" })),
    durationValue: request.durationValue,
    durationUnit: request.durationUnit,
    rollMode: request.rollMode
  });
  return effect;
}

function changesFromEffect(changes) {
  return changes.map(change => ({
    ability: change.key.split(".")[2],
    value: numeric(change.value),
    mode: Object.entries(CONST.ACTIVE_EFFECT_MODES).find(([, value]) => value === change.mode)?.[0]?.toLowerCase() ?? "add"
  }));
}

function modifierLabel(change) {
  const ability = localName(ABILITY_LABELS[change.ability]) || change.ability?.toUpperCase();
  const value = numeric(change.value);
  if (change.mode === "upgrade") return `${ability} ≥ ${value}`;
  if (change.mode === "override") return `${ability} = ${value}`;
  return `${ability} ${value >= 0 ? "+" : ""}${value}`;
}

function durationLabel(value, unit) {
  if (unit === "rest") return tr("until a short or long rest", "do krótkiego lub długiego odpoczynku");
  if (unit === "permanent" || !numeric(value)) return tr("permanent", "stały");
  const labels = {
    turns: tr("turns", "tur"),
    minutes: tr("minutes", "minut"),
    hours: tr("hours", "godzin"),
    days: tr("days", "dni")
  };
  return `${value} ${labels[unit] ?? unit}`;
}

export async function postEffectCard(actor, {
  title,
  image,
  outcome,
  total,
  dc,
  changes = [],
  durationValue,
  durationUnit,
  rollMode = "publicroll"
}) {
  const visibleChanges = changes.filter(change => numeric(change.value) !== 0);
  const rollLine = Number.isFinite(Number(total))
    ? `<div class="stat-shift-card__roll">${tr("Result", "Wynik")}: <strong>${escapeHtml(total)}</strong> / DC ${escapeHtml(dc)}</div>`
    : "";
  const changesLine = visibleChanges.length
    ? `<div class="stat-shift-card__changes">${visibleChanges.map(change => `<span>${escapeHtml(modifierLabel(change))}</span>`).join("")}</div>`
    : `<div class="stat-shift-card__changes"><span>${tr("No ability changes", "Brak zmian cech")}</span></div>`;
  const content = `
    <section class="stat-shift-card">
      <header>
        <img src="${escapeHtml(image || "icons/svg/aura.svg")}" alt="">
        <div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(actor.name)}</p></div>
      </header>
      <div class="stat-shift-card__outcome">${escapeHtml(outcome)}</div>
      ${rollLine}
      ${changesLine}
      <footer>${tr("Duration", "Czas trwania")}: ${escapeHtml(durationLabel(durationValue, durationUnit))}</footer>
    </section>`;
  const chatData = {
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: { [MODULE_ID]: { effectCard: true } }
  };
  ChatMessage.applyRollMode(chatData, rollMode);
  return ChatMessage.create(chatData);
}

export async function checkExpiredEffects() {
  if (!game.user.isGM || !isPrimaryActiveGM()) return;
  const calendarNow = currentCalendarTimestamp();
  for (const actor of game.actors) {
    const expired = actor.effects.filter(effect => {
      const flags = effect.flags?.[MODULE_ID];
      if (!flags) return false;
      if (Number.isFinite(flags.expiresAtCalendar) && Number.isFinite(calendarNow) && calendarNow >= flags.expiresAtCalendar) return true;
      if (Number.isFinite(flags.expiresAtWorldTime) && game.time.worldTime >= flags.expiresAtWorldTime) return true;
      if (Number.isFinite(Number(effect.duration?.turns)) && Number(effect.duration?.remaining) <= 0) return true;
      return false;
    });
    if (expired.length) await actor.deleteEmbeddedDocuments("ActiveEffect", expired.map(effect => effect.id));
  }
}

export async function removeRestEffects(actor, result) {
  const restType = result?.type ?? (result?.longRest ? "long" : "short");
  const effects = actor.effects.filter(effect => {
    const rule = effect.getFlag(MODULE_ID, "removeOnRest");
    return rule === "shortOrLong" || (rule === "long" && restType === "long");
  });
  if (effects.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(effect => effect.id));
}

function isPrimaryActiveGM() {
  const first = game.users
    .filter(user => user.active && user.isGM)
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  return first?.id === game.user.id;
}

export function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}
