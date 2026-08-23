import { ABILITIES, ABILITY_LABELS, MODULE_ID, localName, tr } from "./constants.mjs";
import { isValidRollModifier, normalizeRollModifier } from "./roll-formula.mjs";

const SPELL_SLOT_BASELINE_FLAG = "spellSlotBaseline";
const SPELL_SLOT_SYNC_OPTION = "statShiftSpellSlotSync";

const SKILL_LABELS = {
  acr: { en: "Acrobatics", pl: "Akrobatyka" },
  ani: { en: "Animal Handling", pl: "Opieka nad zwierzętami" },
  arc: { en: "Arcana", pl: "Wiedza tajemna" },
  ath: { en: "Athletics", pl: "Atletyka" },
  dec: { en: "Deception", pl: "Oszustwo" },
  his: { en: "History", pl: "Historia" },
  ins: { en: "Insight", pl: "Intuicja" },
  inv: { en: "Investigation", pl: "Śledztwo" },
  itm: { en: "Intimidation", pl: "Zastraszanie" },
  med: { en: "Medicine", pl: "Medycyna" },
  nat: { en: "Nature", pl: "Natura" },
  prc: { en: "Perception", pl: "Percepcja" },
  prf: { en: "Performance", pl: "Występy" },
  per: { en: "Persuasion", pl: "Perswazja" },
  rel: { en: "Religion", pl: "Religia" },
  slt: { en: "Sleight of Hand", pl: "Zwinne dłonie" },
  ste: { en: "Stealth", pl: "Skradanie" },
  sur: { en: "Survival", pl: "Sztuka przetrwania" }
};

const TOOL_LABELS = {
  alchemist: { en: "Alchemist's Supplies", pl: "Przybory alchemika" },
  bagpipes: { en: "Bagpipes", pl: "Dudy" },
  brewer: { en: "Brewer's Supplies", pl: "Przybory piwowara" },
  calligrapher: { en: "Calligrapher's Supplies", pl: "Przybory kaligrafa" },
  card: { en: "Playing Card Set", pl: "Zestaw kart" },
  carpenter: { en: "Carpenter's Tools", pl: "Narzędzia cieśli" },
  cartographer: { en: "Cartographer's Tools", pl: "Narzędzia kartografa" },
  chess: { en: "Dragonchess Set", pl: "Zestaw szachów" },
  cobbler: { en: "Cobbler's Tools", pl: "Narzędzia szewca" },
  cook: { en: "Cook's Utensils", pl: "Naczynia kucharza" },
  dice: { en: "Dice Set", pl: "Zestaw kości" },
  disg: { en: "Disguise Kit", pl: "Zestaw do charakteryzacji" },
  drum: { en: "Drum", pl: "Bęben" },
  dulcimer: { en: "Dulcimer", pl: "Cymbały" },
  flute: { en: "Flute", pl: "Flet" },
  forg: { en: "Forgery Kit", pl: "Zestaw fałszerski" },
  glassblower: { en: "Glassblower's Tools", pl: "Narzędzia szklarza" },
  herb: { en: "Herbalism Kit", pl: "Zestaw zielarski" },
  horn: { en: "Horn", pl: "Róg" },
  jeweler: { en: "Jeweler's Tools", pl: "Narzędzia jubilera" },
  leatherworker: { en: "Leatherworker's Tools", pl: "Narzędzia kaletnika" },
  lute: { en: "Lute", pl: "Lutnia" },
  lyre: { en: "Lyre", pl: "Lira" },
  mason: { en: "Mason's Tools", pl: "Narzędzia murarza" },
  navg: { en: "Navigator's Tools", pl: "Narzędzia nawigatora" },
  painter: { en: "Painter's Supplies", pl: "Przybory malarskie" },
  panflute: { en: "Pan Flute", pl: "Fletnia Pana" },
  pois: { en: "Poisoner's Kit", pl: "Zestaw truciciela" },
  potter: { en: "Potter's Tools", pl: "Narzędzia garncarza" },
  shawm: { en: "Shawm", pl: "Szałamaja" },
  smith: { en: "Smith's Tools", pl: "Narzędzia kowala" },
  thief: { en: "Thieves' Tools", pl: "Narzędzia złodziejskie" },
  tinker: { en: "Tinker's Tools", pl: "Narzędzia druciarza" },
  viol: { en: "Viol", pl: "Wiola" },
  weaver: { en: "Weaver's Tools", pl: "Narzędzia tkacza" },
  woodcarver: { en: "Woodcarver's Tools", pl: "Narzędzia snycerza" }
};

const ATTACK_LABELS = {
  all: { en: "All attacks", pl: "Wszystkie ataki" },
  mwak: { en: "Melee weapon attacks", pl: "Ataki bronią wręcz" },
  rwak: { en: "Ranged weapon attacks", pl: "Ataki bronią dystansową" },
  msak: { en: "Melee spell attacks", pl: "Ataki zaklęciem wręcz" },
  rsak: { en: "Ranged spell attacks", pl: "Ataki zaklęciem dystansowym" }
};

const SENSE_LABELS = {
  darkvision: { en: "Darkvision", pl: "Widzenie w ciemności" },
  blindsight: { en: "Blindsight", pl: "Ślepowidzenie" },
  tremorsense: { en: "Tremorsense", pl: "Wyczucie drgań" },
  truesight: { en: "Truesight", pl: "Prawdziwe widzenie" }
};

const SPEED_LABELS = {
  all: { en: "All speeds", pl: "Wszystkie szybkości" },
  walk: { en: "Walking speed", pl: "Szybkość chodzenia" },
  burrow: { en: "Burrowing speed", pl: "Szybkość kopania" },
  climb: { en: "Climbing speed", pl: "Szybkość wspinania" },
  fly: { en: "Flying speed", pl: "Szybkość latania" },
  swim: { en: "Swimming speed", pl: "Szybkość pływania" }
};

const EXTRA_TYPES = new Set([
  "skillBonus", "toolBonus", "saveBonus", "attackBonus",
  "skillMode", "toolMode", "saveMode", "attackMode",
  "sense", "speed", "ac", "maxHp", "spellSlots"
]);

const MODE_TYPES = new Set(["skillMode", "toolMode", "saveMode", "attackMode"]);
const NUMBER_TYPES = new Set(["sense", "speed", "ac", "maxHp", "spellSlots"]);
const FORMULA_TYPES = new Set(["skillBonus", "toolBonus", "saveBonus", "attackBonus"]);

export function extraEffectTypeOptions() {
  return [
    ["skillBonus", tr("Skill modifier", "Modyfikator do skilla")],
    ["toolBonus", tr("Tool modifier", "Modyfikator do narzędzia")],
    ["saveBonus", tr("Saving throw modifier", "Modyfikator do rzutu obronnego")],
    ["attackBonus", tr("Attack modifier", "Modyfikator do ataku")],
    ["skillMode", tr("Skill advantage / disadvantage", "Przewaga / utrudnienie do skilla")],
    ["toolMode", tr("Tool advantage / disadvantage", "Przewaga / utrudnienie do narzędzia")],
    ["saveMode", tr("Save advantage / disadvantage", "Przewaga / utrudnienie do rzutu obronnego")],
    ["attackMode", tr("Attack advantage / disadvantage", "Przewaga / utrudnienie do ataku")],
    ["sense", tr("Sense range", "Zasięg zmysłu")],
    ["speed", tr("Speed", "Szybkość")],
    ["ac", tr("Armor Class", "Klasa Pancerza")],
    ["maxHp", tr("Maximum HP", "Maksymalne PW")],
    ["spellSlots", tr("Maximum spell slots", "Maksymalna liczba slotów")]
  ];
}

export function extraEffectTargetOptions(type, actor = null) {
  if (["skillBonus", "skillMode"].includes(type)) {
    return [["all", tr("All skills", "Wszystkie skille")], ...Object.entries(SKILL_LABELS).map(([id, label]) => [id, localName(label)])];
  }
  if (["toolBonus", "toolMode"].includes(type)) {
    const labels = { ...TOOL_LABELS };
    for (const id of Object.keys(actor?.system?.tools ?? {})) labels[id] ??= { en: id, pl: id };
    return [["all", tr("All tools", "Wszystkie narzędzia")], ...Object.entries(labels).map(([id, label]) => [id, localName(label)])];
  }
  if (["saveBonus", "saveMode"].includes(type)) {
    return [["all", tr("All saving throws", "Wszystkie rzuty obronne")], ...ABILITIES.map(id => [id, localName(ABILITY_LABELS[id])])];
  }
  if (["attackBonus", "attackMode"].includes(type)) {
    return Object.entries(ATTACK_LABELS).map(([id, label]) => [id, localName(label)]);
  }
  if (type === "sense") return Object.entries(SENSE_LABELS).map(([id, label]) => [id, localName(label)]);
  if (type === "speed") return Object.entries(SPEED_LABELS).map(([id, label]) => [id, localName(label)]);
  if (type === "spellSlots") {
    return Array.from({ length: 9 }, (_value, index) => {
      const level = index + 1;
      return [`spell${level}`, tr(`Level ${level}`, `Poziom ${level}`)];
    });
  }
  return [["actor", tr("Actor", "Postać")]];
}

export function extraEffectValueKind(type) {
  if (MODE_TYPES.has(type)) return "mode";
  if (NUMBER_TYPES.has(type)) return "number";
  return "formula";
}

export function normalizeExtraEffects(effects = []) {
  if (!Array.isArray(effects)) return [];
  return effects
    .map(effect => ({
      type: String(effect?.type ?? "").trim(),
      target: String(effect?.target ?? "").trim(),
      value: String(effect?.value ?? "").trim(),
      condition: String(effect?.condition ?? "").trim()
    }))
    .filter(effect => effect.type && effect.target && effect.value);
}

export function validateExtraEffects(effects = [], actor = null) {
  const normalized = normalizeExtraEffects(effects);
  for (const effect of normalized) {
    if (!EXTRA_TYPES.has(effect.type)) throw invalidExtraEffectError();
    const validTargets = new Set(extraEffectTargetOptions(effect.type, actor).map(([id]) => id));
    if (!validTargets.has(effect.target)) throw invalidExtraEffectError();
    if (MODE_TYPES.has(effect.type) && !["advantage", "disadvantage"].includes(effect.value)) {
      throw invalidExtraEffectError();
    }
    if (FORMULA_TYPES.has(effect.type) && !isValidRollModifier(effect.value)) {
      throw new Error(tr(
        "An additional modifier contains an invalid dice formula.",
        "Dodatkowy modyfikator zawiera niepoprawną formułę kości."
      ));
    }
    if (NUMBER_TYPES.has(effect.type) && !Number.isFinite(Number(effect.value))) {
      throw new Error(tr(
        "A sense, speed, AC, HP, or spell-slot change must be a number.",
        "Zmiana zmysłu, szybkości, KP, PW albo slotów musi być liczbą."
      ));
    }
  }
  return normalized.filter(effect => {
    if (MODE_TYPES.has(effect.type)) return true;
    if (NUMBER_TYPES.has(effect.type)) return Number(effect.value) !== 0;
    return normalizeRollModifier(effect.value) !== "0";
  });
}

function invalidExtraEffectError() {
  return new Error(tr(
    "An additional effect has an invalid type, target, or value.",
    "Dodatkowy efekt ma niepoprawny typ, cel albo wartość."
  ));
}

export function extraEffectsToChanges(effects = [], actor = null) {
  const changes = [];
  const toolIds = [...new Set([...Object.keys(TOOL_LABELS), ...Object.keys(actor?.system?.tools ?? {})])];
  const add = (key, value, mode = CONST.ACTIVE_EFFECT_MODES.ADD) => changes.push({
    key,
    mode,
    value: String(value),
    priority: 20
  });

  for (const effect of normalizeExtraEffects(effects)) {
    const { type, target } = effect;
    const value = FORMULA_TYPES.has(type) ? normalizeRollModifier(effect.value) : effect.value;
    if (type === "skillBonus") {
      if (target === "all") add("system.bonuses.abilities.skill", value);
      else add(`system.skills.${target}.bonuses.check`, value);
    } else if (type === "toolBonus") {
      for (const id of expandedTargets(target, toolIds)) add(`system.tools.${id}.bonuses.check`, value);
    } else if (type === "saveBonus") {
      if (target === "all") add("system.bonuses.abilities.save", value);
      else add(`system.abilities.${target}.bonuses.save`, value);
    } else if (type === "attackBonus") {
      for (const id of expandedTargets(target, ["mwak", "rwak", "msak", "rsak"])) add(`system.bonuses.${id}.attack`, value);
    } else if (type === "skillMode") {
      for (const id of expandedTargets(target, Object.keys(SKILL_LABELS))) add(`system.skills.${id}.roll.mode`, modeValue(value));
    } else if (type === "toolMode") {
      for (const id of expandedTargets(target, toolIds)) add(`system.tools.${id}.roll.mode`, modeValue(value));
    } else if (type === "saveMode") {
      for (const id of expandedTargets(target, ABILITIES)) add(`system.abilities.${id}.save.roll.mode`, modeValue(value));
    } else if (type === "sense") {
      add(`system.attributes.senses.ranges.${target}`, value);
    } else if (type === "speed") {
      add(target === "all" ? "system.attributes.movement.bonus" : `system.attributes.movement.${target}`, value);
    } else if (type === "ac") {
      add("system.attributes.ac.bonus", value);
    } else if (type === "maxHp") {
      add("system.attributes.hp.tempmax", value);
    }
  }
  return changes;
}

function expandedTargets(target, allTargets) {
  return target === "all" ? allTargets : [target];
}

function modeValue(value) {
  return value === "disadvantage" ? -1 : 1;
}

export function extraEffectDisplayEntries(effects = [], actor = null) {
  return normalizeExtraEffects(effects).map(effect => ({
    label: extraEffectLabel(effect, actor),
    condition: effect.condition
  }));
}

export function extraEffectLabel(effect, actor = null) {
  const target = extraEffectTargetOptions(effect.type, actor).find(([id]) => id === effect.target)?.[1] ?? effect.target;
  if (MODE_TYPES.has(effect.type)) {
    const mode = effect.value === "disadvantage" ? tr("Disadvantage", "Utrudnienie") : tr("Advantage", "Przewaga");
    return `${mode}: ${target}`;
  }
  const signed = signedFormula(effect.value);
  if (effect.type === "sense") return `${target} ${signed}`;
  if (effect.type === "speed") return `${target} ${signed}`;
  if (effect.type === "ac") return `${tr("Armor Class", "Klasa Pancerza")} ${signed}`;
  if (effect.type === "maxHp") return `${tr("Maximum HP", "Maksymalne PW")} ${signed}`;
  if (effect.type === "spellSlots") return `${tr("Spell slots", "Sloty zaklęć")} — ${target} ${signed}`;
  return `${target} ${signed}`;
}

function signedFormula(value) {
  const formula = String(value ?? "0").trim();
  return formula.startsWith("-") ? formula : `+${formula}`;
}

export function buildExtendedDescription(description = "", effects = [], escape = value => String(value ?? "")) {
  const base = String(description ?? "").trim();
  const conditioned = normalizeExtraEffects(effects).filter(effect => effect.condition);
  if (!conditioned.length) return base;
  const notes = conditioned.map(effect => `<li><strong>${escape(extraEffectLabel(effect))}</strong>: ${escape(effect.condition)}</li>`).join("");
  return `${base}${base ? "<hr>" : ""}<p><strong>${escape(tr("Situational modifiers", "Modyfikatory sytuacyjne"))}</strong></p><ul>${notes}</ul>`;
}

export function applyAttackRollModes(config) {
  const activity = config?.subject;
  const actor = activity?.actor;
  if (!actor) return;
  const actionType = activity.getActionType?.(config.attackMode) ?? activity.actionType;
  if (!actionType) return;
  let advantage = false;
  let disadvantage = false;
  for (const effect of activeModuleEffects(actor)) {
    for (const extra of normalizeExtraEffects(effect.flags?.[MODULE_ID]?.extendedEffects)) {
      if (extra.type !== "attackMode" || !["all", actionType].includes(extra.target)) continue;
      if (extra.value === "advantage") advantage = true;
      if (extra.value === "disadvantage") disadvantage = true;
    }
  }
  if (advantage) config.advantage = true;
  if (disadvantage) config.disadvantage = true;
}

function activeModuleEffects(actor) {
  const effects = actor?.effects?.contents
    ?? Array.from(actor?.effects?.values?.() ?? actor?.effects ?? []);
  return effects.filter(effect =>
    !effect.disabled && !effect.isSuppressed && effect.flags?.[MODULE_ID]
  );
}

function activeSpellSlotBonuses(actor) {
  const totals = {};
  for (const effect of activeModuleEffects(actor)) {
    for (const extra of normalizeExtraEffects(effect.flags?.[MODULE_ID]?.extendedEffects)) {
      if (extra.type !== "spellSlots") continue;
      totals[extra.target] = (totals[extra.target] ?? 0) + Number(extra.value || 0);
    }
  }
  return totals;
}

export async function reconcileSpellSlotBonuses(actor) {
  if (!actor?.system?.spells || !actor.isOwner) return;
  const totals = activeSpellSlotBonuses(actor);
  const saved = actor.getFlag(MODULE_ID, SPELL_SLOT_BASELINE_FLAG);
  const state = {
    levels: saved?.levels && typeof saved.levels === "object" ? foundry.utils.deepClone(saved.levels) : {}
  };
  const updates = {};

  for (const [key, total] of Object.entries(totals)) {
    if (!state.levels[key]) {
      state.levels[key] = {
        override: actor._source?.system?.spells?.[key]?.override ?? null,
        baseMax: Number(actor.system.spells?.[key]?.max ?? 0)
      };
    }
    const desired = Math.max(0, Number(state.levels[key].baseMax ?? 0) + Number(total));
    if (actor._source?.system?.spells?.[key]?.override !== desired) {
      updates[`system.spells.${key}.override`] = desired;
    }
  }

  for (const [key, baseline] of Object.entries(state.levels)) {
    if (Object.hasOwn(totals, key)) continue;
    const original = baseline.override ?? null;
    if (actor._source?.system?.spells?.[key]?.override !== original) {
      updates[`system.spells.${key}.override`] = original;
    }
    delete state.levels[key];
  }

  if (Object.keys(state.levels).length) await actor.setFlag(MODULE_ID, SPELL_SLOT_BASELINE_FLAG, state);
  if (!foundry.utils.isEmpty(updates)) await actor.update(updates, { [SPELL_SLOT_SYNC_OPTION]: true });
  if (!Object.keys(state.levels).length && saved !== undefined) await actor.unsetFlag(MODULE_ID, SPELL_SLOT_BASELINE_FLAG);
}

export async function reconcileAllSpellSlotBonuses() {
  if (!game.user.isGM || !isPrimaryActiveGM()) return;
  for (const actor of managedActors()) await reconcileSpellSlotBonuses(actor);
}

export function handleExtendedEffectCreated(effect, _options, userId) {
  scheduleSpellSlotReconciliation(effect, userId);
}

export function handleExtendedEffectUpdated(effect, _changed, options, userId) {
  if (options?.[SPELL_SLOT_SYNC_OPTION]) return;
  scheduleSpellSlotReconciliation(effect, userId);
}

export function handleExtendedEffectDeleted(effect, _options, userId) {
  scheduleSpellSlotReconciliation(effect, userId);
}

function scheduleSpellSlotReconciliation(effect, userId) {
  const actor = effect?.parent?.documentName === "Actor" ? effect.parent : null;
  if (!actor?.isOwner || (userId && userId !== game.user.id)) return;
  void Promise.resolve()
    .then(() => reconcileSpellSlotBonuses(actor))
    .catch(error => {
      console.error(`${MODULE_ID} | Spell-slot reconciliation failed.`, error);
    });
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
