# Argon – Character HUD (L5R5E)

Adapter systemu **Legend of the Five Rings 5e** do modułu **Argon – Combat HUD** dla Foundry VTT 14.

## Wymagania

- Foundry VTT 14,
- L5R5e 1.14.115 lub nowszy,
- Argon – Combat HUD 5.0.1 lub nowszy.

## Instalacja lokalna

Umieść katalog `enhancedcombathud-l5r5e` w `Data/modules`, włącz Argon i ten adapter w świecie L5R5e, a następnie przeładuj świat. HUD obsługuje aktorów `character` i `npc`, jeśli użytkownik jest MG lub ma uprawnienie OWNER; `army` pozostaje poza zakresem.

## Zakres

Adapter udostępnia rozbudowany portret postaci, zasoby, postawę, aktywne efekty, Ninjo/Giri, umiejętności, ekwipunek, techniki, zestawy broni oraz profile: Uniwersalny, Intryga, Pojedynek, Potyczka i Bitwa masowa. Akcje są pobierane z publicznego `game.l5r5e.actionRegistry`, a rzuty korzystają z publicznego Dice Pickera systemu. Przygotowanie, zmiana chwytu, upuszczanie i rzucanie przedmiotów przechodzą przez transakcyjne API core, łącznie z walidacją zajętych rąk i anulowaniem bez zużycia akcji.

HUD ma układ inspirowany interfejsem cRPG: duży portret i panel dynamicznych zasobów tworzą górny rząd wraz z pełnymi kwadratowymi kartami aktywnej broni i założonego pancerza. Trzy szybkie zestawy I–III znajdują się bezpośrednio nad kartami wyposażenia, a osobny dolny pas mieści palety, ekonomię tury, dwurzędowe grupy akcji i odseparowane zakończenie tury. Nad centrum znajdują się pierścienie z bieżącymi wartościami i wyróżnioną postawą. Hover lub fokus broni i pancerza otwiera pełną kartę informacyjną; hover broni przekazuje jawny zasięg do publicznego API Tactical Grid, jeśli moduł jest aktywny.

Umiejętności, Techniki i Ekwipunek są trzema osobnymi, przeszukiwalnymi paletami. Poza konfliktem HUD zachowuje panel postaci i palety, ale nie pokazuje ekonomii tury ani konfliktowych akcji podstawowych. W konflikcie akcje są rozdzielane według metadanych core na „Wymaga rzutu” i „Bez rzutu”. Pasek ekonomii pokazuje zwykłą akcję, dodatkową akcję Wody oraz pozostały darmowy ruch. `Wait` jest celowo ukryte, `Throw Item` pozostaje dostępne zgodnie z ustawieniem reguły domowej core, a `End Turn` jest oddzielone od pozostałych akcji.

`Throw Item` jest opcjonalną regułą domową core i pojawia się tylko po jej włączeniu oraz gdy postać trzyma legalny przedmiot. Chwyt `thrown` nadal wykonuje zwykły Strike, a Soaring Slice pozostaje techniką — HUD nie łączy tych trzech mechanik.

Profil aktywnego konfliktu jest kopiowany do walki przy jej rozpoczęciu. GM może go zmienić i skonfigurować tracker z poziomu portretu HUD-u. Ukryte TN Intrygi są rozstrzygane przez aktywnego GM i nie trafiają jawnie do flag walki.

## Testy

```powershell
npm test
```

Testy obejmują manifest, zgodność kluczy polskiej i angielskiej lokalizacji, ikony akcji, pobieranie akcji z rejestru core, podział według `requiresCheck`, ekonomię tury oraz czystą logikę zasobów, ostrzeżeń, umiejętności, aktywnej broni/chwytu i wyposażenia.

## Ręczna weryfikacja w Foundry VTT 14

1. **Universal:** zakończ aktywny Combat, przypisz użytkownikowi postać `character` lub zaznacz jako MG token `npc`. Sprawdź dynamiczne zasoby, efekty, zmianę pierścienia, aktywną broń/chwyt, pancerz, zestawy I–III i trzy przeszukiwalne palety. Nie powinny być widoczne ekonomia tury, `End Turn` ani konfliktowe akcje podstawowe. Actor typu `army` powinien zostać odrzucony.
2. **Intrigue:** przed rozpoczęciem walki wybierz w systemowym trackerze Initiative Encounter `intrigue`. Jako GM skonfiguruj Social Objective z przycisku portretu, zaznacz cele i wykonaj Persuade. Na koncie gracza sprawdź, że nieobserwowalna Czujność daje `?`, a Dice Picker otwiera się z ukrytym TN przez aktywnego GM. Po zakończonym udanym rzucie sprawdź Momentum.
3. **Duel:** wybierz `duel`, zaznacz przeciwnika i skonfiguruj warunki oraz dozwoloną broń. Obaj uczestnicy deklarują Staredown; wartości powinny ujawnić się dopiero po obu zobowiązaniach, a inicjatywa wrócić do bazowej po zmianie rundy. Sprawdź Center po zakończeniu Roll and Keep, Predict po zmianie postawy celu, Concede oraz wyróżniony Strike/Finishing Blow po Compromised albo Unmask przeciwnika.
4. **Skirmish:** wybierz `skirmish`. Sprawdź zwykłą akcję, darmowy ruch, dodatkową akcję Wody bez testu, Prepare Item, Guard i Maneuver; `Wait` nie powinno być widoczne. Po wydaniu zwykłej akcji sprawdź komunikaty blokady akcji Wody wymagającej testu albo współdzielącej już wykorzystany typ akcji. Sprawdź wybór zwolnienia zajętych rąk oraz Cancel bez mutacji. Włącz regułę domową Throw Item, rzuć trzymanym przedmiotem i zweryfikuj deterministyczny ground item po rozstrzygnięciu rzutu. Po zaznaczeniu celu tracker powinien pokazać pasmo zasięgu, zasięg przygotowanej broni i informację, czy broń obejmuje cel.
5. **Mass Battle:** przygotuj aktora `army` z `commander_actor_id`/`warlord_actor_id` oraz kohortę z `leader_actor_id` wskazującymi postać. Wybierz `mass_battle`, skonfiguruj armię, kohortę, pozycję i Strategic Objective, a następnie sprawdź Assault, Challenge, Rally i Reinforce oraz dane gotowości i fortyfikacji. HUD nadal musi być związany z postacią, nie z armią.

## Świadome ograniczenia

- Schemat techniki L5R5e 1.14.101 przechowuje strukturalnie tylko typ, pierścień, umiejętność i TN. Pozostałe reguły są zwykle w opisie; adapter pokazuje dodatkowe metadane, jeśli dokument je posiada, ale nie zgaduje activation, conflict type, kosztów ani Opportunity. Poza konfliktem automatycznie uruchamiane są tylko strukturalnie rozpoznawalne Rituals, a pozostałe techniki otwierają się informacyjnie.
- Clash, opcjonalne Duel Scoring oraz automatyczne rozstrzyganie Strategic Objectives i Attrition pozostają poza obecną automatyzacją. Trackery i systemowy Dice Picker są dostępne, lecz adapter nie wprowadza równoległego silnika zasad.
- Testy automatyczne nie uruchamiają klienta Foundry. Końcowy smoke test konsoli i interakcji wymaga świata Foundry VTT 14 z wymaganymi wersjami CORE i systemu.
