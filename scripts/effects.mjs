import {
  ABILITIES,
  ABILITY_LABELS,
  AQUA_VITAE_ADDICTION_NAME,
  MODULE_ID,
  formIcon,
  localName,
  tr
} from "./constants.mjs";
import { recordDustOutcome } from "./stats.mjs";
import {
  buildExtendedDescription,
  extraEffectDisplayEntries,
  extraEffectsToChanges,
  normalizeExtraEffects
} from "./extended-effects.mjs";

const AQUA_SUSPENSION_FLAG = "aquaVitaeSuspension";
const AQUA_SYNC_OPTION = "statShiftAquaSync";
const MANAGED_CREATE_OPTION = "statShiftManagedCreate";

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
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data], {
    [MANAGED_CREATE_OPTION]: true
  });
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
  const extraEffects = normalizeExtraEffects(success ? request.successExtraEffects : request.failureExtraEffects);
  const outcomeDescription = String(
    (success ? request.successDescription : request.failureDescription) || request.description || ""
  );
  const prefix = success ? "S" : "F";
  const name = `${prefix}. ${request.effectName || request.title}`;
  let effect = null;
  if (enabled) {
    const changes = [
      ...modifiersToChanges(modifiers, request.mode || "add"),
      ...extraEffectsToChanges(extraEffects, actor)
    ];
    if (changes.length || extraEffects.length || outcomeDescription.trim()) {
      effect = await createStatEffect(actor, {
        name,
        img: success ? request.successIcon : request.failureIcon,
        tint: success ? "#27ae60" : "#c0392b",
        changes,
        durationValue: request.durationValue,
        durationUnit: request.durationUnit,
        description: buildExtendedDescription(outcomeDescription, extraEffects, escapeHtml),
        kind: "homebrewSave",
        extraFlags: { outcome, requestId: request.id, extendedEffects: extraEffects }
      });
    }
  }
  const abilityChanges = Object.entries(modifiers ?? {}).map(([ability, value]) => ({
    ability,
    value,
    mode: request.mode
  }));
  await postEffectCard(actor, {
    title: request.title,
    image: effect?.img || (success ? request.successIcon : request.failureIcon),
    outcome: success ? tr("Saving throw succeeded", "Rzut obronny zdany") : tr("Saving throw failed", "Rzut obronny niezdany"),
    total: rollData.total,
    dc: request.dc,
    changes: enabled ? [...abilityChanges, ...extraEffectDisplayEntries(extraEffects, actor)] : [],
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

  try {
    await suspendAquaVitaeAddiction(actor, effect.id);
  } catch (error) {
    console.error(`${MODULE_ID} | Could not suspend ${AQUA_VITAE_ADDICTION_NAME}.`, error);
    await effect.delete({ [AQUA_SYNC_OPTION]: true });
    await reconcileAquaVitaeSuspension(actor);
    throw new Error(tr(
      `Dust of Potential could not deactivate ${AQUA_VITAE_ADDICTION_NAME}. No Dust effect was applied.`,
      `Dust of Potential nie mógł wyłączyć efektu ${AQUA_VITAE_ADDICTION_NAME}. Efekt Dust nie został nałożony.`
    ));
  }

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

function normalizedEffectName(effect) {
  return String(effect?.name ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function isAquaVitaeAddiction(effect) {
  return normalizedEffectName(effect) === AQUA_VITAE_ADDICTION_NAME.toLocaleLowerCase();
}

function isDustEffect(effect) {
  return effect?.flags?.[MODULE_ID]?.kind === "dust";
}

function collectionContents(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) return collection.contents;
  if (typeof collection.values === "function") return Array.from(collection.values());
  if (typeof collection[Symbol.iterator] === "function") return Array.from(collection);
  return [];
}

function effectReference(effect) {
  return effect?.uuid
    ?? (effect?.parent?.uuid && effect?.id ? `${effect.parent.uuid}.ActiveEffect.${effect.id}` : null)
    ?? effect?.id
    ?? null;
}

function actorEffects(actor) {
  const effects = new Map();
  const add = effect => {
    if (!effect) return;
    const reference = effectReference(effect);
    if (reference) effects.set(reference, effect);
  };

  for (const effect of collectionContents(actor?.effects)) add(effect);
  for (const effect of collectionContents(actor?.appliedEffects)) add(effect);
  for (const item of collectionContents(actor?.items)) {
    for (const effect of collectionContents(item?.effects)) add(effect);
  }
  return [...effects.values()];
}

function aquaVitaeAddictions(actor) {
  return actorEffects(actor).filter(isAquaVitaeAddiction);
}

function activeDustEffectIds(actor, excludedIds = []) {
  const excluded = new Set(excludedIds);
  return collectionContents(actor?.effects)
    .filter(effect => isDustEffect(effect) && !effect.disabled && !excluded.has(effect.id))
    .map(effect => effect.id);
}

function readAquaSuspension(actor) {
  const saved = actor.getFlag(MODULE_ID, AQUA_SUSPENSION_FLAG);
  const effectStates = [];
  if (Array.isArray(saved?.effectStates)) {
    for (const state of saved.effectStates) {
      const reference = typeof state?.reference === "string" ? state.reference : null;
      const id = typeof state?.id === "string" ? state.id : null;
      if (!reference && !id) continue;
      effectStates.push({
        reference,
        id,
        wasDisabled: Boolean(state?.wasDisabled)
      });
    }
  } else {
    // v0.1.1 stored actor-owned effects in an object keyed by effect ID.
    for (const [id, state] of Object.entries(saved?.effectStates ?? {})) {
      if (!id) continue;
      effectStates.push({
        reference: null,
        id,
        wasDisabled: Boolean(state?.wasDisabled)
      });
    }
  }
  return {
    dustEffectIds: Array.isArray(saved?.dustEffectIds)
      ? [...new Set(saved.dustEffectIds.filter(id => typeof id === "string" && id))]
      : [],
    effectStates
  };
}

async function saveAquaSuspension(actor, state) {
  await actor.setFlag(MODULE_ID, AQUA_SUSPENSION_FLAG, state);
}

async function clearAquaSuspension(actor) {
  if (actor.getFlag(MODULE_ID, AQUA_SUSPENSION_FLAG) !== undefined) {
    await actor.unsetFlag(MODULE_ID, AQUA_SUSPENSION_FLAG);
  }
}

async function updateEffectDisabledState(effects, disabled) {
  for (const effect of effects) {
    if (Boolean(effect.disabled) === disabled) continue;
    await effect.update({ disabled }, { [AQUA_SYNC_OPTION]: true });
  }
}

export async function suspendAquaVitaeAddiction(actor, dustEffectId = null) {
  if (!actor) return;
  const state = readAquaSuspension(actor);
  state.dustEffectIds = activeDustEffectIds(actor);
  if (dustEffectId && !state.dustEffectIds.includes(dustEffectId)) {
    const dust = actor.effects.get(dustEffectId);
    if (isDustEffect(dust) && !dust.disabled) state.dustEffectIds.push(dustEffectId);
  }
  if (!state.dustEffectIds.length) return;

  const addictions = aquaVitaeAddictions(actor);
  for (const effect of addictions) {
    const reference = effectReference(effect);
    const saved = state.effectStates.find(entry =>
      (reference && entry.reference === reference)
      || (!entry.reference && entry.id === effect.id)
    );
    if (!saved) {
      state.effectStates.push({
        reference,
        id: effect.id ?? null,
        wasDisabled: Boolean(effect.disabled)
      });
    } else if (!saved.reference && reference) {
      saved.reference = reference;
    }
  }

  await saveAquaSuspension(actor, state);
  await updateEffectDisabledState(addictions, true);
}

export async function restoreAquaVitaeAddiction(actor, excludedDustIds = []) {
  if (!actor) return;
  const state = readAquaSuspension(actor);
  const remainingDustIds = activeDustEffectIds(actor, excludedDustIds);
  if (remainingDustIds.length) {
    state.dustEffectIds = remainingDustIds;
    await saveAquaSuspension(actor, state);
    return;
  }

  const availableEffects = actorEffects(actor);
  const effectsByReference = new Map(
    availableEffects.map(effect => [effectReference(effect), effect])
  );
  const effectsById = new Map(
    availableEffects.map(effect => [effect.id, effect])
  );
  const updates = [];
  for (const saved of state.effectStates) {
    const effect = (saved.reference && effectsByReference.get(saved.reference))
      || (saved.id && effectsById.get(saved.id));
    if (effect && !saved.wasDisabled && effect.disabled) {
      updates.push(effect);
    }
  }
  await updateEffectDisabledState(updates, false);
  await clearAquaSuspension(actor);
}

export async function reconcileAquaVitaeSuspension(actor) {
  if (!actor) return;
  if (activeDustEffectIds(actor).length) {
    await suspendAquaVitaeAddiction(actor);
  } else {
    await restoreAquaVitaeAddiction(actor);
  }
}

export async function reconcileAllAquaVitaeSuspensions() {
  if (!game.user.isGM || !isPrimaryActiveGM()) return;
  for (const actor of managedActors()) {
    await reconcileAquaVitaeSuspension(actor);
  }
}

export function handleActiveEffectCreated(effect, options, userId) {
  const actor = effectActor(effect);
  if (!responsibleForEffectLifecycle(actor, userId) || options?.[MANAGED_CREATE_OPTION]) return;
  if (!isDustEffect(effect) && !isAquaVitaeAddiction(effect)) return;
  runEffectLifecycle(() => reconcileAquaVitaeSuspension(actor));
}

export function handleActiveEffectUpdated(effect, changed, options, userId) {
  const actor = effectActor(effect);
  if (
    !responsibleForEffectLifecycle(actor, userId)
    || options?.[AQUA_SYNC_OPTION]
    || !Object.hasOwn(changed ?? {}, "disabled")
  ) return;

  if (isDustEffect(effect)) {
    runEffectLifecycle(() => effect.disabled
      ? restoreAquaVitaeAddiction(actor, [effect.id])
      : suspendAquaVitaeAddiction(actor, effect.id));
    return;
  }

  if (isAquaVitaeAddiction(effect) && !effect.disabled && activeDustEffectIds(actor).length) {
    runEffectLifecycle(() => suspendAquaVitaeAddiction(actor));
  }
}

export function handleActiveEffectDeleted(effect, options, userId) {
  const actor = effectActor(effect);
  if (
    !responsibleForEffectLifecycle(actor, userId)
    || options?.[AQUA_SYNC_OPTION]
    || !isDustEffect(effect)
  ) return;
  runEffectLifecycle(() => restoreAquaVitaeAddiction(actor, [effect.id]));
}

function effectActor(effect) {
  const parent = effect?.parent;
  if (parent?.documentName === "Actor") return parent;
  if (parent?.documentName === "Item") return parent.actor ?? parent.parent ?? null;
  return null;
}

function responsibleForEffectLifecycle(actor, userId) {
  if (!actor?.isOwner) return false;
  if (userId) return userId === game.user.id;
  return game.user.isGM && isPrimaryActiveGM();
}

function runEffectLifecycle(callback) {
  void Promise.resolve()
    .then(callback)
    .catch(error => console.error(`${MODULE_ID} | Aqua Vitae lifecycle failed.`, error));
}

function changesFromEffect(changes) {
  return changes.map(change => ({
    ability: change.key.split(".")[2],
    value: numeric(change.value),
    mode: Object.entries(CONST.ACTIVE_EFFECT_MODES).find(([, value]) => value === change.mode)?.[0]?.toLowerCase() ?? "add"
  }));
}

function modifierLabel(change) {
  if (change.label) return change.condition ? `${change.label} — ${change.condition}` : change.label;
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
  const visibleChanges = changes.filter(change => change.label || numeric(change.value) !== 0);
  const rollLine = Number.isFinite(Number(total))
    ? `<div class="stat-shift-card__roll">${tr("Result", "Wynik")}: <strong>${escapeHtml(total)}</strong> / DC ${escapeHtml(dc)}</div>`
    : "";
  const changesLine = visibleChanges.length
    ? `<div class="stat-shift-card__changes">${visibleChanges.map(change => `<span>${escapeHtml(modifierLabel(change))}</span>`).join("")}</div>`
    : `<div class="stat-shift-card__changes"><span>${tr("No mechanical changes", "Brak zmian mechanicznych")}</span></div>`;
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
  for (const actor of managedActors()) {
    const expired = actor.effects.filter(effect => {
      const flags = effect.flags?.[MODULE_ID];
      if (!flags) return false;
      if (Number.isFinite(flags.expiresAtCalendar) && Number.isFinite(calendarNow) && calendarNow >= flags.expiresAtCalendar) return true;
      if (Number.isFinite(flags.expiresAtWorldTime) && game.time.worldTime >= flags.expiresAtWorldTime) return true;
      if (Number.isFinite(Number(effect.duration?.turns)) && Number(effect.duration?.remaining) <= 0) return true;
      return false;
    });
    if (expired.length) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", expired.map(effect => effect.id));
      await reconcileAquaVitaeSuspension(actor);
    }
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

function managedActors() {
  const actors = new Map();
  for (const actor of game.actors?.contents ?? []) actors.set(actor.uuid, actor);
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (token.actor) actors.set(token.actor.uuid, token.actor);
  }
  return actors.values();
}

export function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}
