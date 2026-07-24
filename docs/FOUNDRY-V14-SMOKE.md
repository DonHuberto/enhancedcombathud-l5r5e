# Foundry VTT 14 smoke checklist

- Install L5R5e 1.14.109, Argon and this adapter from its stable manifest.
- As GM, select character, adversary and minion tokens; confirm the HUD opens and shows only their valid data.
- As a player, repeat with OWNER and non-OWNER NPCs; the latter must not expose exact or hidden data.
- Click every action in each conflict profile and compare the core action ID/type with `action-mapping.md`.
- Open and cancel a checked action; no action slot is consumed and its reservation disappears.
- Resolve the same checked action; exactly one core action slot is consumed.
- Use Calming Breath, Prepare Item, Wait and Predict; each must call the core immediate transaction path.
- Launch Strike, change grip after rolling, and confirm resolution retains the original target and profile.
- Confirm an ordinary Attack technique does not gain Strike-only Opportunity unless it explicitly declares
  `action_id: strike` or the matching Opportunity rule key.
- Confirm Free Movement is absent, Wait remains an action, and End Turn is last and shown only for the active
  managed Combatant.
- Inspect the Combatant flags after actions; no `flags.enhancedcombathud-l5r5e.turnState` is recreated.
- Confirm the L5R panel is placed beside, not over, the portrait; primary resources use full-width meters and
  action icons form two compact rows at both ordinary and short viewport heights.
- Verify the persistent weapon card shows grip, damage, deadliness, range and qualities. With no readied
  weapon it shows a legal unarmed profile; hover highlights the explicit range when Tactical Grid is active
  and clears the overlay on mouseleave.
- Switch Weapon Sets with legal and illegal hand totals. Core must commit a legal set atomically and reject an
  illegal set without leaving a partially changed loadout.
- Enable the improvised Throw Item house rule and hold an item: the action appears and launches its core
  reservation/check. Disable the rule or release every item: the action disappears.
- Confirm a thrown grip remains a Strike and Soaring Slice remains a technique; neither is duplicated by the
  Throw Item action.
