# Foundry VTT 14 smoke checklist

- Install L5R5e 1.14.115, Argon 5.0.1+ and this adapter.
- As GM, select character, adversary and minion tokens; confirm the HUD opens and shows only their valid data.
- As a player, repeat with OWNER and non-OWNER NPCs; the latter must not expose exact or hidden data.
- Click every action in each conflict profile and compare the core action ID/type with `action-mapping.md`.
- Open and cancel a checked action; no action slot is consumed and its reservation disappears.
- Resolve the same checked action; exactly one core action slot is consumed.
- Use Calming Breath, Prepare Item and Predict; each must call the core immediate transaction path. Confirm Wait is not displayed.
- Launch Strike, change grip after rolling, and confirm resolution retains the original target and profile.
- Confirm an ordinary Attack technique does not gain Strike-only Opportunity unless it explicitly declares
  `action_id: strike` or the matching Opportunity rule key.
- Confirm the economy row projects primary action, Water extra action and remaining free movement from the core
  turn state. End Turn is visually separated and shown only for the active managed Combatant.
- Inspect the Combatant flags after actions; no `flags.enhancedcombathud-l5r5e.turnState` is recreated.
- Confirm the L5R panel is placed beside, not over, the portrait; all resource totals come from the actor, the
  current stance is highlighted, and active effects are focusable. Check 1920x1080, 2560x1440 and 1440x900.
- Verify the persistent weapon card shows grip, damage, deadliness, range and qualities. With no readied
  weapon it shows a legal unarmed profile; hover highlights the explicit range when Tactical Grid is active
  and clears the overlay on mouseleave.
- Switch Weapon Sets with legal and illegal hand totals. Core must commit a legal set atomically and reject an
  illegal set without leaving a partially changed loadout.
- Enable the improvised Throw Item house rule and hold an item: the action appears and launches its core
  reservation/check. Disable the rule or release every item: the action disappears.
- Confirm a thrown grip remains a Strike and Soaring Slice remains a technique; neither is duplicated by the
  Throw Item action.
- Outside combat, confirm the character panel, active equipment, weapon sets and the Skills/Techniques/Equipment
  palettes remain available while turn economy, End Turn and conflict basic actions are absent.
- Search each palette by a partial localized name, close it with Escape, and confirm focus returns to its button.
- Hover and keyboard-focus the weapon, armor, effects and action buttons. Tooltips must remain inside the viewport
  and explain disabled actions, including Water extra-action restrictions.
- Repeat the smoke test as GM and as two different owning players; hidden actor data must not leak between clients.
