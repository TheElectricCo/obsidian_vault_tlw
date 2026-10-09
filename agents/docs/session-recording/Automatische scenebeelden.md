# Automatische scènebeelden voor Theros

**Status:** uitbreiding geïnstalleerd en technisch getest met echte lokale beeldgeneratie. **Heropen Obsidian eenmalig** om de nieuwe plugin **Farore Scènebeelden** te laden. De echte opnameflow en het beeldpaneel binnen Obsidian moeten nog tijdens een proefopname worden gecontroleerd.

## Gebruik

1. Heropen Obsidian en controleer bij **Settings → Community plugins** dat **Farore Scènebeelden** ingeschakeld is.
2. Start zoals gewoonlijk **Start lokale transcriptie.command**. Dit start nu ook de afzonderlijke lokale beeldservice. Ollama blijft nodig voor de transcriptiesamenvatting en de keuze van de scène.
3. Start je opname met LexVoice. Na **tien minuten opnametijd** kiest de uitbreiding een scène uit de **laatste vijf minuten transcriptie**. Daarna volgt een nieuw beeld bij twintig, dertig minuten, enzovoort, plus verwerkingstijd.
4. Het nieuwe beeld verschijnt in **Theros — scènebeelden**, een zijpaneel in Obsidian. Via het afbeeldingspictogram kun je dit paneel zelf openen.
5. De opdracht **Farore Scènebeelden: Genereer de huidige scène** maakt tussendoor een beeld zodra er voldoende recente transcriptie beschikbaar is.
6. Pauzes en gestopte opnames leveren geen automatische beelden op. Stop de opname en wacht op je sessieverslag voordat je de diensten sluit. Het stopscript stopt nu ook de beeldservice.

Het interval is instelbaar bij **Settings → Farore Scènebeelden**, met tien minuten als standaard. De automatische beelden kunnen daar ook worden uitgeschakeld.

## Wat bepaalt het beeld?

De uitbreiding leest de recente, succesvol getranscribeerde fragmenten uit de lopende LexVoice-opname. Een lokaal taalmodel beschrijft één concrete scène, waarbij de laatste gespeelde gebeurtenissen voorrang krijgen.

De beeldselectie krijgt instructies om regelbesprekingen, pauzes, plannen en spelerstheorieën niet als gespeelde gebeurtenissen af te beelden. Bij onvoldoende recente tekst of zonder concrete visuele scène wordt het beeld overgeslagen. Er worden geen geheime DM-notities, toekomstige encounters of andere campagnedocumenten als bron gelezen.

De vaste stijl is schilderachtige mythologische fantasy voor Theros: de architectuur en materialen van het oude Griekenland, passende mediterrane landschappen, brons, verweerde steen en dramatisch licht. Een Nyx-hemel wordt alleen aan de prompt toegevoegd als de geselecteerde scène Nyx expliciet noemt. Bij een vermelde ochtend- of dagsituatie wordt een natuurlijke daghemel gevraagd.

Bij ontbrekende personagebeschrijvingen vraagt de prompt om afstand, silhouetten of een omgevingsbeeld. De uitbreiding garandeert geen herkenbare, identieke personagegezichten tussen beelden. Beelden zijn **artistieke interpretaties**, geen nieuwe canon of bewijs van een gebeurtenis. Er wordt geen spelersdialoog geschreven.

## Galerij en opslag

```text
The Last Wish/Sessions/Opnames/Scenebeelden/<opname-id>/
  Galerij.md
  <datum-en-tijd>.png
  <datum-en-tijd>.json
```

De galerij linkt naar de bijbehorende sessienotitie en verzamelt de beelden met hun opnametijd. Het JSON-bestand bewaart de gebruikte prompt, modellen en transcriptdekking. Deze map valt onder de bestaande Git-uitsluiting voor opnames. Bestaande Obsidian Sync-instellingen gelden afzonderlijk.

Beelden worden in je eigen Obsidian-paneel weergegeven. Ze worden niet automatisch naar Atlas VTT of een spelersscherm gestuurd.

## Voorbeeld

Dit is een **technische proef**, geen verslag van een gespeelde scène of vastgelegde personage-uiterlijkheden:

![[Voorbeeld-scene-v2.png]]

De proeftranscriptie beschreef reizigers op de brug van Phanarax, een diepe bergkloof, ochtendlicht, bronzen leuningen en mist. De uiteindelijke beeldprompt staat in `Voorbeeld-scene-v2.json`. De tweede proef, van scènekeuze tot opgeslagen beeld en galerij, duurde ongeveer acht seconden op deze Mac. Een eerste proef met modelopstart duurde ongeveer veertien seconden. Dit zijn korte proeven, geen garantie voor iedere sessie.

## Lokale techniek en onderhoud

De beeldservice gebruikt het reeds geïnstalleerde model **x/flux2-klein:4b** met beelden van **1024 × 576** pixels. Het scèneselectiemodel is het bestaande **llama3.1:8b**. Er wordt geen externe AI-dienst aangeroepen.

De gewone Ollama-installatie blijft op `127.0.0.1:11434`. De huidige versie 0.34.0 weigert beeldgeneratie. Daarom draait een afzonderlijke, officieel gedownloade en met SHA-256 gecontroleerde **Ollama 0.32.5** op `127.0.0.1:11435`, alleen voor FLUX. De bestaande installatie is niet vervangen of teruggezet. De beeldservice heeft een eigen modelmap met verwijzingen naar de bestaande FLUX-gewichten en staat op lokale verwerking.

```text
~/Library/Application Support/Farore Scene Illustrator/
  bin/
  models/
  service.log
```

De startconfiguratie staat in `~/Library/LaunchAgents/net.farore.scene-images.plist`. De service start op verzoek, niet automatisch bij login. **Start lokale afbeeldingen.command** en **Stop lokale afbeeldingen.command** kunnen ook afzonderlijk worden gebruikt.

De onderhouden broncode staat in `agents/plugins/farore-scene-illustrator/`. De geïnstalleerde kopie staat in `.obsidian/plugins/farore-scene-illustrator/` en is uitgesloten van Git. De uitbreiding leest interne sessievelden van **LexVoice 2.6.0**; bij een latere LexVoice-update moet deze koppeling opnieuw gecontroleerd worden.

Bij een mislukte beeldgeneratie blijft de transcriptie ongemoeid. De uitbreiding meldt het probleem en probeert een automatisch beeld ten vroegste na één minuut opnieuw. Er draait maximaal één beeldtaak tegelijk. Modelgeneratie gebruikt wel CPU/GPU en geheugen op dezelfde Mac; de snelheid tijdens een lange opname moet nog worden beoordeeld.

## Verificatie

- Zeventien tests controleren timing, pauzes, gestopte opnames, transcriptdekking, fouten, dubbele beelden, handmatige generatie, promptkeuze, lokale adressen en opslag.
- De volledige lokale pipeline is met echte diensten uitgevoerd: transcriptfragment → scènebeschrijving → PNG → bronmetadata → Markdown-galerij.
- Beeldformaat, galerijverwijzing en het voorkomen van een dubbel automatisch beeld zijn gecontroleerd.
- Het uiteindelijke voorbeeld is visueel bekeken en de daghemel is na een promptaanpassing opnieuw gecontroleerd.
- De start- en stopscripts zijn op shellsyntax gecontroleerd; de beeldservice draait en reageert lokaal.
- **Nog niet geverifieerd:** het echte Obsidian-zijpaneel, een daadwerkelijke sessie van tien minuten en de belasting bij langdurig gelijktijdig transcriberen.

## Bronnen

- [Ollama 0.32.5 — officiële release](https://github.com/ollama/ollama/releases/tag/v0.32.5)
- [Ollama 0.34.0 — weigering van beeldgeneratie in de server](https://github.com/ollama/ollama/blob/v0.34.0/server/routes.go)
- [Beeldvelden in de Ollama 0.32.5-API](https://github.com/ollama/ollama/blob/v0.32.5/api/types.go)
- [FLUX.2 Klein](https://ollama.com/x/flux2-klein)

Ingericht en technisch gecontroleerd op 9 oktober 2026.
