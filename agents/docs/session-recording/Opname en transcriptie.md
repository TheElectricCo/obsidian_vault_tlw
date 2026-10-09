# Opname, transcriptie en sessienotities

**Status:** lokaal geïnstalleerd, ingesteld en technisch getest. LexVoice wordt bij de volgende heropening van Obsidian geladen. Een echte microfoonopname en de volledige opnameflow in Obsidian zijn nog niet getest.

## Eerste gebruik

1. Sluit Obsidian en open de Farore Vault opnieuw. Controleer bij **Settings → Community plugins** dat **LexVoice** aan staat.
2. Dubbelklik in Finder op **Start lokale transcriptie.command** in dezelfde map als deze handleiding. De Whisper-service draait momenteel al; opnieuw starten mag. Zorg ook dat de Ollama-app draait.
3. Open het LexVoice-overzicht via het pictogram met een lijst/boomstructuur in de linker werkbalk. De opdrachtpalette bevat eveneens LexVoice-opdrachten.
4. Kies je tafelmicrofoon en controleer dat de prompt **D&D — The Last Wish** voor het verslag geselecteerd is. De bron staat op alleen de microfoon.
5. Start via het **LexVoice-microfoonpictogram**. De ingebouwde Audio recorder heeft ook een microfoonpictogram; gebruik voor transcriptie dat van LexVoice. Controleer de geluidsmeter en geef microfoontoegang als macOS daarom vraagt.
6. Test eerst kort met iemand op elke zitplaats. Transcript en live overzicht worden in stukken van **één minuut** verwerkt, gevolgd door de verwerkingstijd. Dit is tussentijdse transcriptie, geen onmiddellijke woord-voor-woordondertiteling.
7. Stop via LexVoice en wacht tot transcriptie en het eindverslag klaar zijn voordat je Obsidian of de lokale diensten sluit.
8. Dubbelklik daarna eventueel op **Stop lokale transcriptie.command** om Whisper-geheugen vrij te maken. Ollama blijft beschikbaar.

Whisper start op verzoek en wordt niet automatisch bij elke login gestart.

## Resultaten en D&D-instructies

De bestanden verschijnen in **The Last Wish/Sessions/Opnames**:

- **Audio:** originele opnames.
- **Verslagen:** notities met bewaarde transcriptie, benoemd met datum en tijd.
- **Materialen:** eventueel aangeleverde sessiematerialen.
- **Diagnostiek:** lokale diagnostiek van de plugin.

Transcript en verslag staan standaard samen in een sessienotitie. Controleer het concept voordat je het overneemt in de eigenlijke sessiemap.

[[Sessienotities-prompt]] is in de plugin geladen en vraagt om gebeurtenissen, keuzes, NPC's, locaties, gevechtsmiddelen, loot en open verhaallijnen. Hij scheidt feiten van plannen en spelerstheorieën, markeert onzekerheden en verzint geen spelersdialoog. Er is spellinghulp ingesteld voor de campagne- en personagenamen.

Automatische sprekeridentificatie staat uit: een gedeelde tafelmicrofoon koppelt stemmen niet betrouwbaar aan personages. Automatische topicpagina's, dagelijkse samenvattingen en het aanmaken van kennis- of persoonsnotities zijn eveneens uitgeschakeld.

Een wijziging aan het promptbestand past de opgeslagen pluginprompt niet automatisch aan; werk dan ook de prompt in LexVoice bij.

## Lokale diensten

| Onderdeel | Ingesteld |
| --- | --- |
| Obsidian-plugin | LexVoice 2.6.0, officiële release; SHA-256 gecontroleerd |
| Transcriptie | whisper.cpp 1.9.4 met GPU-versnelling |
| Whisper-model | multilingual large-v3-turbo, q5_0; Nederlands (`nl`) |
| Transcriptieadres | `http://127.0.0.1:8178/v1/audio/transcriptions` |
| Sessienotities | bestaand lokaal Ollama-model `llama3.1:8b` |
| Taalmodeladres | `http://127.0.0.1:11434/v1` |
| Update-interval | 60 seconden |
| Uitvoertaal | Nederlands |

De AI-verwerking heeft geen externe AI-dienst, API-sleutel of betaald AI-abonnement nodig. Whisper luistert uitsluitend op `127.0.0.1`.

Het model, tijdelijke conversies en het serverlog staan buiten de vault, in `~/Library/Application Support/Farore Session Recorder/`. Het log heet `whisper.log`. De startconfiguratie staat in `~/Library/LaunchAgents/net.farore.whisper.plist`; plugininstellingen staan in `.obsidian/plugins/lexvoice/data.json`.

De map **Opnames** en de LexVoice-pluginmap zijn uitgesloten van Git. Je bestaande Obsidian Sync-instellingen zijn niet gewijzigd: als je ook wilt voorkomen dat deze bestanden via Obsidian Sync synchroniseren, sluit **The Last Wish/Sessions/Opnames** daar uit. Lokale AI-verwerking en vaultsynchronisatie zijn afzonderlijke functies.

## Uitgevoerde controles

- Een synthetisch Nederlands testbestand is correct getranscribeerd: tien goudstukken, Darius' sleutel, een onbevestigde verdenking en het plan om Akros te bezoeken.
- WAV en WebM/Opus werden geaccepteerd. WebM werd met ffmpeg omgezet voor verwerking.
- De server geeft CORS-headers terug voor aanroepen vanuit Obsidian.
- Ollama maakte Nederlandse notities in ongeveer zes seconden bij deze korte proef; de verdenking tegen de koning bleef onbevestigd.
- De scripts zijn op shellsyntax gecontroleerd. Startscript en beide lokale diensten zijn getest.
- Git negeert de nieuwe opname-, verslag- en plugininstellingenbestanden.

**Nog te testen:** microfoontoegang, geluidskwaliteit op alle zitplaatsen, live updates en stoppen met verslagvorming binnen Obsidian, en een lange sessie. De korte technische proef meet niet de kwaliteit van een groep die door elkaar praat.

De plugin kon in deze beurt niet via de Obsidian-interface worden geladen: de vensterbediening werkte niet betrouwbaar. De officiële CLI meldde dat CLI-toegang niet is ingeschakeld. Eenmalig heropenen van Obsidian is daarom de resterende laadstap.

## Als iets niet werkt

- **Geen LexVoice-knoppen:** heropen de vault en controleer of de plugin aan staat.
- **Geen transcriptie:** voer het startscript uit; controleer microfoontoegang, geluidsmeter en serverlog.
- **Wel transcriptie, geen overzicht:** controleer of Ollama draait en `llama3.1:8b` nog geïnstalleerd is.
- **Onjuiste namen of gebeurtenissen:** corrigeer het concept met de opname als bron.
- **Slecht verstaanbare spelers:** verplaats de microfoon en test met iedereen op de normale zitplaats.

## Bronnen

- [LexVoice-documentatie en officiële releases](https://github.com/Lynn-x/LexVoice)
- [whisper.cpp-server](https://github.com/ggml-org/whisper.cpp/tree/master/examples/server)
- [Ollama voor lokale Chat Completions](https://docs.ollama.com/api/openai-compatibility)
- [Obsidian CLI](https://help.obsidian.md/cli)

Ingericht en technisch gecontroleerd op 9 oktober 2026.
