# Farore Sessieopname

Een zelfstandige Obsidian-plugin voor het opnemen, lokaal transcriberen en samenvatten van The Last Wish-sessies. Je hoeft geen `.command` te openen en LexVoice is niet nodig voor nieuwe Farore-opnames.

**Installatiestatus (9 oktober 2026):** geïnstalleerd en ingeschakeld in deze vault. Het opnamepaneel en de instellingen zijn in Obsidian gecontroleerd; de lokale diensten zijn bereikbaar. Microfoonstart en geluidsmeter werken; het eerste echte audiofragment van één minuut is opgeslagen en getranscribeerd. Een synthetische Nederlandse opname is met echte Whisper en Ollama verwerkt tot transcript en conceptverslag; 44 automatische tests slagen. Een volledige sessie aan de speeltafel en langdurige opname moeten nog praktisch getest worden.

## Een sessie opnemen

1. Controleer onder **Settings → Community plugins** dat **Farore Sessieopname** aan staat. Bij een eerste installatie kan heropenen van de vault nodig zijn; werk een lopende opname eerst af.
2. Open **Farore Sessieopname: Open sessieopname** in het opdrachtpalette of gebruik het pictogram met audiolijnen in de linker werkbalk.
3. Vul een sessienaam in en kies de tafelmicrofoon. Niet alle microfoonnamen zijn zichtbaar voordat macOS toestemming heeft verleend; ververs de lijst daarna indien nodig.
4. Klik **Start opname**. De plugin start standaard zelf Whisper, opent Ollama indien nodig en start de bestaande beeldservice. Geef Obsidian microfoontoegang als macOS daarom vraagt.
5. Controleer de geluidsmeter en voer eerst een korte test uit met iemand op elke zitplaats. Houd de Mac wakker tijdens de sessie.
6. Gebruik **Pauzeer** en **Hervat** voor een pauze. De tijdcodes tellen alleen opgenomen audio, geen pauzetijd.
7. Klik **Stop en maak verslag**. Wacht tot de laatste audio is opgeslagen, de wachtrij verwerkt is en het eindverslag klaar is. Een uitgevallen Ollama-dienst verhindert het bewaren van de audio en transcriptie niet.
8. Controleer het concept met de audio voordat je het overneemt in je echte sessienotities. **Stop diensten** maakt desgewenst Whisper- en beeldservicegeheugen vrij; Ollama blijft beschikbaar.

Transcriptie verschijnt standaard per **60 seconden**, plus verwerkingstijd. Tussentijdse conceptverslagen verschijnen standaard per **vijf minuten verwerkte spraak**. De scènebeeldenplugin kan dezelfde opname volgen, op haar bestaande interval van tien minuten.

Gebruik één recorder tegelijk. Farore voorkomt starten als LexVoice nog opneemt of gepauzeerd staat. De bestaande LexVoice-opnames blijven beschikbaar via LexVoice; zij worden niet automatisch naar Farore geïmporteerd.

## Waar staan de bestanden?

Standaard krijgt elke opname een eigen map onder **The Last Wish/Sessions/Opnames/Farore**:

| Bestand | Inhoud |
| --- | --- |
| `Audio/*.wav` | Afzonderlijk afspeelbare audiofragmenten, standaard één minuut |
| `Transcript.md` | Transcriptblokken met tijdcodes en links naar de bijbehorende audio |
| `Verslag-*.md` | Tussentijdse concepten en eindverslag; ieder concept is een nieuw bestand |
| `Etat.json` | Bewaarde voortgang, instellingen, prompt, audioverwijzingen en herkenbare tekst |

Je kunt een transcriptnotitie aanvullen; de plugin voegt nieuwe blokken toe. Verwijder de verborgen fragmentmarkers niet zolang de sessie nog verwerkt wordt. Eigen correcties in het transcript worden niet automatisch aan het AI-verslag meegegeven: het verslag gebruikt de herkenbare tekst uit de bewaarde sessievoortgang. Werk belangrijke inhoudelijke correcties daarom ook in je uiteindelijke, gecontroleerde verslag bij.

## Als de verwerking onderbroken is

Open het paneel, kies onder **Vorige sessies en herstel** een sessie en klik **Open sessie**. Start de lokale diensten indien nodig en klik **Probeer transcriptie opnieuw**. Daarna kun je met **Maak conceptverslag** een nieuw verslag maken. Het openen van een vorige sessie schakelt de microfoon niet in.

Als de schijf vol is of schrijven mislukt, kan nog niet bewaarde audio tijdelijk in het geheugen staan. Houd Obsidian dan open, herstel de opslag en gebruik **Probeer transcriptie opnieuw** voordat je hervat of stopt. Bij een crash of abrupt afsluiten kan het laatste onvoltooide fragment verloren gaan. Stop en wacht daarom altijd vóór het sluiten van Obsidian.

## Instellingen

Onder **Settings → Farore Sessieopname** kun je de uitvoermap, promptnotitie, taal, fragmentduur, verslaginterval, Ollama-model en lokale serviceadressen aanpassen. Instellingen gelden voor volgende opnames; bestaande sessies behouden hun instellingen en prompt. Modellen en diensten moeten al lokaal geïnstalleerd zijn. Automatisch starten gebruikt de bestaande macOS LaunchAgents; andere systemen starten hun diensten handmatig.

[[Sessienotities-prompt]] wordt bij elke nieuwe opname gelezen en met de sessie bewaard. De verslagen volgen de D&D-instructies: huisregels uit Farore gaan voor de basisregels van 2014, theorieën blijven theorieën, plannen blijven plannen en er wordt geen spelersdialoog verzonnen. De plugin doet geen automatische sprekeridentificatie en neemt geen beslissingen over loot of rulings.

## Lokaal en synchronisatie

De plugin gebruikt Whisper en Ollama op `127.0.0.1`. Er is geen externe AI-dienst of API-sleutel. Audio en verslagen staan wel in de vault. De bestaande opname-uitzondering in Git geldt ook voor Farore; Obsidian Sync heeft afzonderlijke instellingen. Sluit **The Last Wish/Sessions/Opnames** daar uit als je die bestanden niet wilt synchroniseren.

Broncode en onderhoud: [[agents/plugins/farore-session-recorder/README|Farore Sessieopname — ontwikkeling]].
