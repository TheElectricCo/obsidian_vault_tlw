# Tales from Farore — het Farore-kompas

Een zelfstandige Obsidian-plugin voor het opnemen, lokaal transcriberen en samenvatten van The Last Wish-sessies, met optionele afbeeldingen via OpenAI. Je hoeft geen `.command` te openen en LexVoice is niet nodig voor nieuwe Farore-opnames.

**Installatiestatus (9 oktober 2026):** geïnstalleerd en ingeschakeld in deze vault. Het opnamepaneel en de instellingen zijn in Obsidian gecontroleerd; de lokale diensten zijn bereikbaar. Microfoonstart en geluidsmeter werken; het eerste echte audiofragment van één minuut is opgeslagen en getranscribeerd. Een synthetische Nederlandse opname is met echte Whisper en Ollama verwerkt tot transcript en conceptverslag; 58 automatische tests slagen. Een volledige sessie aan de speeltafel en langdurige opname moeten nog praktisch getest worden.

**Uitbreiding 1.1.0:** OpenAI-scènebeelden, een handmatige generatieknop en optionele automatische beelden zijn toegevoegd. De API-tests gebruiken nagebootste antwoorden; een echte OpenAI-generatie is nog niet uitgevoerd. Herlaad de plugin (uit- en inschakelen bij Community plugins) of heropen de vault na deze update, wanneer er geen opname loopt.

## Het Farore-kompas (1.2.0)

Geïnstalleerd in deze vault. Het logo, de gereedschapskist, de Atlas-opdrachtkiezer en het openen van het Atlas-dashboard zijn in Obsidian gecontroleerd, evenals de instellingenknop. Alle 62 automatische tests slagen.

**Farore Sessieopname** heet voortaan **Tales from Farore**. Dezelfde plugin bewaart je bestaande instellingen en opnames. Klik op het **kompas** in de linker werkbalk om het startscherm met het Farore-logo te openen.

| Tabblad | Wat je er vindt |
| --- | --- |
| **Overzicht** | Je sessiestatus, snelkoppelingen naar de tools en campagnenotities |
| **Opname** | Microfoon, opname, transcript, verslagen en eerdere sessies |
| **Beelden** | Afbeeldingen via OpenAI en je beeldgalerij |
| **Tools** | Lokale scènebeelden, verbonden plugins en lokale diensten |

**Open tool** toont de beschikbare opdrachten van een plugin. Kies zelf een opdracht om die uit te voeren. Uitgeschakelde plugins herken je aan hun status; **Plugin inschakelen** brengt je naar Community plugins. Nieuwe custom plugins met een ID dat begint met `farore-` verschijnen vanzelf. Gebruik **Ververs tools** als je net iets hebt ingeschakeld.

Via **De wereld van Farore** kies je een bestaande notitie bij sessies, personages, locaties, lore of huisregels. Als een map nog leeg is, krijg je een melding. Tabbladen wisselen onderbreekt geen opname en behoudt wat je hebt ingevuld.

## Een sessie opnemen

1. Controleer onder **Settings → Community plugins** dat **Tales from Farore** aan staat. Bij een eerste installatie kan heropenen van de vault nodig zijn; werk een lopende opname eerst af.
2. Open **Tales from Farore: Open sessieopname** in het opdrachtpalette, of klik op het kompas in de linker werkbalk en kies **Opname**.
3. Vul een sessienaam in en kies de tafelmicrofoon. Niet alle microfoonnamen zijn zichtbaar voordat macOS toestemming heeft verleend; ververs de lijst daarna indien nodig.
4. Klik **Start opname**. De plugin start standaard zelf Whisper, opent Ollama indien nodig en start de bestaande beeldservice. Geef Obsidian microfoontoegang als macOS daarom vraagt.
5. Controleer de geluidsmeter en voer eerst een korte test uit met iemand op elke zitplaats. Houd de Mac wakker tijdens de sessie.
6. Gebruik **Pauzeer** en **Hervat** voor een pauze. De tijdcodes tellen alleen opgenomen audio, geen pauzetijd.
7. Klik **Stop & verslag**. Wacht tot de laatste audio is opgeslagen, de wachtrij verwerkt is en het eindverslag klaar is. Een uitgevallen Ollama-dienst verhindert het bewaren van de audio en transcriptie niet.
8. Controleer het concept met de audio voordat je het overneemt in je echte sessienotities. **Stop diensten** maakt desgewenst Whisper- en beeldservicegeheugen vrij; Ollama blijft beschikbaar.

Transcriptie verschijnt standaard per **60 seconden**, plus verwerkingstijd. Tussentijdse conceptverslagen verschijnen standaard per **vijf minuten verwerkte spraak**. De scènebeeldenplugin kan dezelfde opname volgen, op haar bestaande interval van tien minuten.

Gebruik één recorder tegelijk. Farore voorkomt starten als LexVoice nog opneemt of gepauzeerd staat. De bestaande LexVoice-opnames blijven beschikbaar via LexVoice; zij worden niet automatisch naar Farore geïmporteerd.

## Een afbeelding genereren met OpenAI

1. Open **Settings → Tales from Farore → Afbeeldingen met OpenAI**.
2. Vul je **OpenAI API-key** in en klik **Bewaar key**. In de huidige Obsidian-versie wordt hij in de sleutelopslag bewaard, buiten de plugininstellingen en sessiebestanden. Met **Verwijder key** kun je hem wissen. Geef je key niet door in sessienotities.
3. Kies eventueel een beeldmodel, kwaliteit en formaat. Standaard wordt één liggend beeld gemaakt met GPT Image 1.5 en gemiddelde kwaliteit.
4. Open het tabblad **Beelden** en klik op **Genereer afbeelding**. Laat **Eigen scènebeschrijving** leeg om de laatste gespeelde scène uit het transcript te laten kiezen. Dit werkt ook bij een gepauzeerde of geopende eerdere sessie. Zonder bruikbare transcriptie kun je zelf een scènebeschrijving invullen; daarvoor is geen opname of lokale Ollama nodig.
5. Wacht tot het beeld in het paneel verschijnt. **Open beeldgalerij** opent de bewaarde beelden met hun prompts. Opname en transcriptie kunnen ondertussen doorgaan.

De stijl blijft schilderachtige Theros-fantasy, met oud-Griekse materialen en architectuur waar die bij de scène passen. Scèneselectie gebeurt lokaal en negeert spelersplannen, theorieën, regelsgesprekken en onbevestigde geheimen. Een beeld blijft een artistieke interpretatie die de DM moet controleren.

Voor automatische OpenAI-beelden kun je **Automatisch OpenAI-beelden maken** aanzetten en een interval kiezen. Dit staat standaard uit. Automatische generatie gebruikt alleen nieuwe recente transcriptie tijdens opname; pauzetijd telt niet mee. Schakel automatische beelden in de afzonderlijke plugin **Farore Scènebeelden** uit als je geen dubbele lokale en OpenAI-beelden wilt.

OpenAI ontvangt alleen de beeldprompt; audio en volledig transcript worden niet naar OpenAI gestuurd. Iedere generatie gebruikt betaald API-tegoed. Bij een ongeldige key, ontbrekende modeltoegang of bereikt tegoed toont de plugin een melding. De opname blijft bewaard. Er is geen automatische herhaling van een mislukte beeldgeneratie; probeer handmatig opnieuw zodra het probleem is opgelost.

## Waar staan de bestanden?

Standaard krijgt elke opname een eigen map onder **The Last Wish/Sessions/Opnames/Farore**:

| Bestand | Inhoud |
| --- | --- |
| `Audio/*.wav` | Afzonderlijk afspeelbare audiofragmenten, standaard één minuut |
| `Transcript.md` | Transcriptblokken met tijdcodes en links naar de bijbehorende audio |
| `Verslag-*.md` | Tussentijdse concepten en eindverslag; ieder concept is een nieuw bestand |
| `Beelden/*.png` | Met OpenAI gemaakte scènebeelden |
| `Beeldgalerij.md` | Galerij met beelden en de gebruikte prompts |
| `Etat.json` | Bewaarde voortgang, instellingen, prompt, audioverwijzingen en herkenbare tekst |

Een eigen beeld zonder geopende sessie wordt bewaard onder **The Last Wish/Sessions/Opnames/Farore/Losse scenebeelden** (of je aangepaste uitvoermap).

Je kunt een transcriptnotitie aanvullen; de plugin voegt nieuwe blokken toe. Verwijder de verborgen fragmentmarkers niet zolang de sessie nog verwerkt wordt. Eigen correcties in het transcript worden niet automatisch aan het AI-verslag meegegeven: het verslag gebruikt de herkenbare tekst uit de bewaarde sessievoortgang. Werk belangrijke inhoudelijke correcties daarom ook in je uiteindelijke, gecontroleerde verslag bij.

## Als de verwerking onderbroken is

Open het paneel, kies onder **Vorige sessies en herstel** een sessie en klik **Open sessie**. Start de lokale diensten indien nodig en klik **Probeer transcriptie opnieuw**. Daarna kun je met **Maak conceptverslag** een nieuw verslag maken. Het openen van een vorige sessie schakelt de microfoon niet in.

Als de schijf vol is of schrijven mislukt, kan nog niet bewaarde audio tijdelijk in het geheugen staan. Houd Obsidian dan open, herstel de opslag en gebruik **Probeer transcriptie opnieuw** voordat je hervat of stopt. Bij een crash of abrupt afsluiten kan het laatste onvoltooide fragment verloren gaan. Stop en wacht daarom altijd vóór het sluiten van Obsidian.

## Instellingen

Onder **Settings → Tales from Farore** kun je de uitvoermap, promptnotitie, taal, fragmentduur, verslaginterval, Ollama-model en lokale serviceadressen aanpassen. Opname- en verslaginstellingen gelden voor volgende opnames; bestaande sessies behouden hun instellingen en prompt. OpenAI-beeldinstellingen gelden meteen, ook bij een geopende eerdere sessie. Modellen en diensten moeten al lokaal geïnstalleerd zijn. Automatisch starten gebruikt de bestaande macOS LaunchAgents; andere systemen starten hun diensten handmatig.

[[Sessienotities-prompt]] wordt bij elke nieuwe opname gelezen en met de sessie bewaard. De verslagen volgen de D&D-instructies: huisregels uit Farore gaan voor de basisregels van 2014, theorieën blijven theorieën, plannen blijven plannen en er wordt geen spelersdialoog verzonnen. De plugin doet geen automatische sprekeridentificatie en neemt geen beslissingen over loot of rulings.

## Lokaal en synchronisatie

De plugin gebruikt Whisper en Ollama op `127.0.0.1` voor transcriptie, verslagen en scèneselectie. De optionele beeldgeneratie gebruikt de OpenAI Images API met je eigen key. Die key wordt niet met een sessie bewaard. Voor Obsidian ouder dan 1.11.4 blijft de key alleen in het geheugen tot de plugin sluit. Audio en verslagen staan wel in de vault. De bestaande opname-uitzondering in Git geldt ook voor Farore; Obsidian Sync heeft afzonderlijke instellingen. Sluit **The Last Wish/Sessions/Opnames** daar uit als je die bestanden niet wilt synchroniseren.

Broncode en onderhoud: [[agents/plugins/farore-session-recorder/README|Farore Sessieopname — ontwikkeling]].

API-integratie: [officiële OpenAI-documentatie](https://developers.openai.com/api/reference/resources/images/methods/generate).
