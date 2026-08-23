import assert from "node:assert/strict";
import test from "node:test";

const actor = {
  id: "actor-1",
  uuid: "Actor.actor-1",
  name: "Test Actor",
  img: "icons/svg/mystery-man.svg",
  system: { tools: {}, spells: {} },
  getRollData: () => ({}),
  async createEmbeddedDocuments(_type, documents) {
    this.lastEffectData = documents[0];
    return [{ ...documents[0], id: "effect-1" }];
  }
};

globalThis.Application = class {
  constructor(options = {}) {
    this.options = options;
  }

  static get defaultOptions() {
    return {};
  }
};
globalThis.foundry = {
  utils: {
    mergeObject: (base, extra) => ({ ...base, ...extra }),
    randomID: () => "request-id"
  }
};
globalThis.CONST = {
  ACTIVE_EFFECT_MODES: { CUSTOM: 0, MULTIPLY: 1, ADD: 2, DOWNGRADE: 3, UPGRADE: 4, OVERRIDE: 5 },
  DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 }
};
globalThis.game = {
  settings: { get: () => "en" },
  actors: {
    contents: [actor],
    get: id => id === actor.id ? actor : null
  },
  user: { id: "gm-1", isGM: true, character: null },
  users: [],
  time: { worldTime: 100 },
  combat: null,
  modules: new Map()
};
globalThis.canvas = { tokens: { controlled: [], placeables: [] } };
globalThis.fromUuidSync = uuid => uuid === actor.uuid ? actor : null;
globalThis.document = {
  createElement: () => {
    let text = "";
    return {
      set textContent(value) {
        text = String(value ?? "");
      },
      get innerHTML() {
        return text
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }
    };
  }
};
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  applyRollMode: () => {},
  async create(data) {
    globalThis.lastChatData = data;
    return data;
  }
};

const { StatShiftApp } = await import("../scripts/ui.mjs");
const { applyHomebrew } = await import("../scripts/effects.mjs");

test("the shared Homebrew form defaults to direct application", () => {
  const app = new StatShiftApp();
  app.activeTab = "homebrew";
  const html = app.renderContent();

  assert.match(html, /name="noSaveRequired" checked/);
  assert.match(html, /data-homebrew-direct>/);
  assert.match(html, /data-homebrew-save hidden/);
  assert.doesNotMatch(html, /data-tab="save"/);
  assert.match(html, /data-extra-effect-editor data-prefix="direct"/);
});

test("a locked integration always renders saving-throw mode", () => {
  const app = new StatShiftApp();
  app.configureHomebrew({
    actorUuid: actor.uuid,
    requireSave: true,
    lockSaveRequirement: true,
    defaults: { rollBonus: "1d4", failureExtraEffects: [{ type: "ac", target: "actor", value: "-1" }] }
  });
  const html = app.renderContent();

  assert.match(html, /name="noSaveRequired" disabled/);
  assert.match(html, /data-homebrew-direct hidden/);
  assert.match(html, /data-homebrew-save>/);
  assert.match(html, /name="rollBonus" value="1d4"/);
  assert.match(html, /name="failure\.extra\.0\.type"/);
});

test("direct Homebrew applies expanded effects and stores their notes", async () => {
  await applyHomebrew(actor, {
    effectName: "Direct Test",
    icon: "icons/svg/aura.svg",
    mode: "add",
    modifiers: { str: 1 },
    extraEffects: [{
      type: "skillBonus",
      target: "prc",
      value: "1d4",
      condition: "Only while searching for curses"
    }],
    durationValue: 1,
    durationUnit: "hours",
    rollMode: "gmroll",
    description: "A direct effect"
  });

  assert.equal(actor.lastEffectData.flags["stat-shift"].kind, "homebrew");
  assert.deepEqual(actor.lastEffectData.flags["stat-shift"].extendedEffects, [{
    type: "skillBonus",
    target: "prc",
    value: "1d4",
    condition: "Only while searching for curses"
  }]);
  assert.ok(actor.lastEffectData.changes.some(change => change.key === "system.abilities.str.value" && change.value === "1"));
  assert.ok(actor.lastEffectData.changes.some(change => change.key === "system.skills.prc.bonuses.check" && change.value === "1d4"));
  assert.match(actor.lastEffectData.description, /Only while searching for curses/);
});
