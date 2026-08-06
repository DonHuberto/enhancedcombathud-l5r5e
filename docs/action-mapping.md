# Core action mapping

The HUD is a frontend for `game.l5r5e.actionRegistry`, `actions`, `turns`, `movement`, and `equipment`. It does not own a mechanical turn state.

| Action | Types | Check | Profiles | Core resolver |
|---|---|---:|---|---|
| Assist | Support | yes | Intrigue, Skirmish | Dice Picker / resolution |
| Calming Breath | Support | no | Intrigue, Duel, Skirmish | `actions.executeImmediate` |
| Guard | Support | yes | Skirmish | Dice Picker / resolution |
| Maneuver | Move | yes | Skirmish | Dice Picker and movement API |
| Prepare Item | Support | no | Duel, Skirmish | `actions.executeImmediate` / equipment mutation |
| Strike | Attack | yes | Duel, Skirmish | Dice Picker / resolution |
| Wait | Support | no | Skirmish | Hidden in the HUD by design; core registry entry remains untouched |
| Persuade | Scheme | yes | Intrigue | Dice Picker / authority request |
| Challenge | Scheme | yes | Skirmish, Mass Battle | Dice Picker / resolution |
| Center | Support | yes | Duel | Dice Picker / resolution |
| Predict | Scheme | no | Duel | `actions.executeImmediate` |
| Assault | Attack | yes | Mass Battle | Dice Picker / resolution |
| Rally / Reinforce | Support | yes | Mass Battle | Dice Picker / resolution |
| Custom action | selected in picker | yes | Intrigue, Duel, Skirmish | Dice Picker / resolution |
| Technique | item activation metadata | item-defined | contextual | Dice Picker / resolution |
| Throw Item | Attack | yes | Duel, Skirmish | optional improvised-throw house rule via the core equipment transaction API; RAW thrown grip remains Strike and Soaring Slice remains a technique |
| End Turn | none | no | active conflict | `Combat.nextTurn`; no slot |

Free Movement is deliberately absent from the action panel. Core records actual token movement against the canonical movement budget.
