# Farore Scènebeelden

Desktopplugin voor deze Obsidian-vault. Selecteert tijdens een Farore- of LexVoice-opname om de tien minuten een recente scène en maakt met lokale diensten een Theros-illustratie, zijpaneel en Markdown-galerij.

Gebruiksinstructies: [Automatische scenebeelden](../../docs/session-recording/Automatische%20scenebeelden.md).

## Vereisten

- Obsidian 1.10.0 of nieuwer, desktop.
- Farore Sessieopname 1.0.0 via `getSceneSnapshot()`, of LexVoice 2.6.0 via `session`, transcriptfragmenten en `recorder.getInfo()`.
- Lokaal `llama3.1:8b` op `127.0.0.1:11434` voor scèneselectie.
- Lokaal `x/flux2-klein:4b` op de afzonderlijke beeldservice `127.0.0.1:11435`.

Deze plugin wijzigt LexVoice niet. Hij leest geen DM-voorbereiding of campagnelore en bedient Atlas VTT niet.

## Installatie en onderhoud

Kopieer `manifest.json`, `main.js`, `core.js` en `styles.css` naar `.obsidian/plugins/farore-scene-illustrator/`. Schakel de plugin in en herlaad hem of heropen de vault. Er is geen bundelstap of npm-installatie nodig; de desktopruntime levert Node en Obsidian.

De huidige installatie en lokale startconfiguratie zijn al klaargezet op deze Mac. Modelgewichten en servicebinaries staan buiten de vault. Bewaar een bestaande `data.json` bij het bijwerken van de geïnstalleerde pluginbestanden.

## Tests

```sh
node --test agents/plugins/farore-scene-illustrator/core.test.js agents/plugins/farore-scene-illustrator/main.test.js
```

Eén expliciete integratieproef met echte lokale modelgeneratie, zonder microfoonopname:

```sh
node agents/plugins/farore-scene-illustrator/smoke-local.js --generate
```

De integratieproef gebruikt een nagebootste Obsidian-vault in de tijdelijke map en genereert één echt beeld. Beide diensten moeten draaien. Dit verifieert de pipeline en opslag; het test niet de echte Obsidian-interface.
