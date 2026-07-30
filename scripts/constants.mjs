export const MODULE_ID = "stat-shift";
export const SOCKET_NAME = `module.${MODULE_ID}`;
export const AQUA_VITAE_ADDICTION_NAME = "Aqua Vitae Addiction";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

export const ABILITY_LABELS = {
  str: { en: "Strength", pl: "Siła" },
  dex: { en: "Dexterity", pl: "Zręczność" },
  con: { en: "Constitution", pl: "Kondycja" },
  int: { en: "Intelligence", pl: "Inteligencja" },
  wis: { en: "Wisdom", pl: "Mądrość" },
  cha: { en: "Charisma", pl: "Charyzma" }
};

export const VARIANTS = {
  jack: { en: "Jack of All Trades", pl: "Jack of All Trades" },
  balanced: { en: "Balanced", pl: "Balanced" },
  specialist: { en: "Specialist", pl: "Specialist" }
};

const form = (en, pl, profiles) => ({ en, pl, profiles });

export const FORMS = {
  cat: form("Cat", "Kot", {
    jack: [["dex", 2], ["wis", 1], ["cha", 1], ["str", 0]],
    balanced: [["dex", 3], ["wis", 2], ["cha", 2], ["str", -2]],
    specialist: [["dex", 4], ["wis", 2], ["con", -2], ["str", -4]]
  }),
  bear: form("Bear", "Niedźwiedź", {
    jack: [["str", 2], ["con", 1], ["wis", 1], ["dex", 0]],
    balanced: [["str", 3], ["con", 2], ["wis", 2], ["dex", -2]],
    specialist: [["str", 4], ["con", 2], ["cha", -2], ["dex", -4]]
  }),
  boar: form("Boar", "Dzik", {
    jack: [["con", 2], ["str", 1], ["wis", 1], ["int", 0]],
    balanced: [["con", 3], ["str", 2], ["wis", 2], ["int", -2]],
    specialist: [["con", 4], ["str", 2], ["dex", -2], ["int", -4]]
  }),
  owl: form("Owl", "Sowa", {
    jack: [["int", 2], ["wis", 1], ["dex", 1], ["con", 0]],
    balanced: [["int", 3], ["wis", 2], ["dex", 2], ["con", -2]],
    specialist: [["int", 4], ["wis", 2], ["str", -2], ["con", -4]]
  }),
  eagle: form("Eagle", "Orzeł", {
    jack: [["wis", 2], ["dex", 1], ["con", 1], ["cha", 0]],
    balanced: [["wis", 3], ["dex", 2], ["con", 2], ["cha", -2]],
    specialist: [["wis", 4], ["dex", 2], ["int", -2], ["cha", -4]]
  }),
  peacock: form("Peacock", "Paw", {
    jack: [["cha", 2], ["dex", 1], ["int", 1], ["wis", 0]],
    balanced: [["cha", 3], ["dex", 2], ["int", 2], ["wis", -2]],
    specialist: [["cha", 4], ["dex", 2], ["con", -2], ["wis", -4]]
  })
};

export const POTIONS = {
  hill: { en: "Hill Giant", pl: "Olbrzym Wzgórzowy", score: 21 },
  stone: { en: "Stone Giant", pl: "Kamienny Olbrzym", score: 23 },
  frost: { en: "Frost Giant", pl: "Lodowy Olbrzym", score: 23 },
  fire: { en: "Fire Giant", pl: "Ognisty Olbrzym", score: 25 },
  cloud: { en: "Cloud Giant", pl: "Chmurowy Olbrzym", score: 27 },
  storm: { en: "Storm Giant", pl: "Burzowy Olbrzym", score: 29 }
};

export function language() {
  try {
    return game.settings.get(MODULE_ID, "interfaceLanguage") === "pl" ? "pl" : "en";
  } catch (_error) {
    return "en";
  }
}

export function localName(entry) {
  return entry?.[language()] ?? entry?.en ?? "";
}

export function tr(en, pl) {
  return language() === "pl" ? pl : en;
}

export function emptyModifiers() {
  return Object.fromEntries(ABILITIES.map(ability => [ability, 0]));
}

export function profileModifiers(formId = "cat", variantId = "jack", outcome = "success") {
  const ordered = FORMS[formId]?.profiles?.[variantId] ?? [];
  const result = emptyModifiers();
  if (outcome === "success") {
    for (const [ability, value] of ordered) result[ability] = value;
    return result;
  }

  const penalties = {
    jack: [-2, -1, -1, 0],
    balanced: [-2, -1, -1, -1],
    specialist: [-3, -2, -1, -1]
  }[variantId] ?? [-2, -1, -1, 0];

  ordered.forEach(([ability], index) => {
    result[ability] = penalties[index] ?? 0;
  });
  return result;
}

export function formIcon(formId, outcome) {
  return `modules/${MODULE_ID}/assets/icons/${formId}-${outcome}.webp`;
}

export function pickRandomDustProfile(formId = "cat", variantId = "jack", mode = "both", random = Math.random) {
  const selection = { formId, variantId };
  if (mode === "form" || mode === "both") selection.formId = randomKey(FORMS, random);
  if (mode === "variant" || mode === "both") selection.variantId = randomKey(VARIANTS, random);
  return selection;
}

function randomKey(collection, random) {
  const keys = Object.keys(collection);
  return keys[Math.floor(random() * keys.length)];
}

export function randomId() {
  return foundry.utils.randomID(16);
}
