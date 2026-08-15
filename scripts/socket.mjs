import { MODULE_ID, SOCKET_NAME, tr } from "./constants.mjs";
import { applyDustOutcome, applySavingThrowOutcome, escapeHtml } from "./effects.mjs";

const pendingRequests = new Map();
const activePrompts = new Set();
const completedPrompts = new Set();

let transportRegistered = false;

export function registerSocket() {
  if (transportRegistered) return;
  transportRegistered = true;

  game.socket.on(SOCKET_NAME, async payload => {
    if (!payload?.type) return;
    if (payload.type === "saveRequest" && payload.recipientId === game.user.id) {
      await openRemoteSavePrompt(payload.request);
    }
    if (payload.type === "saveResult" && payload.gmId === game.user.id && game.user.isGM) {
      await handleSaveResult(payload);
    }
    if (payload.type === "saveCancelled" && payload.gmId === game.user.id && game.user.isGM) {
      await handleSaveCancellation(payload);
    }
  });

  Hooks.on("createChatMessage", message => {
    void handleTransportMessage(message);
  });

  Hooks.on("renderChatMessageHTML", (message, html) => {
    const transport = message.getFlag(MODULE_ID, "transport");
    if (transport?.type !== "saveRequest" || transport.recipientId !== game.user.id) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const button = root?.querySelector?.("[data-action='stat-shift-open-save']");
    button?.addEventListener("click", () => void openRemoteSavePrompt(transport.request));
  });
}

export async function sendSaveRequest(request) {
  if (!game.user.isGM) return;
  const actor = await fromUuid(request.actorUuid);
  if (!actor) throw new Error(tr("The selected actor no longer exists.", "Wybrany aktor już nie istnieje."));
  const recipient = activeOwnerFor(actor) ?? game.user;
  request.gmId = game.user.id;
  request.recipientId = recipient.id;
  pendingRequests.set(request.id, request);

  if (recipient.id === game.user.id) await showSavePrompt(request);
  else await createRequestMessage(recipient, actor, request);

  ui.notifications.info(tr(
    `Saving throw request delivered to ${recipient.name}.`,
    `Prośba o rzut obronny została dostarczona do ${recipient.name}.`
  ));
}

function activeOwnerFor(actor) {
  return game.users
    .filter(user => user.active && !user.isGM && actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER))
    .sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}

async function showSavePrompt(request) {
  const actor = await fromUuid(request.actorUuid);
  if (!actor) {
    ui.notifications.error(tr("The actor for this saving throw was not found.", "Nie znaleziono aktora dla tego rzutu."));
    return;
  }
  const ability = CONFIG.DND5E.abilities?.[request.saveAbility]?.label ?? request.saveAbility?.toUpperCase();
  const automaticBonus = Number(request.rollBonus) || 0;
  const content = `
    <div class="stat-shift-save-prompt">
      <div class="stat-shift-save-prompt__hero">
        <img src="${escapeHtml(actor.img)}" alt="">
        <div>
          <strong>${escapeHtml(actor.name)}</strong>
          <span>${escapeHtml(ability)} ${tr("Saving Throw", "Rzut obronny")} — DC ${escapeHtml(request.dc)}</span>
        </div>
      </div>
      <label>
        <span>${tr("Additional modifier", "Dodatkowy modyfikator")}</span>
        <input type="number" name="bonus" value="0" step="1">
      </label>
      ${automaticBonus ? `<p><strong>${tr("Automatic bonus", "Automatyczny bonus")}: ${automaticBonus >= 0 ? "+" : ""}${escapeHtml(automaticBonus)}</strong></p>` : ""}
      <label>
        <span>${tr("Roll mode", "Tryb rzutu")}</span>
        <select name="advantageMode">
          <option value="normal">${tr("Normal", "Normalny")}</option>
          <option value="advantage">${tr("Advantage", "Przewaga")}</option>
          <option value="disadvantage">${tr("Disadvantage", "Utrudnienie")}</option>
        </select>
      </label>
      <p>${tr(
        "The selected chat visibility was set by the GM.",
        "Widoczność rzutu na czacie została ustawiona przez GMa."
      )}</p>
    </div>`;

  const selection = await foundry.applications.api.DialogV2.wait({
    window: { title: request.title },
    position: { width: 430 },
    content,
    buttons: [
      {
        action: "roll",
        icon: "fa-solid fa-dice-d20",
        label: tr("Roll Saving Throw", "Rzuć rzut obronny"),
        default: true,
        callback: (_event, button) => ({
          action: "roll",
          bonus: Number(button.form?.elements?.bonus?.value) || 0,
          advantageMode: button.form?.elements?.advantageMode?.value ?? "normal"
        })
      },
      {
        action: "cancel",
        icon: "fa-solid fa-xmark",
        label: tr("Cancel", "Anuluj"),
        callback: () => ({ action: "cancel" })
      }
    ],
    rejectClose: false
  });

  if (selection?.action === "roll") await performSave(actor, request, selection);
  else await sendCancellation(actor, request);
}

async function openRemoteSavePrompt(request) {
  if (!request?.id || activePrompts.has(request.id) || completedPrompts.has(request.id)) return;
  activePrompts.add(request.id);
  try {
    await showSavePrompt(request);
    completedPrompts.add(request.id);
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to open remote saving throw request.`, error);
    ui.notifications.error(tr(
      "The saving throw request could not be opened. Use its button in chat to try again.",
      "Nie udało się otworzyć prośby o rzut. Użyj przycisku na czacie, aby spróbować ponownie."
    ));
  } finally {
    activePrompts.delete(request.id);
  }
}

async function createRequestMessage(recipient, actor, request) {
  const ability = CONFIG.DND5E.abilities?.[request.saveAbility]?.label ?? request.saveAbility?.toUpperCase();
  const content = `
    <div class="stat-shift-save-request" data-request-id="${escapeHtml(request.id)}">
      <h3><i class="fa-solid fa-shield-halved"></i>${escapeHtml(request.title)}</h3>
      <p><strong>${escapeHtml(actor.name)}</strong> — ${escapeHtml(ability)} ${tr("Saving Throw", "Rzut obronny")} — DC ${escapeHtml(request.dc)}</p>
      <p>${tr(
        "The saving throw window should open automatically. If it does not, use the button below.",
        "Okno rzutu powinno otworzyć się automatycznie. Jeśli się nie otworzy, użyj przycisku poniżej."
      )}</p>
      <button type="button" data-action="stat-shift-open-save">
        <i class="fa-solid fa-dice-d20"></i>${tr("Open Saving Throw", "Otwórz rzut obronny")}
      </button>
    </div>`;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    whisper: [recipient.id],
    flags: {
      [MODULE_ID]: {
        transport: {
          type: "saveRequest",
          recipientId: recipient.id,
          request
        }
      }
    }
  });
}

async function handleTransportMessage(message) {
  const transport = message.getFlag(MODULE_ID, "transport");
  if (!transport?.type) return;

  if (transport.type === "saveRequest" && transport.recipientId === game.user.id) {
    await openRemoteSavePrompt(transport.request);
    return;
  }

  if (!game.user.isGM || transport.gmId !== game.user.id) return;
  if (transport.type === "saveResult") await handleSaveResult(transport.payload);
  if (transport.type === "saveCancelled") await handleSaveCancellation(transport.payload);
}

async function performSave(actor, request, selection = {}) {
  const bonus = Number(selection.bonus) || 0;
  const automaticBonus = Number(request.rollBonus) || 0;
  const advantageMode = selection.advantageMode ?? "normal";
  const extraParts = [automaticBonus, bonus].filter(value => value !== 0).map(String);
  const rolls = await actor.rollSavingThrow({
    ability: request.saveAbility,
    target: Number(request.dc),
    rolls: [{ parts: extraParts }],
    advantage: advantageMode === "advantage",
    disadvantage: advantageMode === "disadvantage"
  }, {
    configure: false
  }, {
    rollMode: request.rollMode,
    data: {
      flavor: `${request.title} — ${CONFIG.DND5E.abilities?.[request.saveAbility]?.label ?? request.saveAbility} DC ${request.dc}`,
      flags: {
        [MODULE_ID]: {
          requestId: request.id,
          title: request.title
        }
      }
    }
  });
  const roll = Array.isArray(rolls) ? rolls[0] : rolls;
  if (!roll) return;
  const packet = {
    type: "saveResult",
    gmId: request.gmId,
    requestId: request.id,
    actorUuid: actor.uuid,
    actorName: actor.name,
    total: Number(roll.total),
    success: Number(roll.total) >= Number(request.dc),
    bonus,
    automaticBonus,
    advantageMode,
    messageId: roll.parent?.id ?? null
  };
  if (request.gmId === game.user.id) await handleSaveResult(packet);
  else await createResponseMessage("saveResult", request, packet);
}

async function sendCancellation(actor, request) {
  const packet = {
    type: "saveCancelled",
    gmId: request.gmId,
    requestId: request.id,
    actorName: actor.name
  };
  if (request.gmId === game.user.id) {
    await handleSaveCancellation(packet);
  } else await createResponseMessage("saveCancelled", request, packet);
}

async function createResponseMessage(type, request, payload) {
  const gm = game.users.get(request.gmId);
  if (!gm) throw new Error(tr("The requesting GM is no longer available.", "GM wysyłający prośbę nie jest już dostępny."));
  const resultText = type === "saveResult"
    ? `${payload.actorName}: ${payload.total} / DC ${request.dc}`
    : tr(`${payload.actorName} cancelled the saving throw.`, `${payload.actorName} anulował rzut obronny.`);

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker(),
    content: `<div class="stat-shift-transport-result"><p>${escapeHtml(resultText)}</p></div>`,
    whisper: [gm.id],
    flags: {
      [MODULE_ID]: {
        transport: {
          type,
          gmId: gm.id,
          payload
        }
      }
    }
  });
}

async function handleSaveResult(payload) {
  const request = pendingRequests.get(payload.requestId);
  if (!request) {
    ui.notifications.warn(tr(
      "This Stat Shift request is no longer active.",
      "Ta prośba Stat Shift nie jest już aktywna."
    ));
    return;
  }
  const actor = await fromUuid(request.actorUuid);
  if (!actor) return;
  pendingRequests.delete(payload.requestId);
  const outcome = payload.success ? "success" : "failure";
  if (request.kind === "dust") await applyDustOutcome(actor, request, outcome, payload);
  else await applySavingThrowOutcome(actor, request, outcome, payload);
  await cleanupTransportMessages(payload.requestId);
  ui.notifications.info(tr(
    `${request.title}: ${payload.success ? "success" : "failure"} for ${actor.name}.`,
    `${request.title}: ${payload.success ? "sukces" : "porażka"} — ${actor.name}.`
  ));
}

async function handleSaveCancellation(payload) {
  const request = pendingRequests.get(payload.requestId);
  if (!request) return;
  pendingRequests.delete(payload.requestId);
  await cleanupTransportMessages(payload.requestId);
  ui.notifications.warn(tr(
    `${payload.actorName} cancelled the Stat Shift saving throw.`,
    `${payload.actorName} anulował rzut obronny Stat Shift.`
  ));
}

async function cleanupTransportMessages(requestId) {
  if (!game.user.isGM || !requestId) return;
  const messages = game.messages.contents.filter(message => {
    const transport = message.getFlag(MODULE_ID, "transport");
    return transport?.request?.id === requestId || transport?.payload?.requestId === requestId;
  });
  await Promise.allSettled(messages.map(message => message.delete()));
}
