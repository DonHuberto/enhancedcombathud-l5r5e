# Changelog

## 2.0.1 - 2026-07-23

- Support owned `character` and `npc` actors, including adversary/minion skill-group data, while retaining Foundry document permissions.
- Remove the module's duplicate mechanical turn-state flags and project the canonical core Combatant state.
- Defer checked-action consumption to core Roll & Keep resolution and route immediate actions through the core transaction API.
- Pass stable Strike metadata, the current target and a frozen active-grip attack profile.
- Remove Free Movement from action buttons, keep Wait as an action, and append an active-combatant-only End Turn command.
- Consume the core action registry and document the complete action mapping.
- Add stable manifest/update URLs, release validation and NPC/action regression tests.

Users upgrading from 2.0.0 may need to reinstall once from the stable `releases/latest/download/module.json` manifest because 2.0.0 stored a tag-pinned manifest URL.
