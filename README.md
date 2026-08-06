# Stat Shift

Stat Shift is a Foundry VTT module for managing temporary ability score
changes caused by potions, creature abilities, substances, and custom effects.

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

### Homebrew without a saving throw

The GM can edit:

- effect name, icon, description, and target;
- every ability score modifier;
- change mode: Add, Upgrade, Override, or Downgrade;
- duration in turns, minutes, hours, days, or permanently;
- chat visibility.

### Homebrew with a saving throw

- Editable title, ability, DC, target, roll mode, and duration.
- Success and failure changes are configured independently.
- Either outcome may apply an effect or do nothing.
- The player receives a saving throw window with an additional modifier and
  Normal / Advantage / Disadvantage choices.
- The roll uses the native dnd5e 5.3.3 saving throw workflow.

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
2. Create and push a semantic version tag, for example `v0.1.5`.
3. GitHub Actions builds `stat-shift.zip`, updates the release manifest, and
   publishes both files to the matching GitHub Release.

## Artwork and licenses

The module code is licensed under MIT. Animal icons are derived from
non-AI, freely licensed artwork. Full source, author, modification, and license
details are in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
