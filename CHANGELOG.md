# Changelog

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
