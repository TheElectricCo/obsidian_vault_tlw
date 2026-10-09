# Farore Sessieopname

Zelfstandige Obsidian-desktopplugin voor lokale D&D-sessieopname met Whisper en Ollama. Gebouwd voor deze vault, met een Nederlands opnamepaneel, microfoonkeuze, geluidsmeter, pauzeren/hervatten, live transcriptie, tussentijdse concepten en een eindverslag. LexVoice is niet nodig.

Gebruikershandleiding: [Farore Sessieopname](../../docs/session-recording/Farore%20Sessieopname.md).

## Vereisten

- Obsidian desktop 1.10.0 of nieuwer; geen mobiele ondersteuning.
- Lokale Whisper-server op `http://127.0.0.1:8178`, met `/health` en `/v1/audio/transcriptions`.
- Lokale Ollama op `http://127.0.0.1:11434`, met geïnstalleerd `llama3.1:8b` voor verslagen.
- De bestaande macOS LaunchAgent `net.farore.whisper` voor automatisch starten. De modellen en server worden niet door deze plugin geïnstalleerd.
- Optioneel `net.farore.scene-images` en Farore Scènebeelden. Deze bestaande plugin leest ook de nieuwe `getSceneSnapshot()`-interface; LexVoice blijft als terugval ondersteund.

Andere desktops kunnen opnemen en de lokale HTTP-diensten gebruiken, maar automatisch diensten starten/stoppen is specifiek voor de huidige Mac. Alleen HTTP op `127.0.0.1` wordt geaccepteerd; geen externe AI-endpoints of cloudmodellen.

## Bouwen en installeren

Geen npm-installatie nodig. De bouw bundelt alle interne modules tot één Obsidian `main.js`; Node en Obsidian blijven runtimeafhankelijkheden.

```sh
node agents/plugins/farore-session-recorder/build.js
node agents/plugins/farore-session-recorder/install.js
```

De distributie bevat `manifest.json`, `main.js` en `styles.css` in `dist/`. Het installatiescript kopieert die naar `.obsidian/plugins/farore-session-recorder/` en voegt het plugin-ID aan de bestaande lijst toe. Het behoudt alle andere plugins en een bestaande `data.json`. Laad de nieuwe plugin via Community plugins of heropen de vault nadat een lopende opname afgewerkt is.

## Opslag en herstel

- AudioWorklet verwerkt mono PCM zonder de microfoon tussen fragmenten te stoppen. Standaard 16 kHz, 16-bit WAV, één minuut per bestand. Als de runtime een andere samplerate gebruikt, bevat de WAV-header die echte rate.
- De audio wordt opgeslagen voordat een netwerkverzoek start. De transcriptiewachtrij verwerkt één fragment tegelijk; mislukte fragmenten blijven beschikbaar voor handmatig herstel.
- `Etat.json` bewaart sessieconfiguratie, prompt, audioverwijzingen, tijdcodes, transcript en voortgang. Bij herladen wordt een nog lopende opname als onderbroken gemarkeerd; herstel start alleen op verzoek en activeert de microfoon niet.
- Transcriptblokken krijgen unieke markers en worden via `vault.process` één keer toegevoegd. Bestaande aanvullingen blijven staan. Verslagen gebruiken nieuwe bestandsnamen zodat oudere versies en eigen correcties behouden blijven.
- Lange transcripties worden volledig in delen verwerkt en samengevoegd. Dit is een AI-samenvatting; de bron blijft het transcript. Onverwerkte fragmenten worden in de transcriptdekking vermeld.
- Bij opslagfouten pauzeert de plugin en bewaart niet-opgeslagen audio tijdelijk in geheugen. Herstel de opslag en gebruik de herstelknop voordat je Obsidian sluit.
- Normaal stoppen bewaart de resterende audio. Bij abrupt afsluiten kunnen audio in geheugen, de laatste onvoltooide minuut en lopende writes verloren gaan. Obsidian wacht niet op asynchrone plugin-unload; de laatste write bij unload is daarom een poging, geen garantie.

De prompt wordt bij aanvang uit de bestaande promptnotitie gelezen. De kerninstructies verbieden verzonnen spelersdialoog, onderscheiden theorieën en plannen van feiten en geven Farore-huisregels voorrang op de 2014-basisregels. De plugin leest geen andere lore, bronboeken of huisregelbestanden automatisch en voert geen spelrulings uit.

## Testen

```sh
node --test agents/plugins/farore-session-recorder/*.test.js agents/plugins/farore-scene-illustrator/*.test.js
node agents/plugins/farore-session-recorder/smoke-local.js --run
```

De tests behandelen PCM/WAV, pauzegrenzen, serialisatie, mislukte diensten, herstel, dubbele verwerking, behouden correcties, lange transcripties en lokale HTTP-verbindingen. De smokeproef gebruikt echte lokale Whisper/Ollama en synthetische Nederlandstalige audio; resultaten staan in een tijdelijke map buiten de vault. Zij gebruikt geen microfoon en bewijst geen verstaanbaarheid aan de speeltafel.

## API-bronnen

- [Officiële Obsidian-plugin-API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts).
- [whisper.cpp-server en multipart uploads](https://github.com/ggml-org/whisper.cpp/tree/master/examples/server).
- [Ollama Chat API](https://docs.ollama.com/api/chat).
- [AudioWorkletNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode).
