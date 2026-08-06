# Changelog

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
