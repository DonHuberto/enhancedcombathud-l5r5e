# Changelog

## 2.0.11 - 2026-08-06

- Move Ninjo and Giri below the portrait into the row immediately above the vertical Skills, Techniques and Equipment controls.
- Align Action and Water Action above the Roll Required group, Movement above No Roll, and fit the complete HUD width to its rendered upper and action tiers instead of leaving an empty tail after End Turn.
- Move palette artwork to the right edge of each control and enlarge the compact weapon and armor statistic badges.
- Replace the scattered square palette tiles with searchable, compact vertical category lists and make the close control reliably remove the visible panel state.
- Treat techniques explicitly marked `activation.requires_check` as rollable even without a predefined skill by opening the Dice Picker with the full skill-category selection; ordinary left-click no longer opens an item sheet, while right-click remains the intentional edit route.
- Add regression coverage for technique skill normalization, check metadata, compact list palettes, identity placement, turn-economy alignment and fitted HUD width.

## 2.0.10 - 2026-08-06

- Treat Fatigue and Strife as accumulating tracks which begin empty, fill upward, continue beyond Endurance or Composure, and retain their uncapped numeric `value/threshold` readout.
- Render at most 24 resource markers in two rows of twelve; values and thresholds above 24 remain numeric while the visual track stays capped.
- Present Void Points as 45-degree diamond markers and combine Focus, Vigilance, Honor, Glory and Status into one icon-led vertical list.
- Rebuild Skills, Techniques and Equipment as icon/label/divider/caret rows and place every conflict action in one bottom row beneath the icon-led turn-economy strip.
- Show Water Action only in Water stance, order weapon statistics as Range, Damage and Deadliness using the same Font Awesome icons as the system Conflict sheet, and place armor names above resistance icons.
- Remove the non-dismissible profile tracker panel which displayed headings such as `Skirmish` over the ring selector.
- Add replaceable SVG placeholders for stat, palette and turn-economy artwork plus regression coverage for accumulating resources and the revised layout hierarchy.

## 2.0.9 - 2026-08-06

- Replace segmented Fatigue, Strife and Void meters with responsive colored spheres; cap the display at twelve elements and group values above the cap into a darker reserve which depletes first.
- Keep Focus and Vigilance on solid, unsegmented panels.
- Increase active weapon grip and weapon/armor property typography, including on narrower layouts where those properties were previously hidden.
- Raise Skills, Techniques and Equipment palettes above the complete HUD and portrait tier so every entry remains visible and clickable.
- Let L5R5e tooltips size to their content within the viewport, with internal scrolling for long technique descriptions instead of clipping them in Argon's fixed container.
- Add regression coverage for sphere calculations, solid secondary resources, palette stacking and flexible tooltip sizing.

## 2.0.8 - 2026-08-06

- Stop clamping Argon's scale-compensated HUD width, which previously shrank the interface to roughly two thirds of the available viewport.
- Recompose the interface into a substantial character-and-equipment tier above a dedicated action tier, with larger typography, rings, resource meters and effect targets.
- Place the active weapon and equipped armor in full square cards beside the character panel, with the I–III loadout strip directly above them.
- Keep Universal compact while allowing conflict profiles to span the viewport with grouped two-row actions, centered turn economy and a separated End Turn control.
- Add regression coverage for the compensated width, two-tier composition, square equipment cards and compact Universal profile.

## 2.0.7 - 2026-08-06

- Rebuild the L5R5e Argon HUD around a lacquered cRPG layout with a dynamic character panel, rings, active weapon/grip, equipped armor, weapon sets and responsive action space.
- Derive profile actions from the public L5R5e action registry, hide Wait, retain Throw Item, separate checked and no-check actions, and expose primary action, Water action and movement state.
- Add searchable Skills, Techniques and Equipment palettes, keyboard focus/Escape support, Water restriction explanations, active equipment popovers and EN/PL localization.
- Extend regression coverage for registry action grouping, Water restrictions, active-grip selection, safe technique fallbacks and Universal versus conflict HUD composition.

## 2.0.6 - 2026-08-05

- Reserve the complete weapon-and-armor strip width before laying out actions so equipment cards no longer cover the first action columns.
- Keep every ordinary action clickable in the two-row grid while Equipment and Techniques retain their full two-by-two square geometry.
- Add a layout-contract regression test, verify the corrected hit targets in simultaneous player sessions and require L5R5E 1.14.115 for the corrected legacy weapon range profile.

## 2.0.5 - 2026-08-04

- Stop player clients from throwing during `controlToken` when Argon does not register its optional `alwaysOn` setting for that client.
- Treat an unavailable optional core setting as disabled while preserving normal always-on binding when the setting exists.
- Add regression coverage for the exact missing-setting exception observed during simultaneous GM and two-player Foundry testing.

## 2.0.4 - 2026-08-04

- Centralize the executable route for every action displayed by the Universal, Intrigue, Duel, Skirmish and Mass Battle profiles.
- Add an exhaustive regression test proving that public profile lists, runtime button lists and their action routes cannot drift apart.
- Require L5R5E 1.14.112, whose equipment lifecycle now consumes the same canonical `prepare_item` action ID as the HUD.

## 2.0.3 - 2026-07-25

- Place full-size weapon and armor squares directly beside the unobscured portrait and hide the duplicate legacy weapon-set strip.
- Render ordinary actions as a strict two-row half-size grid while Equipment and Techniques occupy full-size two-by-two squares.
- Fix portrait enhancement when Argon's component root is itself the portrait element.
- Require a visible target for Strike, pass it into the core roll and preserve automatic attack and damage resolution.
- Stop initial weapon-set synchronization from producing loadout warnings whenever the HUD is rebuilt at a new round.
- Expose Throw Item in Skirmish and Duel when the core house rule is enabled and a held item is available.
- Add live-layout and action-list regression assertions for the corrected HUD contract.

## 2.0.2 - 2026-07-24

- Redesign the Combat HUD around an L5R washi, sumi, urushi, aged-gold and dark-wood palette while keeping the portrait unobscured and adapting to smaller viewports.
- Present the three main resources as full-width meter rows, secondary values in compact columns and actions as a two-row icon grid with a separated active-turn-only End Turn button.
- Add persistent weapon and armor cards with active grip, damage, deadliness, range and qualities; expose unarmed Punch/Kick/Bite when no weapon is readied.
- Add optional Tactical Grid range highlighting from the weapon card without making that module a hard dependency.
- Add the opt-in improvised Throw Item action for any held item while keeping RAW thrown grips under Strike and Soaring Slice as a technique.
- Route Prepare, grip, drop and whole Weapon Set changes through core equipment transactions, including hand validation and cancel-safe reservation handling.
- Add English/Polish localization, the Throw Item icon, expanded documentation and regression coverage for the layout and core contracts.

## 2.0.1 - 2026-07-23

- Support owned `character` and `npc` actors, including adversary/minion skill-group data, while retaining Foundry document permissions.
- Remove the module's duplicate mechanical turn-state flags and project the canonical core Combatant state.
- Defer checked-action consumption to core Roll & Keep resolution and route immediate actions through the core transaction API.
- Pass stable Strike metadata, the current target and a frozen active-grip attack profile.
- Remove Free Movement from action buttons, keep Wait as an action, and append an active-combatant-only End Turn command.
- Consume the core action registry and document the complete action mapping.
- Add stable manifest/update URLs, release validation and NPC/action regression tests.

Users upgrading from 2.0.0 may need to reinstall once from the stable `releases/latest/download/module.json` manifest because 2.0.0 stored a tag-pinned manifest URL.
