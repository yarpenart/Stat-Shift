import { FORMS, MODULE_ID, VARIANTS } from "./constants.mjs";
import {
  applyDustOutcome,
  applyHomebrew,
  applyPreset,
  checkExpiredEffects,
  createStatEffect,
  handleActiveEffectCreated,
  handleActiveEffectDeleted,
  handleActiveEffectUpdated,
  reconcileAllAquaVitaeSuspensions,
  removeRestEffects
} from "./effects.mjs";
import { registerSocket } from "./socket.mjs";
import { getDustStats, setDustStats, transferDustStats } from "./stats.mjs";
import { openStatShift, renderLauncher } from "./ui.mjs";

Hooks.once("init", () => {
  registerSettings();
  console.log(`${MODULE_ID} | Initializing Stat Shift`);
});

Hooks.once("ready", () => {
  registerSocket();
  renderLauncher();
  registerRuntimeHooks();
  void initializeEffectLifecycle().catch(error => {
    console.error(`${MODULE_ID} | Initial effect lifecycle check failed.`, error);
  });

  game.statShift = {
    open: openStatShift,
    applyPreset,
    applyHomebrew,
    applyDustOutcome,
    createStatEffect,
    getDustStats,
    setDustStats,
    transferDustStats,
    forms: FORMS,
    variants: VARIANTS
  };

  if (game.system.id !== "dnd5e") {
    ui.notifications.error("Stat Shift requires the dnd5e system.");
  }
});

function registerSettings() {
  game.settings.register(MODULE_ID, "interfaceLanguage", {
    name: "STATSHIFT.Settings.Language",
    hint: "STATSHIFT.Settings.LanguageHint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      en: "English",
      pl: "Polski"
    },
    default: "en",
    requiresReload: true
  });
  game.settings.register(MODULE_ID, "showLauncher", {
    name: "STATSHIFT.Settings.ShowLauncher",
    hint: "STATSHIFT.Settings.ShowLauncherHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: renderLauncher
  });
  game.settings.register(MODULE_ID, "lockLauncher", {
    name: "STATSHIFT.Settings.LockLauncher",
    hint: "STATSHIFT.Settings.LockLauncherHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, "launcherX", {
    scope: "client",
    config: false,
    type: Number,
    default: 120
  });
  game.settings.register(MODULE_ID, "launcherY", {
    scope: "client",
    config: false,
    type: Number,
    default: 180
  });
}

function registerRuntimeHooks() {
  Hooks.on("canvasReady", renderLauncher);
  Hooks.on("updateWorldTime", () => checkExpiredEffects());
  Hooks.on("updateCombat", () => checkExpiredEffects());
  Hooks.on("deleteCombat", () => checkExpiredEffects());
  Hooks.on("simple-calendar-date-time-change", () => checkExpiredEffects());
  Hooks.on("dnd5e.restCompleted", (actor, result) => removeRestEffects(actor, result));
  Hooks.on("createActiveEffect", handleActiveEffectCreated);
  Hooks.on("updateActiveEffect", handleActiveEffectUpdated);
  Hooks.on("deleteActiveEffect", handleActiveEffectDeleted);
}

async function initializeEffectLifecycle() {
  await checkExpiredEffects();
  await reconcileAllAquaVitaeSuspensions();
}
