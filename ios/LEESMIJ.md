# Blaadje voor iOS

Een volledige herbouw in Swift en SwiftUI. De webapp in `web/` is de
specificatie: dezelfde regels, ingericht zoals een iPhone-app hoort te werken.

```
BlaadjeKern/   de rekenkern: pure Swift, geen schermen, wel tests
Blaadje/       de app
```

## De rekenkern

Alles wat fout kán gaan zit hier: speeltijd terugrekenen uit de wissels,
keeperminuten, formaties, seizoenstotalen, het verslag, back-up en overzetcode.
Overgezet uit `web/src/lib/domain` en `web/src/lib/actions`, met de tests erbij.

```
cd BlaadjeKern && swift test
```

Een back-up of overzetcode van blaadje.app leest hij letterlijk in: dezelfde
veldnamen, dezelfde volgorde.

## De app

```
cd Blaadje
open Blaadje.xcodeproj     # en dan draaien in Xcode
./test.sh                  # alle tests, in de simulator
```

Het Xcode-project wordt gemaakt uit `project.yml` met `xcodegen`. Het staat ook
in git, dus openen kan zonder. Komt er een bestand bij, draai dan `xcodegen`.

- `Bron/Model/AppModel.swift` — wat de app onthoudt en wat een tik ermee doet.
  De regels zelf staan in de kern; hier staat het doorgeven en het bewaren.
- `Bron/Onderdelen/` — veld, bank, kleuren.
- `Bron/Schermen/` — één bestand per scherm.
- `Tests/` — bewaren, inlezen, en of het veld naast de bank past.
- `SchermTests/` — bedient de app zoals een trainer: team opzetten, en een hele
  wedstrijd van aftrap tot archief.

Alles staat op het toestel, in één bestand. Na elke tik wordt het bewaard. De
klok rekent vanaf het moment van starten, dus hij klopt ook als de app dicht was.

## Wat er nog niet in zit

Trainingen, het wisselplan, een bewaarde wedstrijd bijwerken, de klok op het
vergrendelscherm, en account met synchronisatie.
