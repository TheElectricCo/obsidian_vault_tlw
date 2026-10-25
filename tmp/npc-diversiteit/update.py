import json, re, shutil
from pathlib import Path

root = Path('The Last Wish/Artefacts/NPCS/Akros')
profiles = json.loads(Path('tmp/npc-diversiteit/profiles.json').read_text())
manifest_path = Path('tmp/npc-diversiteit/generated.json')
manifest = json.loads(manifest_path.read_text())
base = 'Use case: stylized-concept. Asset: ONE standalone D&D NPC portrait, vertical 2:3, ancient Greek fantasy city Akros in Theros. Painterly realistic fantasy book illustration, expressive distinctive face, tactile brushwork, believable age and anatomy. Draped linen/wool and ancient Greek bronze where appropriate. No modern objects, no text, no border, no watermark, no extra foreground people. Make this individual instantly recognizable at the gaming table; no generic attractive face, no repeated brown-haired olive-skinned middle-aged face. '
gallery = root / 'Akros - Portretgalerij.md'
gallery_text = gallery.read_text()
overview = root / 'Akros - NPC-overzicht.md'
overview_text = overview.read_text()
prompts = ['# Akros — Portretprompts v2', '', 'Gegenereerd op 2026-10-25 met de ingebouwde imagegen-tool. Deze reeks vervangt de eerste portretten in de fiches en galerij; de oorspronkelijke PNG-bestanden blijven bewaard.', '', 'Acht mensen en tweeëntwintig niet-menselijke NPC’s. Rassen buiten de gebruikelijke Theros-bevolking zijn campagne-uitbreidingen op verzoek van de DM. Leeftijd en uiterlijk zijn afgestemd op het gekozen ras; functies, geheimen en verhaalhaakjes blijven behouden. Dit geeft geen nieuwe spelwaarden of automatische raseigenschappen aan statblocks.', '']
table = ['## Rassen en herkenningspunten', '', 'De contacten omvatten acht mensen en tweeëntwintig NPC’s van andere rassen. Dwergen, elfen, halfelfen, halflings, een gnome, halforks, tieflings en een dragonborn verbreden hier op verzoek van de DM de bevolking naast de vertrouwde Theros-rassen. Dit is een campagnekeuze, geen wijziging van het bronmateriaal.', '', '| NPC | Ras | Leeftijd | Herkenningspunt |', '| --- | --- | --- | --- |']
for ident, race, age, appearance, visual in profiles:
    fiche = next(root.glob(f'{ident:02d} - *.md'))
    s = fiche.read_text()
    name = re.search(r'^name: "([^"]+)"', s, re.M)[1]
    old_ref = re.search(r'!\[\[([^|]+\.png)\|', s)[1]
    # Idempotent: the manifest uses the original asset name.
    old_ref = old_ref.replace('-v2.png', '.png')
    new_ref = old_ref.replace('.png', '-v2.png')
    source = Path(manifest[str(ident)])
    assert source.is_file(), source
    dest = Path(new_ref)
    if source.resolve() != dest.resolve():
        shutil.copy2(source, dest)
    s = s.replace(old_ref, new_ref)
    s = re.sub(r'\*\*Identiteit:\*\* [^;]+;', f'**Identiteit:** {race}, {age} jaar;', s)
    # Remove old appearance in repeated runs, preserving the original first impression.
    s = re.sub(r'\*\*Uiterlijk:\*\* .*?\n\n', '', s)
    s = s.replace('## Eerste indruk\n\n', f'## Eerste indruk\n\n**Uiterlijk:** {appearance}\n\n')
    if ident == 5:
        s = s.replace('kortgeknipt zilvergrijs haar', 'kortgeknipte zilvergrijze kopvacht')
    if ident == 14:
        s = s.replace('Zijn baard is kortgeknipt tegen vonken.', 'Zijn afgebroken hoornkam blijft vrij van losse versiering die vonken kan vangen.')
    fiche.write_text(s)
    gallery_text = gallery_text.replace(old_ref, new_ref)
    heading = f'## {ident:02d} — {name}'
    # Include race visibly without putting DM secrets in the gallery.
    gallery_text = gallery_text.replace(heading + '\n\n', heading + f'\n\n**{race} · {age} jaar**\n\n') if f'**{race} · {age} jaar**' not in gallery_text else gallery_text
    table.append(f'| [[{fiche.stem}|{name}]] | {race} | {age} | {appearance} |')
    prompt = base + f'Subject age {age}: ' + visual + '. Single subject only, visually clear racial features, portrait fills the frame, natural hands.'
    if ident == 1:
        prompt = base + 'Subject: Melantho, female hill dwarf aged 161, tiny broad stocky bridge engineer, weather-beaten ruddy freckled square face, wide flat nose, heavy silver eyebrows, white hair in two short tight braids, a stubborn amused squint. Patched oversized slate-blue work coat, chalk dust, four knotted inspection cords on belt, bronze inspection ring and chalk. Waist-up, leaning over parapet inspecting bridge stone, cool fog-blue morning over a mountainous chasm. Clearly dwarf proportions.'
    prompts += [f'## {ident:02d} — {name}', '', f'**Bestand:** [[{new_ref}]]', '', '```text', prompt, '```', '']
gallery.write_text(gallery_text)
if '## Rassen en herkenningspunten' in overview_text:
    overview_text = overview_text.split('## Rassen en herkenningspunten')[0].rstrip() + '\n'
overview.write_text(overview_text.rstrip() + '\n\n' + '\n'.join(table) + '\n')
(root / 'Portretten/Akros - Portretprompts v2.md').write_text('\n'.join(prompts))
for filename in ['Akros - Portretprompts.md', 'Akros - Overige portretprompts.md']:
    p = root / 'Portretten' / filename
    text = p.read_text()
    note = '> [!info] Vorige versie\n> Deze prompts horen bij de oorspronkelijke portretten. De huidige rassen, uiterlijke kenmerken en beelden staan in [[Akros - Portretprompts v2]].\n\n'
    if note not in text:
        text = text.replace('\n\n', '\n\n' + note, 1)
        p.write_text(text)
print(f'{len(profiles)} portretten gekopieerd; fiches, galerij, overzicht en prompts bijgewerkt.')
