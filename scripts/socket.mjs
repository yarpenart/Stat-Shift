import { MODULE_ID, SOCKET_NAME, tr } from "./constants.mjs";
import { applyDustOutcome, applySavingThrowOutcome, escapeHtml } from "./effects.mjs";

const pendingRequests = new Map();

export function registerSocket() {
  game.socket.on(SOCKET_NAME, async payload => {
    if (!payload?.type) return;
    if (payload.type === "saveRequest" && payload.recipientId === game.user.id) {
      await showSavePrompt(payload.request);
    }
    if (payload.type === "saveResult" && payload.gmId === game.user.id && game.user.isGM) {
      await handleSaveResult(payload);
    }
    if (payload.type === "saveCancelled" && payload.gmId === game.user.id && game.user.isGM) {
      pendingRequests.delete(payload.requestId);
      ui.notifications.warn(tr(
        `${payload.actorName} cancelled the Stat Shift saving throw.`,
        `${payload.actorName} anulował rzut obronny Stat Shift.`
      ));
    }
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
  const packet = { type: "saveRequest", recipientId: recipient.id, request };
  if (recipient.id === game.user.id) await showSavePrompt(request);
  else game.socket.emit(SOCKET_NAME, packet);
  ui.notifications.info(tr(
    `Saving throw request sent to ${recipient.name}.`,
    `Prośba o rzut obronny została wysłana do ${recipient.name}.`
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
  else sendCancellation(actor, request);
}

async function performSave(actor, request, selection = {}) {
  const bonus = Number(selection.bonus) || 0;
  const automaticBonus = Number(request.rollBonus) || 0;
  const advantageMode = selection.advantageMode ?? "normal";
  const rolls = await actor.rollSavingThrow({
    ability: request.saveAbility,
    target: Number(request.dc),
    parts: [automaticBonus, bonus].filter(value => value !== 0).map(String),
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
  else game.socket.emit(SOCKET_NAME, packet);
}

function sendCancellation(actor, request) {
  const packet = {
    type: "saveCancelled",
    gmId: request.gmId,
    requestId: request.id,
    actorName: actor.name
  };
  if (request.gmId === game.user.id) {
    pendingRequests.delete(request.id);
    ui.notifications.warn(tr("Saving throw cancelled.", "Rzut obronny anulowany."));
  } else game.socket.emit(SOCKET_NAME, packet);
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
  ui.notifications.info(tr(
    `${request.title}: ${payload.success ? "success" : "failure"} for ${actor.name}.`,
    `${request.title}: ${payload.success ? "sukces" : "porażka"} — ${actor.name}.`
  ));
}
