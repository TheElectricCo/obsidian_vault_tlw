# Opname, transcriptie en sessienotities

**Status:** aanpak en D&D-prompt voorbereid; opname en transcriptie nog niet gekoppeld of getest.

In deze vault is de ingebouwde Obsidian-plugin **Audio recorder** al ingeschakeld. Er is nog geen transcriptieplugin geïnstalleerd.

## Voorgestelde Obsidian-aanpak

[LexVoice](https://github.com/Lynn-x/LexVoice) combineert opname, transcriptie en een overzicht dat tijdens de opname wordt bijgewerkt. De documentatie beschrijft configureerbare updates tussen 30 seconden en 30 minuten; doorlopende transcriptie vereist een ondersteunde streamingdienst. Het uiteindelijke verslag wordt na het stoppen samengesteld uit de opgeslagen transcriptie.

Dit is een geschikte kandidaat voor sessienotities, maar de werking met Nederlands, jullie microfoon en jullie gekozen AI-diensten moet nog met een korte opname worden getest. Een live overzicht is niet automatisch een volledig, definitief verslag.

De plugin vereist Obsidian 1.10.0 of nieuwer en een transcriptiedienst. Een taalmodel levert het live overzicht en de samenvatting. Beide diensten kunnen volgens de documentatie lokaal of extern draaien; de concrete configuratie hangt af van de gekozen diensten. De huidige LexVoice-uitgaven hebben een eigen softwarelicentie; persoonlijke aanpassingen zijn toegestaan, maar het is geen open-sourceplugin.

## Opnamebron

- **Samen aan tafel:** neem op met een microfoon die de hele groep goed opvangt. Test met mensen op hun normale zitplaatsen.
- **Online op deze Mac:** neem zowel je eigen microfoon als de stemmen uit de belapp op. LexVoice beschrijft hiervoor een virtueel audioapparaat zoals BlackHole. Alleen je eigen microfoon opnemen mist de andere deelnemers wanneer je een hoofdtelefoon gebruikt.

## Instellingen om na de keuze in te richten

1. Kies de opnamebron en een lokale of externe transcriptiedienst die Nederlands ondersteunt.
2. Kies een lokaal of extern taalmodel voor de notities.
3. Bewaar de bestanden per sessie, bijvoorbeeld:

   ```text
   The Last Wish/Sessions/001 - Phanarax Brug/
     Recordings/
     Transcript.md
     Sessieverslag.md
   ```

   Dit is een voorgestelde indeling, geen garantie dat een plugin deze exacte bestandsnamen gebruikt.

4. Gebruik [[Sessienotities-prompt]] als instructie voor de samenvatting en geef de relevante spellinghulp mee.
5. Begin met een overzichtsupdate per 1–2 minuten. Maak na het stoppen een eindverslag.
6. Controleer instellingen voor automatisch koppelen en het aanmaken van andere notities: schrijf de resultaten eerst alleen in de sessiemap.
7. Test met een korte opname: Nederlands, fantasy-namen, een bevestigde actie, een nog niet uitgevoerd plan en twee mensen die door elkaar praten. Controleer de opgeslagen audio, transcriptie en notities.

Bij externe verwerking ontvangt de gekozen dienst de audio of transcriptie. API-kosten hangen af van de dienst en de modellen. Als een plugin API-sleutels in zijn instellingen bewaart, houd die bestanden buiten Git; controleer dit bij het inrichten, omdat deze vault Obsidian Git gebruikt.

## Wat nog nodig is

- Keuze van interface: Obsidian of Codex.
- Keuze van opnamebron: samen aan tafel of online.
- Keuze van verwerking: lokaal of via externe AI-diensten.
- Daarna: diensten configureren, eventueel een plugin installeren en één opname van begin tot eind testen.

## Bronnen

- [LexVoice-documentatie, vereisten, privacy en installatie](https://github.com/Lynn-x/LexVoice)
- [Obsidian Audio recorder](https://help.obsidian.md/plugins/audio-recorder)

De mogelijkheden van LexVoice zijn op 9 oktober 2026 gecontroleerd in de upstream-documentatie. De instellingen van deze vault zijn rechtstreeks gelezen.
