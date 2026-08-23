# Changelog

## 0.2.1

- Added theme-aware text contrast to the dark Stat Shift editor, saving-throw
  prompts and module chat surfaces.
- Dark surfaces now keep light labels, controls and helper text, while Foundry
  light-theme prompts and cards use dark text.

## 0.2.0

- Expanded Homebrew Save outcomes beyond ability scores with skill, tool,
  saving-throw and attack modifiers.
- Added advantage and disadvantage for individual or all skills, tools, saves
  and attack categories.
- Added sense-range, speed, AC, maximum-HP and level 1–9 spell-slot changes.
- Success and failure now have separate descriptions and may create
  description-only effects.
- Every additional modifier supports an optional situational note stored in the
  Active Effect description and displayed on its chat card.
- Added native dnd5e 5.3.3 attack-roll handling and reversible spell-slot
  maximum reconciliation for active Stat Shift effects.

## 0.1.8

- Automatic and player-entered saving-throw modifiers now accept dice formulas
  such as `1d4`, `1d6 + 2`, and ordinary flat numbers.
- Added formula validation before the modifier is passed to the native dnd5e
  saving throw through `rolls[].parts`.

## 0.1.7

- Replaced the unconfirmed GM-to-player saving-throw socket notification with
  a reliable private ChatMessage transport.
- Saving-throw requests now open automatically for the owning player and also
  include a private chat button that can reopen the prompt if necessary.
- Saving-throw results and cancellations return to the requesting GM through
  the same document-based transport.
- Fixed automatic and player-entered saving-throw bonuses for dnd5e 5.3.3 by
  passing them through the current `rolls[].parts` roll configuration.
- The GM only sees a delivery notification after Foundry creates the private
  request message successfully.

## 0.1.6

- Added a public `game.statShift.openHomebrewSave(...)` integration for other
  modules.
- The integration can open the Homebrew Save tab with a preselected, locked
  target actor and editable default values.
- Added an editable automatic saving-throw bonus, used by Identify to add its
  cast spell level to the identifying caster's roll.
- Added Counterspell PLUS Identify integration documentation.

## 0.1.5

- Migrated the module manifest to Foundry VTT 14 Build 365.
- Migrated the saving-throw prompt to the V14 `DialogV2` API.
- Updated the Simple Calendar Reborn recommendation for its V14-compatible 2.6.x release line.

## 0.1.3

- Added three Dust of Potential randomization controls: random form, random
  variant, and random form plus variant.
- A random result immediately refreshes the effect names, animal icons, and
  default success/failure modifiers.
- Every randomized value remains editable by the GM before use.

## 0.1.2

- Fixed `Aqua Vitae Addiction` not being disabled when the effect originates
  from an owned feature or item instead of being embedded directly on the
  actor.
- Dust now checks actor-owned, applied, and item-owned Active Effects.
- The exact source effect and its previous disabled state are restored after
  the final Dust effect ends.
- Active Effect lifecycle hooks now correctly resolve item-owned effects back
  to their actor.

## 0.1.1

- Dust of Potential now temporarily disables an Active Effect named
  `Aqua Vitae Addiction`, regardless of saving throw outcome.
- The addiction effect returns to its previous active/inactive state when the
  last Dust of Potential effect ends, is disabled, or is removed.
- Overlapping Dust effects no longer reactivate the addiction too early.
- Existing effects are reconciled after a world reload, and unlinked token
  actors are included in expiration checks.

## 0.1.0

- Added fixed Potion of Giant Strength and Strength Drain effects.
- Added homebrew ability effects with and without saving throws.
- Added the complete Dust of Potential workflow.
- Added success/failure, form, variant, and history tracking per actor.
- Added editable data transfer between actors.
- Added Dice So Nice and Simple Calendar Reborn integration.
- Added draggable GM launcher and English/Polish interface setting.
- Added non-AI animal icons from CC BY 3.0 and CC0 sources.
