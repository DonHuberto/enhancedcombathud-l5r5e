# Argon – Character HUD (L5R5E)

Adapter systemu **Legend of the Five Rings 5e** do modułu **Argon – Combat HUD** dla Foundry VTT 14.

## Wymagania

- Foundry VTT 14,
- L5R5e 1.14.101 lub nowszy,
- Argon – Combat HUD 5.0.1 lub nowszy.

## Instalacja lokalna

Umieść katalog `enhancedcombathud-l5r5e` w `Data/modules`, włącz Argon i ten adapter w świecie L5R5e, a następnie przeładuj świat. Gracz powinien mieć przypisaną postać typu `character`; przy włączonym trybie Argon `alwaysOn` HUD może być związany z tą postacią bez zaznaczania tokena.

## Zakres

Adapter udostępnia rozbudowany portret postaci, zasoby, pozycję, efekty, Ninjo/Giri, umiejętności, ekwipunek, techniki, zestawy broni oraz profile: Uniwersalny, Intryga, Pojedynek, Potyczka i Bitwa masowa. Akcje korzystają z publicznego Dice Pickera systemu L5R5e, a zmiany wyposażenia i zasobów zapisują się w dokumentach Foundry.

Profil aktywnego konfliktu jest kopiowany do walki przy jej rozpoczęciu. GM może go zmienić i skonfigurować tracker z poziomu portretu HUD-u. Ukryte TN Intrygi są rozstrzygane przez aktywnego GM i nie trafiają jawnie do flag walki.

## Testy

```powershell
npm test
```

Testy obejmują manifest, zgodność kluczy polskiej i angielskiej lokalizacji, ikony akcji oraz czystą logikę zasobów, ostrzeżeń, umiejętności, broni i stanu tury.

## Ręczna weryfikacja w Foundry VTT 14

1. **Universal:** zakończ aktywny Combat, przypisz użytkownikowi postać `character` i włącz `alwaysOn` w Argonie. Sprawdź zasoby, Honor/Glory/Status, Ninjō/Giri, efekty, zmianę pierścienia, Drawer umiejętności, Generic Roll, ekwipunek, techniki i trzy zestawy broni. Actor typu `npc` albo `army` powinien zostać odrzucony przez CORE.
2. **Intrigue:** przed rozpoczęciem walki wybierz w systemowym trackerze Initiative Encounter `intrigue`. Jako GM skonfiguruj Social Objective z przycisku portretu, zaznacz cele i wykonaj Persuade. Na koncie gracza sprawdź, że nieobserwowalna Czujność daje `?`, a Dice Picker otwiera się z ukrytym TN przez aktywnego GM. Po zakończonym udanym rzucie sprawdź Momentum.
3. **Duel:** wybierz `duel`, zaznacz przeciwnika i skonfiguruj warunki oraz dozwoloną broń. Obaj uczestnicy deklarują Staredown; wartości powinny ujawnić się dopiero po obu zobowiązaniach, a inicjatywa wrócić do bazowej po zmianie rundy. Sprawdź Center po zakończeniu Roll and Keep, Predict po zmianie postawy celu, Concede oraz wyróżniony Strike/Finishing Blow po Compromised albo Unmask przeciwnika.
4. **Skirmish:** wybierz `skirmish`. Sprawdź akcję, darmowy ruch, dodatkową akcję Wody bez testu, Prepare Item, Guard, Maneuver i Wait. Po zaznaczeniu celu tracker powinien pokazać pasmo zasięgu, zasięg przygotowanej broni i informację, czy broń obejmuje cel.
5. **Mass Battle:** przygotuj aktora `army` z `commander_actor_id`/`warlord_actor_id` oraz kohortę z `leader_actor_id` wskazującymi postać. Wybierz `mass_battle`, skonfiguruj armię, kohortę, pozycję i Strategic Objective, a następnie sprawdź Assault, Challenge, Rally i Reinforce oraz dane gotowości i fortyfikacji. HUD nadal musi być związany z postacią, nie z armią.

## Świadome ograniczenia

- Schemat techniki L5R5e 1.14.101 przechowuje strukturalnie tylko typ, pierścień, umiejętność i TN. Pozostałe reguły są zwykle w opisie; adapter pokazuje dodatkowe metadane, jeśli dokument je posiada, ale nie zgaduje activation, conflict type, kosztów ani Opportunity. Poza konfliktem automatycznie uruchamiane są tylko strukturalnie rozpoznawalne Rituals, a pozostałe techniki otwierają się informacyjnie.
- Clash, opcjonalne Duel Scoring oraz automatyczne rozstrzyganie Strategic Objectives i Attrition pozostają poza obecną automatyzacją. Trackery i systemowy Dice Picker są dostępne, lecz adapter nie wprowadza równoległego silnika zasad.
- Testy automatyczne nie uruchamiają klienta Foundry. Końcowy smoke test konsoli i interakcji wymaga świata Foundry VTT 14 z wymaganymi wersjami CORE i systemu.
