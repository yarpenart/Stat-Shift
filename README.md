# Stat Shift

Stat Shift is a Foundry VTT module for managing temporary ability scores,
roll modifiers, movement, senses, defenses, hit points, spell slots, and other
custom effects.

## Compatibility

- Foundry VTT 14, verified on build 365
- dnd5e 5.3.3
- Dice So Nice (recommended)
- Simple Calendar Reborn (recommended)

## Main features

### Fixed dnd5e effects

- Potion of Giant Strength variants from Hill Giant through Storm Giant.
- Uses Active Effect `Upgrade` mode, so a naturally higher Strength score is
  never lowered.
- Shadow Strength Drain rolls an editable formula, applies the rolled Strength
  loss, and removes it after a short or long rest.

### Homebrew effects with an optional saving throw

The former Homebrew and Homebrew Save editors are now one Homebrew workflow.
The GM chooses **Does not require a saving throw** to apply the configured
effect directly to the actor, or clears it to request a save.

- Effect name, icon, description, target, duration, chat visibility and change
  mode remain editable.
- The full expanded effect editor is available in both modes: ability scores,
  skills, tools, saving throws, attacks, advantage/disadvantage, senses, speed,
  AC, maximum HP and spell slots.
- Direct mode creates the Active Effect immediately and never opens a roll
  prompt.
- Saving-throw mode keeps independent success and failure configurations.

- Editable title, ability, DC, target, roll mode, and duration.
- Success and failure changes are configured independently.
- Either outcome may apply an effect or do nothing.
- Each outcome can modify ability scores, individual or all skills, tools,
  saving throws and melee/ranged weapon or spell attacks.
- Skill, tool, save and attack changes support both formulas and
  Advantage/Disadvantage.
- Outcomes may increase or decrease individual senses, individual or all
  speeds, AC, maximum HP, and maximum spell slots of levels 1–9.
- Success and failure have separate optional descriptions. Description-only
  outcomes are supported.
- Every additional modifier has an optional situational note. The note is
  displayed in the Active Effect and chat card; it is descriptive and does not
  automatically interpret arbitrary written conditions.
- The GM's automatic modifier and the player's additional modifier accept both
  flat numbers and dice formulas such as `1d4` or `1d6 + 2`.
- The player receives a saving throw window with Normal / Advantage /
  Disadvantage choices.
- Requests are delivered as private Foundry chat documents. The window opens
  automatically, and the private chat card provides a fallback button if the
  window does not appear or must be reopened.
- The GM receives a delivery notification only after the private request has
  actually been created for the owning player.
- The roll uses the native dnd5e 5.3.3 saving throw workflow.

Sense changes update the actor's dnd5e sense ranges. Foundry's core dnd5e
system does not automatically convert those Active Effect values into token
vision configuration. Spell-slot changes adjust the maximum while the effect
is active and restore the actor's prior slot override when the effect ends.

### Dust of Potential

Default DC: Constitution 20. Default duration: one calendar day.

| Form | Primary ability | Weak ability |
|---|---|---|
| Cat | Dexterity | Strength |
| Bear | Strength | Dexterity |
| Boar | Constitution | Intelligence |
| Owl | Intelligence | Constitution |
| Eagle | Wisdom | Charisma |
| Peacock | Charisma | Wisdom |

Available variants:

- Jack of All Trades
- Balanced
- Specialist

Every success and failure modifier is editable before the request is sent. The
created effect is named `S. Form Variant` or `F. Form Variant`.

Alongside manual form and variant selection, the GM can randomize:

- only the form;
- only the variant;
- both the form and variant.

The random result is shown immediately and remains fully editable before the
saving throw request is sent or the effect is applied directly.

The GM can also skip the roll and directly apply either outcome. This is useful
after correcting or rolling back calendar time.

Whenever either Dust outcome is applied, an Active Effect named
`Aqua Vitae Addiction` on the same actor is temporarily disabled. It is
found whether it is stored directly on the actor or originates from one of the
actor's owned features/items. It is restored to its previous active/inactive
state after the last active Dust effect ends or is removed. The name match is
case-insensitive.

### GM data

Per actor, the module records:

- total successes and failures;
- how many times each form was applied;
- how many times each variant was applied;
- recent application history, including manual applications.

All counters are editable. Data can be merged into another actor and,
optionally, cleared from the source actor after transfer.

## Integrations

### Dice So Nice

Saving throws and formula rolls are posted as native Foundry/dnd5e roll
messages, so Dice So Nice animates them automatically and respects the selected
roll mode.

### Simple Calendar Reborn

Minute, hour, and day durations use the active calendar's configured time
units. Stat Shift also listens for Simple Calendar date changes and removes
expired module effects even when calendar time is not advanced in one
continuous step.

### Counterspell PLUS — Identify

Counterspell PLUS can open the shared Stat Shift **Homebrew** editor for an
item identification risk through `game.statShift.openHomebrew(...)`. The
identifying actor is preselected and locked as the target. The integration also
locks the workflow to saving-throw mode, while the GM may still edit every
save, outcome, modifier, duration, icon, description, and roll-mode field
before sending the request.
The Identify spell level is prefilled as an automatic modifier to the saving
throw and remains visible and editable in the GM form. The GM may replace it
with a flat number or a dice formula.

The older `game.statShift.openHomebrewSave(...)` API remains available as a
backward-compatible wrapper and always requires a saving throw.

## GM launcher

The floating Stat Shift button is visible only to GMs. Its position can be
dragged and saved per client. `Configure Settings → Module Settings → Stat
Shift` contains settings for:

- English or Polish module UI;
- showing or hiding the launcher;
- locking its position.

## Installation

Use this manifest URL in Foundry VTT or The Forge:

```text
https://github.com/yarpenart/stat-shift/releases/latest/download/module.json
```

## Creating a release

1. Push the desired changes to `main`.
2. Create and push a semantic version tag, for example `v0.3.0`.
3. GitHub Actions builds `stat-shift.zip`, updates the release manifest, and
   publishes both files to the matching GitHub Release.

## Artwork and licenses

The module code is licensed under MIT. Animal icons are derived from
non-AI, freely licensed artwork. Full source, author, modification, and license
details are in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
