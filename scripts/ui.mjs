import {
  ABILITIES,
  ABILITY_LABELS,
  FORMS,
  MODULE_ID,
  POTIONS,
  VARIANTS,
  formIcon,
  localName,
  pickRandomDustProfile,
  profileModifiers,
  randomId,
  tr
} from "./constants.mjs";
import {
  applyDustOutcome,
  applyHomebrew,
  applyPreset,
  escapeHtml
} from "./effects.mjs";
import { sendSaveRequest } from "./socket.mjs";
import {
  getDustStats,
  setDustStats,
  transferDustStats
} from "./stats.mjs";

export class StatShiftApp extends Application {
  constructor(options = {}) {
    super(options);
    this.activeTab = "presets";
    this.fixedPreset = "potion";
    this.statsActorId = null;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "stat-shift-app",
      classes: ["stat-shift-window"],
      width: 860,
      height: 760,
      resizable: true,
      minimizable: true,
      scrollY: [".stat-shift-body"]
    });
  }

  get title() {
    return tr("Stat Shift — GM Console", "Stat Shift — Panel GMa");
  }

  async _renderInner() {
    return $(this.renderContent());
  }

  renderContent() {
    const tabs = [
      ["presets", "fa-flask", tr("Fixed Effects", "Efekty sztywne")],
      ["homebrew", "fa-sliders", "Homebrew"],
      ["save", "fa-shield-halved", tr("Homebrew Save", "Homebrew z rzutem")],
      ["dust", "fa-paw", "Dust of Potential"],
      ["data", "fa-chart-column", tr("GM Data", "Dane GMa")]
    ];
    return `
      <div class="stat-shift-shell">
        <header class="stat-shift-topbar">
          <div>
            <h2><i class="fa-solid fa-arrows-left-right-to-line"></i> Stat Shift</h2>
            <p>${tr("Temporary ability changes for dnd5e", "Tymczasowe zmiany cech dla dnd5e")}</p>
          </div>
          <div class="stat-shift-integrations">
            ${integrationBadge("dice-so-nice", "Dice So Nice")}
            ${integrationBadge("foundryvtt-simple-calendar-reborn", "Simple Calendar")}
          </div>
        </header>
        <nav class="stat-shift-tabs">
          ${tabs.map(([id, icon, label]) => `
            <button type="button" data-tab="${id}" class="${this.activeTab === id ? "active" : ""}">
              <i class="fa-solid ${icon}"></i><span>${label}</span>
            </button>`).join("")}
        </nav>
        <main class="stat-shift-body">
          ${this.renderActiveTab()}
        </main>
      </div>`;
  }

  renderActiveTab() {
    if (this.activeTab === "homebrew") return this.renderHomebrew();
    if (this.activeTab === "save") return this.renderSave();
    if (this.activeTab === "dust") return this.renderDust();
    if (this.activeTab === "data") return this.renderData();
    return this.renderPresets();
  }

  renderPresets() {
    const actorId = defaultActorId();
    const potion = this.fixedPreset === "potion";
    return `
      <form class="stat-shift-form" data-form="preset">
        ${sectionTitle(tr("Fixed dnd5e effects", "Sztywne efekty dnd5e"), tr(
          "Ready-made mechanics remain editable before they are applied.",
          "Gotowe mechaniki można edytować przed ich nałożeniem."
        ))}
        ${actorPicker("actorId", "preset-actor", actorId)}
        <div class="stat-shift-segmented">
          <button type="button" data-fixed-preset="potion" class="${potion ? "active" : ""}">${tr("Potion of Giant Strength", "Potion of Giant Strength")}</button>
          <button type="button" data-fixed-preset="strengthDrain" class="${!potion ? "active" : ""}">${tr("Shadow — Strength Drain", "Shadow — Strength Drain")}</button>
        </div>
        ${potion ? this.renderPotionFields() : this.renderStrengthDrainFields()}
        <div class="stat-shift-actions">
          <button type="button" data-action="apply-preset" class="stat-shift-primary">
            <i class="fa-solid fa-wand-magic-sparkles"></i>${tr("Apply Effect", "Nałóż efekt")}
          </button>
        </div>
      </form>`;
  }

  renderPotionFields() {
    return `
      <input type="hidden" name="preset" value="potion">
      <div class="stat-shift-grid two">
        <label><span>${tr("Giant type", "Rodzaj olbrzyma")}</span>
          <select name="potionType" data-potion-type>
            ${Object.entries(POTIONS).map(([id, potion]) => `<option value="${id}">${localName(potion)} — ${potion.score}</option>`).join("")}
          </select>
        </label>
        <label><span>${tr("Strength score", "Wartość Siły")}</span><input type="number" name="score" value="21" min="1" max="40"></label>
      </div>
      <label><span>${tr("Effect name", "Nazwa efektu")}</span><input type="text" name="effectName" value="${tr("Potion of Hill Giant Strength", "Mikstura Siły Olbrzyma Wzgórzowego")}"></label>
      <label><span>${tr("Icon path", "Ścieżka ikony")}</span><input type="text" name="icon" value="icons/consumables/potions/bottle-corked-empty.webp"></label>
      ${durationFields(1, "hours")}
      ${rollModeField()}
      <div class="stat-shift-note"><i class="fa-solid fa-circle-info"></i>${tr(
        "The Upgrade mode is used: a naturally higher Strength score is never reduced.",
        "Używany jest tryb Upgrade: naturalnie wyższa Siła nigdy nie zostanie obniżona."
      )}</div>`;
  }

  renderStrengthDrainFields() {
    return `
      <input type="hidden" name="preset" value="strengthDrain">
      <label><span>${tr("Effect name", "Nazwa efektu")}</span><input type="text" name="effectName" value="${tr("Shadow — Strength Drain", "Cień — Wysysanie Siły")}"></label>
      <div class="stat-shift-grid two">
        <label><span>${tr("Strength loss formula", "Formuła utraty Siły")}</span><input type="text" name="formula" value="1d4"></label>
        <label><span>${tr("Duration", "Czas trwania")}</span><input type="text" value="${tr("Until short or long rest", "Do krótkiego lub długiego odpoczynku")}" disabled></label>
      </div>
      <label><span>${tr("Icon path", "Ścieżka ikony")}</span><input type="text" name="icon" value="icons/magic/unholy/hand-claw-fire-blue.webp"></label>
      ${rollModeField()}
      <div class="stat-shift-note warning"><i class="fa-solid fa-skull"></i>${tr(
        "The module rolls the loss, applies it as an Active Effect, and removes it after a completed rest.",
        "Moduł rzuca utratę, nakłada ją jako Active Effect i usuwa po zakończonym odpoczynku."
      )}</div>`;
  }

  renderHomebrew() {
    return `
      <form class="stat-shift-form" data-form="homebrew">
        ${sectionTitle(tr("Homebrew ability effect", "Homebrew — zmiana cech"), tr(
          "Apply one or several editable changes without a saving throw.",
          "Nałóż jedną lub kilka edytowalnych zmian bez rzutu obronnego."
        ))}
        ${actorPicker("actorId", "homebrew-actor", defaultActorId())}
        <div class="stat-shift-grid two">
          <label><span>${tr("Effect name", "Nazwa efektu")}</span><input type="text" name="effectName" value="${tr("Homebrew Stat Shift", "Homebrew — Zmiana cech")}"></label>
          ${modeField()}
        </div>
        <label><span>${tr("Icon path", "Ścieżka ikony")}</span><input type="text" name="icon" value="icons/magic/control/buff-strength-muscle-damage-orange.webp"></label>
        ${modifiersEditor("mod", {})}
        ${durationFields(1, "hours")}
        ${rollModeField()}
        <label><span>${tr("Description", "Opis")}</span><textarea name="description" rows="2"></textarea></label>
        <div class="stat-shift-actions">
          <button type="button" data-action="apply-homebrew" class="stat-shift-primary">
            <i class="fa-solid fa-wand-magic-sparkles"></i>${tr("Apply Without Roll", "Nałóż bez rzutu")}
          </button>
        </div>
      </form>`;
  }

  renderSave() {
    return `
      <form class="stat-shift-form" data-form="save">
        ${sectionTitle(tr("Homebrew saving throw", "Homebrew — rzut obronny"), tr(
          "Success and failure can each apply changes, or do nothing.",
          "Sukces i porażka mogą niezależnie nakładać zmiany albo nie robić nic."
        ))}
        ${actorPicker("actorId", "save-actor", defaultActorId())}
        <div class="stat-shift-grid three">
          <label><span>${tr("Chat title", "Tytuł na czacie")}</span><input type="text" name="title" value="${tr("Resist the Effect", "Oprzyj się efektowi")}"></label>
          ${abilityField("saveAbility", "con")}
          <label><span>DC</span><input type="number" name="dc" value="15" min="1"></label>
        </div>
        <div class="stat-shift-grid two">
          <label><span>${tr("Effect base name", "Bazowa nazwa efektu")}</span><input type="text" name="effectName" value="${tr("Homebrew Effect", "Efekt Homebrew")}"></label>
          ${modeField()}
        </div>
        ${rollModeField()}
        ${durationFields(1, "hours")}
        <div class="stat-shift-outcomes">
          <section class="success">
            <label class="stat-shift-toggle"><input type="checkbox" name="applySuccess"><span>${tr("Apply changes on success", "Nałóż zmiany po sukcesie")}</span></label>
            <label><span>${tr("Success icon", "Ikona sukcesu")}</span><input type="text" name="successIcon" value="icons/magic/defensive/shield-barrier-glowing-triangle-green.webp"></label>
            ${modifiersEditor("success", {})}
          </section>
          <section class="failure">
            <label class="stat-shift-toggle"><input type="checkbox" name="applyFailure" checked><span>${tr("Apply changes on failure", "Nałóż zmiany po porażce")}</span></label>
            <label><span>${tr("Failure icon", "Ikona porażki")}</span><input type="text" name="failureIcon" value="icons/magic/control/debuff-energy-hold-red.webp"></label>
            ${modifiersEditor("failure", { con: -2 })}
          </section>
        </div>
        <label><span>${tr("Description", "Opis")}</span><textarea name="description" rows="2"></textarea></label>
        <div class="stat-shift-actions">
          <button type="button" data-action="request-save" class="stat-shift-primary">
            <i class="fa-solid fa-shield-halved"></i>${tr("Request Saving Throw", "Poproś o rzut obronny")}
          </button>
        </div>
      </form>`;
  }

  renderDust() {
    const formId = "cat";
    const variantId = "jack";
    const success = profileModifiers(formId, variantId, "success");
    const failure = profileModifiers(formId, variantId, "failure");
    return `
      <form class="stat-shift-form" data-form="dust">
        ${sectionTitle("Dust of Potential", tr(
          "A complete saving throw, effect, duration, and analytics workflow.",
          "Pełny przepływ rzutu, efektu, czasu trwania i statystyk."
        ))}
        ${actorPicker("actorId", "dust-actor", defaultActorId())}
        <div class="stat-shift-grid three">
          <label><span>${tr("Chat title", "Tytuł na czacie")}</span><input type="text" name="title" value="Dust of Potential"></label>
          ${abilityField("saveAbility", "con")}
          <label><span>DC</span><input type="number" name="dc" value="20" min="1"></label>
        </div>
        ${rollModeField()}
        ${durationFields(1, "days")}
        <div class="stat-shift-grid two">
          <label><span>${tr("Form", "Forma")}</span>
            <select name="formId" data-dust-profile>
              ${Object.entries(FORMS).map(([id, entry]) => `<option value="${id}">${localName(entry)}</option>`).join("")}
            </select>
          </label>
          <label><span>${tr("Variant", "Wariant")}</span>
            <select name="variantId" data-dust-profile>
              ${Object.entries(VARIANTS).map(([id, entry]) => `<option value="${id}">${localName(entry)}</option>`).join("")}
            </select>
          </label>
          <label><span>${tr("Form name in effect", "Nazwa formy w efekcie")}</span><input type="text" name="formName" value="${localName(FORMS.cat)}"></label>
          <label><span>${tr("Variant name in effect", "Nazwa wariantu w efekcie")}</span><input type="text" name="variantName" value="${localName(VARIANTS.jack)}"></label>
        </div>
        <div class="stat-shift-randomize">
          <span><i class="fa-solid fa-shuffle"></i>${tr("Random selection", "Losowy wybór")}</span>
          <div>
            <button type="button" data-dust-randomize="form">
              <i class="fa-solid fa-paw"></i>${tr("Random Form", "Losuj formę")}
            </button>
            <button type="button" data-dust-randomize="variant">
              <i class="fa-solid fa-layer-group"></i>${tr("Random Variant", "Losuj wariant")}
            </button>
            <button type="button" data-dust-randomize="both">
              <i class="fa-solid fa-dice"></i>${tr("Random Form and Variant", "Losuj formę i wariant")}
            </button>
          </div>
        </div>
        <div class="stat-shift-outcomes">
          <section class="success">
            <h3><i class="fa-solid fa-circle-check"></i>${tr("Success profile", "Profil sukcesu")}</h3>
            <label><span>${tr("Success icon", "Ikona sukcesu")}</span><input type="text" name="successIcon" value="${formIcon("cat", "success")}"></label>
            ${modifiersEditor("success", success)}
          </section>
          <section class="failure">
            <h3><i class="fa-solid fa-circle-xmark"></i>${tr("Failure profile", "Profil porażki")}</h3>
            <label><span>${tr("Failure icon", "Ikona porażki")}</span><input type="text" name="failureIcon" value="${formIcon("cat", "failure")}"></label>
            ${modifiersEditor("failure", failure)}
          </section>
        </div>
        <div class="stat-shift-manual">
          <label class="stat-shift-toggle"><input type="checkbox" name="manual"><span>${tr("Apply directly without a roll", "Nałóż bezpośrednio bez rzutu")}</span></label>
          <label><span>${tr("Direct result", "Bezpośredni wynik")}</span>
            <select name="manualOutcome">
              <option value="success">${tr("Success (S)", "Sukces (S)")}</option>
              <option value="failure">${tr("Failure (F)", "Porażka (F)")}</option>
            </select>
          </label>
        </div>
        <div class="stat-shift-actions">
          <button type="button" data-action="run-dust" class="stat-shift-primary">
            <i class="fa-solid fa-dice-d20"></i>${tr("Start Dust of Potential", "Uruchom Dust of Potential")}
          </button>
        </div>
      </form>`;
  }

  renderData() {
    const actorId = this.statsActorId ?? defaultActorId();
    const actor = resolveActor(actorId);
    const stats = getDustStats(actor);
    const history = [...stats.history].reverse().slice(0, 30);
    return `
      <form class="stat-shift-form" data-form="data">
        ${sectionTitle(tr("Dust of Potential data", "Dane Dust of Potential"), tr(
          "Counts can be edited and moved to another actor sheet.",
          "Liczniki można edytować oraz przenosić na inną kartę postaci."
        ))}
        ${actorPicker("actorId", "data-actor", actorId, "data-actor")}
        <div class="stat-shift-summary">
          <div class="success"><strong>${stats.successes}</strong><span>${tr("Successes", "Sukcesy")}</span></div>
          <div class="failure"><strong>${stats.failures}</strong><span>${tr("Failures", "Porażki")}</span></div>
          <div><strong>${stats.history.length}</strong><span>${tr("Recorded doses", "Zapisane dawki")}</span></div>
        </div>
        <div class="stat-shift-data-edit">
          <label><span>${tr("Successes", "Sukcesy")}</span><input type="number" min="0" name="stats.successes" value="${stats.successes}"></label>
          <label><span>${tr("Failures", "Porażki")}</span><input type="number" min="0" name="stats.failures" value="${stats.failures}"></label>
        </div>
        <h3>${tr("Forms", "Formy")}</h3>
        <div class="stat-shift-data-edit six">
          ${Object.entries(FORMS).map(([id, entry]) => `<label><span>${localName(entry)}</span><input type="number" min="0" name="forms.${id}" value="${stats.forms[id]}"></label>`).join("")}
        </div>
        <h3>${tr("Variants", "Warianty")}</h3>
        <div class="stat-shift-data-edit three">
          ${Object.entries(VARIANTS).map(([id, entry]) => `<label><span>${localName(entry)}</span><input type="number" min="0" name="variants.${id}" value="${stats.variants[id]}"></label>`).join("")}
        </div>
        <div class="stat-shift-actions">
          <button type="button" data-action="save-stats" class="stat-shift-primary"><i class="fa-solid fa-floppy-disk"></i>${tr("Save Counters", "Zapisz liczniki")}</button>
        </div>
        <section class="stat-shift-transfer">
          <h3>${tr("Transfer data", "Przenieś dane")}</h3>
          ${actorPicker("targetActorId", "transfer-target", "", null, actorId)}
          <label class="stat-shift-toggle"><input type="checkbox" name="clearSource" checked><span>${tr("Clear the source actor after transfer", "Wyczyść aktora źródłowego po przeniesieniu")}</span></label>
          <button type="button" data-action="transfer-stats"><i class="fa-solid fa-arrow-right-arrow-left"></i>${tr("Transfer", "Przenieś")}</button>
        </section>
        <section class="stat-shift-history">
          <h3>${tr("Recent history", "Ostatnia historia")}</h3>
          ${history.length ? history.map(entry => historyRow(entry)).join("") : `<p>${tr("No Dust of Potential data yet.", "Brak danych Dust of Potential.")}</p>`}
        </section>
      </form>`;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-tab]").on("click", event => {
      this.activeTab = event.currentTarget.dataset.tab;
      this.render(false);
    });
    html.find("[data-fixed-preset]").on("click", event => {
      this.fixedPreset = event.currentTarget.dataset.fixedPreset;
      this.render(false);
    });
    html.find("[data-actor-filter]").on("input", event => filterActorSelect(event.currentTarget));
    html.find("[data-potion-type]").on("change", event => {
      const form = event.currentTarget.closest("form");
      const potion = POTIONS[event.currentTarget.value];
      form.elements.score.value = potion.score;
      form.elements.effectName.value = tr(
        `Potion of ${potion.en} Strength`,
        `Mikstura Siły: ${potion.pl}`
      );
    });
    html.find("[data-dust-profile]").on("change", event => updateDustProfile(event.currentTarget.closest("form")));
    html.find("[data-dust-randomize]").on("click", event => {
      randomizeDustProfile(
        event.currentTarget.closest("form"),
        event.currentTarget.dataset.dustRandomize
      );
    });
    html.find("[data-role='data-actor']").on("change", event => {
      this.statsActorId = event.currentTarget.value;
      this.render(false);
    });
    html.find("[data-action]").on("click", async event => {
      event.preventDefault();
      await this.handleAction(event.currentTarget.dataset.action, event.currentTarget.closest("form"));
    });
  }

  async handleAction(action, form) {
    try {
      if (action === "apply-preset") await this.applyPreset(form);
      if (action === "apply-homebrew") await this.applyHomebrew(form);
      if (action === "request-save") await this.requestSave(form);
      if (action === "run-dust") await this.runDust(form);
      if (action === "save-stats") await this.saveStats(form);
      if (action === "transfer-stats") await this.transferStats(form);
    } catch (error) {
      console.error(`${MODULE_ID} |`, error);
      ui.notifications.error(error.message ?? String(error));
    }
  }

  async applyPreset(form) {
    const data = formObject(form);
    const actor = requiredActor(data.actorId);
    await applyPreset(actor, {
      preset: data.preset,
      effectName: data.effectName,
      icon: data.icon,
      score: numberValue(data.score, 21),
      formula: data.formula,
      durationValue: numberValue(data.durationValue, 1),
      durationUnit: data.durationUnit || "hours",
      rollMode: data.rollMode
    });
    ui.notifications.info(tr(`Effect applied to ${actor.name}.`, `Nałożono efekt na ${actor.name}.`));
  }

  async applyHomebrew(form) {
    const data = formObject(form);
    const actor = requiredActor(data.actorId);
    await applyHomebrew(actor, {
      effectName: data.effectName,
      icon: data.icon,
      mode: data.mode,
      modifiers: readModifiers(data, "mod"),
      durationValue: numberValue(data.durationValue, 1),
      durationUnit: data.durationUnit,
      rollMode: data.rollMode,
      description: data.description
    });
    ui.notifications.info(tr(`Effect applied to ${actor.name}.`, `Nałożono efekt na ${actor.name}.`));
  }

  async requestSave(form) {
    const data = formObject(form);
    const actor = requiredActor(data.actorId);
    await sendSaveRequest({
      id: randomId(),
      kind: "homebrewSave",
      actorUuid: actor.uuid,
      title: data.title,
      effectName: data.effectName,
      saveAbility: data.saveAbility,
      dc: numberValue(data.dc, 15),
      rollMode: data.rollMode,
      mode: data.mode,
      durationValue: numberValue(data.durationValue, 1),
      durationUnit: data.durationUnit,
      applySuccess: Boolean(data.applySuccess),
      applyFailure: Boolean(data.applyFailure),
      successModifiers: readModifiers(data, "success"),
      failureModifiers: readModifiers(data, "failure"),
      successIcon: data.successIcon,
      failureIcon: data.failureIcon,
      description: data.description
    });
  }

  async runDust(form) {
    const data = formObject(form);
    const actor = requiredActor(data.actorId);
    const request = {
      id: randomId(),
      kind: "dust",
      actorUuid: actor.uuid,
      title: data.title || "Dust of Potential",
      saveAbility: data.saveAbility || "con",
      dc: numberValue(data.dc, 20),
      rollMode: data.rollMode,
      durationValue: numberValue(data.durationValue, 1),
      durationUnit: data.durationUnit || "days",
      formId: data.formId,
      formName: data.formName || localName(FORMS[data.formId]),
      variantId: data.variantId,
      variantName: data.variantName || localName(VARIANTS[data.variantId]),
      successModifiers: readModifiers(data, "success"),
      failureModifiers: readModifiers(data, "failure"),
      successIcon: data.successIcon,
      failureIcon: data.failureIcon
    };
    if (data.manual) {
      await applyDustOutcome(actor, request, data.manualOutcome === "failure" ? "failure" : "success", { manual: true });
      ui.notifications.info(tr(`Dust effect applied to ${actor.name}.`, `Nałożono efekt Dust na ${actor.name}.`));
    } else await sendSaveRequest(request);
  }

  async saveStats(form) {
    const data = formObject(form);
    const actor = requiredActor(data.actorId);
    const stats = getDustStats(actor);
    stats.successes = Math.max(0, numberValue(data["stats.successes"]));
    stats.failures = Math.max(0, numberValue(data["stats.failures"]));
    for (const id of Object.keys(FORMS)) stats.forms[id] = Math.max(0, numberValue(data[`forms.${id}`]));
    for (const id of Object.keys(VARIANTS)) stats.variants[id] = Math.max(0, numberValue(data[`variants.${id}`]));
    await setDustStats(actor, stats);
    ui.notifications.info(tr("Dust counters saved.", "Zapisano liczniki Dust."));
    this.render(false);
  }

  async transferStats(form) {
    const data = formObject(form);
    const source = requiredActor(data.actorId);
    const target = requiredActor(data.targetActorId);
    if (source.uuid === target.uuid) throw new Error(tr("Choose a different target actor.", "Wybierz innego aktora docelowego."));
    await transferDustStats(source, target, { clearSource: Boolean(data.clearSource) });
    ui.notifications.info(tr(
      `Dust data transferred from ${source.name} to ${target.name}.`,
      `Przeniesiono dane Dust z ${source.name} do ${target.name}.`
    ));
    this.render(false);
  }
}

function sectionTitle(title, description) {
  return `<div class="stat-shift-section-title"><h2>${title}</h2><p>${description}</p></div>`;
}

function integrationBadge(moduleId, label) {
  const active = game.modules.get(moduleId)?.active;
  return `<span class="${active ? "active" : "inactive"}"><i class="fa-solid ${active ? "fa-circle-check" : "fa-circle-minus"}"></i>${label}</span>`;
}

function actorEntries(excludedId = null) {
  const result = [];
  const seen = new Set();
  for (const token of canvas?.tokens?.placeables ?? []) {
    const actor = token.actor;
    if (!actor || actor.uuid === excludedId || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    result.push({
      actor,
      value: actor.uuid,
      label: `${actor.name} (${tr("Token", "Token")})`,
      token: true
    });
  }
  for (const actor of game.actors.contents) {
    if (actor.uuid === excludedId || seen.has(actor.uuid)) continue;
    result.push({
      actor,
      value: actor.uuid,
      label: `${actor.name} (${tr("Actor", "Aktor")})`,
      token: false
    });
  }
  return result.sort((a, b) => Number(b.token) - Number(a.token) || a.label.localeCompare(b.label));
}

function actorPicker(name, id, selected = "", role = null, excludedId = null) {
  const entries = actorEntries(excludedId);
  return `
    <div class="stat-shift-actor-picker">
      <label><span>${tr("Search actor or token", "Szukaj aktora lub tokenu")}</span>
        <input type="search" data-actor-filter data-target-select="${id}" placeholder="${tr("Type a name…", "Wpisz nazwę…")}">
      </label>
      <label><span>${tr("Target", "Cel")}</span>
        <select name="${name}" id="${id}" ${role ? `data-role="${role}"` : ""}>
          ${entries.map(({ value, label }) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
        </select>
      </label>
    </div>`;
}

function filterActorSelect(input) {
  const select = document.getElementById(input.dataset.targetSelect);
  const query = input.value.trim().toLocaleLowerCase();
  if (!select) return;
  for (const option of select.options) option.hidden = query && !option.text.toLocaleLowerCase().includes(query);
  const first = [...select.options].find(option => !option.hidden);
  if (first) select.value = first.value;
}

function defaultActorId() {
  return canvas?.tokens?.controlled?.[0]?.actor?.uuid
    ?? game.user.character?.uuid
    ?? game.actors.contents[0]?.uuid
    ?? "";
}

function requiredActor(id) {
  const actor = resolveActor(id);
  if (!actor) throw new Error(tr("Select a target actor.", "Wybierz aktora docelowego."));
  return actor;
}

function resolveActor(id) {
  if (!id) return null;
  if (!id.includes(".")) return game.actors.get(id) ?? null;
  const document = fromUuidSync(id);
  if (document?.documentName === "Actor") return document;
  return document?.actor ?? null;
}

function abilityField(name, selected) {
  return `<label><span>${tr("Saving throw", "Rzut obronny")}</span><select name="${name}">
    ${ABILITIES.map(id => `<option value="${id}" ${id === selected ? "selected" : ""}>${localName(ABILITY_LABELS[id])}</option>`).join("")}
  </select></label>`;
}

function modeField() {
  return `<label><span>${tr("Change mode", "Tryb zmiany")}</span><select name="mode">
    <option value="add">${tr("Add / subtract", "Dodaj / odejmij")}</option>
    <option value="upgrade">${tr("Minimum score (Upgrade)", "Minimalna wartość (Upgrade)")}</option>
    <option value="override">${tr("Exact score (Override)", "Dokładna wartość (Override)")}</option>
    <option value="downgrade">${tr("Maximum score (Downgrade)", "Maksymalna wartość (Downgrade)")}</option>
  </select></label>`;
}

function modifiersEditor(prefix, values) {
  return `<div class="stat-shift-modifiers">
    ${ABILITIES.map(ability => {
      const value = Number(values?.[ability] ?? 0);
      return `<label><span>${ability.toUpperCase()}</span><input type="number" step="1" name="${prefix}.${ability}" value="${value >= 0 ? value : value}"></label>`;
    }).join("")}
  </div>`;
}

function durationFields(value, selectedUnit) {
  return `<div class="stat-shift-grid two">
    <label><span>${tr("Duration value", "Wartość czasu")}</span><input type="number" name="durationValue" value="${value}" min="0" step="1"></label>
    <label><span>${tr("Duration unit", "Jednostka czasu")}</span><select name="durationUnit">
      ${[
        ["turns", tr("Turns", "Tury")],
        ["minutes", tr("Minutes", "Minuty")],
        ["hours", tr("Hours", "Godziny")],
        ["days", tr("Days", "Dni")],
        ["permanent", tr("Permanent", "Stały")]
      ].map(([id, label]) => `<option value="${id}" ${id === selectedUnit ? "selected" : ""}>${label}</option>`).join("")}
    </select></label>
  </div>`;
}

function rollModeField() {
  const modes = [
    ["publicroll", tr("Public Roll", "Rzut publiczny")],
    ["gmroll", tr("Private GM Roll", "Prywatny rzut GMa")],
    ["blindroll", tr("Blind GM Roll", "Ślepy rzut GMa")],
    ["selfroll", tr("Self Roll", "Rzut dla siebie")]
  ];
  return `<label><span>${tr("Chat roll mode", "Tryb rzutu na czacie")}</span><select name="rollMode">
    ${modes.map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}
  </select></label>`;
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readModifiers(data, prefix) {
  return Object.fromEntries(ABILITIES.map(ability => [ability, numberValue(data[`${prefix}.${ability}`])]));
}

function updateDustProfile(form) {
  const formId = form.elements.formId.value;
  const variantId = form.elements.variantId.value;
  const success = profileModifiers(formId, variantId, "success");
  const failure = profileModifiers(formId, variantId, "failure");
  form.elements.formName.value = localName(FORMS[formId]);
  form.elements.variantName.value = localName(VARIANTS[variantId]);
  form.elements.successIcon.value = formIcon(formId, "success");
  form.elements.failureIcon.value = formIcon(formId, "failure");
  for (const ability of ABILITIES) {
    form.elements[`success.${ability}`].value = success[ability];
    form.elements[`failure.${ability}`].value = failure[ability];
  }
}

function randomizeDustProfile(form, mode) {
  const selection = pickRandomDustProfile(
    form.elements.formId.value,
    form.elements.variantId.value,
    mode
  );
  form.elements.formId.value = selection.formId;
  form.elements.variantId.value = selection.variantId;
  updateDustProfile(form);
}

function historyRow(entry) {
  const outcome = entry.outcome === "success";
  const date = entry.calendarDate || new Date(entry.at ?? Date.now()).toLocaleString();
  return `
    <details>
      <summary>
        <span class="${outcome ? "success" : "failure"}">${outcome ? "S" : "F"}</span>
        <strong>${escapeHtml(entry.formName ?? entry.formId)} — ${escapeHtml(entry.variantName ?? entry.variantId)}</strong>
        <time>${escapeHtml(date)}</time>
      </summary>
      <div>
        <p>${escapeHtml(entry.title ?? "Dust of Potential")} ${entry.manual ? `(${tr("manual", "ręcznie")})` : ""}</p>
        <p>${Object.entries(entry.modifiers ?? {}).filter(([, value]) => Number(value) !== 0).map(([ability, value]) => `${ability.toUpperCase()} ${Number(value) >= 0 ? "+" : ""}${value}`).join(", ")}</p>
        ${entry.total !== null && entry.total !== undefined ? `<p>${tr("Roll", "Rzut")}: ${entry.total} / DC ${entry.dc}</p>` : ""}
      </div>
    </details>`;
}

let appInstance;

export function openStatShift() {
  if (!game.user.isGM) {
    ui.notifications.warn(tr("Only a GM can open Stat Shift.", "Tylko GM może otworzyć Stat Shift."));
    return;
  }
  appInstance ??= new StatShiftApp();
  appInstance.render(true);
}

export function renderLauncher() {
  document.getElementById("stat-shift-launcher")?.remove();
  if (!game.user.isGM || !game.settings.get(MODULE_ID, "showLauncher")) return;
  const button = document.createElement("button");
  button.id = "stat-shift-launcher";
  button.type = "button";
  button.title = tr("Open Stat Shift", "Otwórz Stat Shift");
  button.innerHTML = `<i class="fa-solid fa-arrows-left-right-to-line"></i><span>Stat Shift</span>`;
  button.style.left = `${game.settings.get(MODULE_ID, "launcherX")}px`;
  button.style.top = `${game.settings.get(MODULE_ID, "launcherY")}px`;
  button.addEventListener("click", event => {
    if (!button.dataset.dragged) openStatShift();
    delete button.dataset.dragged;
  });
  button.addEventListener("pointerdown", event => startLauncherDrag(event, button));
  document.body.append(button);
}

function startLauncherDrag(event, button) {
  if (game.settings.get(MODULE_ID, "lockLauncher") || event.button !== 0) return;
  event.preventDefault();
  const startX = event.clientX;
  const startY = event.clientY;
  const rect = button.getBoundingClientRect();
  const move = moveEvent => {
    const left = Math.max(0, Math.min(window.innerWidth - rect.width, rect.left + moveEvent.clientX - startX));
    const top = Math.max(0, Math.min(window.innerHeight - rect.height, rect.top + moveEvent.clientY - startY));
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
    if (Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY) > 4) button.dataset.dragged = "true";
  };
  const up = async () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    await game.settings.set(MODULE_ID, "launcherX", Math.round(parseFloat(button.style.left)));
    await game.settings.set(MODULE_ID, "launcherY", Math.round(parseFloat(button.style.top)));
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up, { once: true });
}
