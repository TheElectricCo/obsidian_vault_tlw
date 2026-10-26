from pathlib import Path
import re, html, io, json, zipfile, hashlib
import yaml
from PIL import Image as PILImage
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter, Transformation

ROOT=Path.cwd(); OUT=ROOT/'output/pdf/session-001'; OUT.mkdir(parents=True,exist_ok=True)
TMP=ROOT/'tmp/pdfs'; ASSET=TMP/'assets'
S=ROOT/'The Last Wish/Sessions/001 - Bridge of Pharagax'
W,H=595.2756,841.8898; L,R,B,T=85,43,48,58; CW=W-L-R
INK=colors.HexColor('#242b2d'); GOLD=colors.HexColor('#9a713b'); PALE=colors.HexColor('#eef1f0')
for name,fn in [('Body','Georgia.ttf'),('BodyB','Georgia Bold.ttf'),('BodyI','Georgia Italic.ttf')]:
    pdfmetrics.registerFont(TTFont(name,'/System/Library/Fonts/Supplemental/'+fn))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='BodyB',italic='BodyI',boldItalic='BodyB')
styles={
 'body':ParagraphStyle('body',fontName='Body',fontSize=10.1,leading=14.1,spaceAfter=6,textColor=INK),
 'small':ParagraphStyle('small',fontName='Body',fontSize=8.4,leading=11.5,spaceAfter=4,textColor=INK),
 'h1':ParagraphStyle('h1',fontName='BodyB',fontSize=22,leading=27,spaceAfter=17,textColor=INK,keepWithNext=True),
 'h2':ParagraphStyle('h2',fontName='BodyB',fontSize=14,leading=19,spaceBefore=12,spaceAfter=8,textColor=INK,keepWithNext=True),
 'h3':ParagraphStyle('h3',fontName='BodyB',fontSize=11,leading=15,spaceBefore=9,spaceAfter=5,textColor=INK,keepWithNext=True),
 'quote':ParagraphStyle('quote',fontName='BodyI',fontSize=10.3,leading=15,spaceAfter=7,leftIndent=12,borderColor=GOLD,borderWidth=1,borderPadding=8),
 'inscription':ParagraphStyle('inscription',fontName='BodyI',fontSize=20,leading=30,spaceAfter=15,leftIndent=12,rightIndent=12,borderColor=GOLD,borderWidth=1,borderPadding=15),
}
def clean(s):
    return s.replace('\u00a0',' ').replace('—',' - ').replace('–','-').replace('→',' > ').replace('½','1/2').replace('☐','[ ]').replace('−','-')
def inline(s):
    s=clean(s)
    s=re.sub(r'!\[\[.*?\]\]','',s)
    s=re.sub(r'\[\[([^\]]+)\]\]',lambda m:m[1].split('|')[-1].split('/')[-1].replace('\\',''),s)
    s=re.sub(r'\[([^\]]+)\]\([^)]*\)',r'\1',s)
    s=html.escape(s)
    s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)',r'<i>\1</i>',s)
    s=s.replace('`','')
    return s
def p(s,sty='body'): return Paragraph(inline(str(s)),styles[sty])
def raw(s,sty='body'): return Paragraph(s,styles[sty])
def md_text(path):
    s=path.read_text(); s=re.sub(r'^---\n.*?\n---\n','',s,flags=re.S)
    return s.replace('/a#','#',1)
def table(rows,widths=None):
    data=[[p(c,'small') for c in row] for row in rows]
    t=Table(data,colWidths=widths or [CW/len(rows[0])]*len(rows[0]),hAlign='LEFT',repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.7,GOLD),('LINEBELOW',(0,1),(-1,-1),.25,colors.HexColor('#cbd0cc')),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    return t
def parse_md(text):
    lines=text.splitlines(); out=[]; i=0
    while i<len(lines):
        line=lines[i].strip()
        if not line or line=='---': i+=1; continue
        if line.startswith('```'):
            i+=1; block=[]
            while i<len(lines) and not lines[i].startswith('```'): block.append(lines[i]);i+=1
            if block and not any('Bergzijde' in x for x in block): out.append(p(' / '.join(block),'small'))
            i+=1;continue
        if line.startswith('!'): i+=1;continue
        if line.startswith('>'):
            block=[]
            while i<len(lines) and lines[i].strip().startswith('>'):
                x=lines[i].strip()[1:].strip()
                if not x.startswith('[!'):block.append(x)
                i+=1
            txt='\n'.join(block).strip()
            if txt:out.append(raw('<br/>'.join(inline(x) for x in txt.splitlines()),'quote'))
            continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                row=[x.strip() for x in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r'[: -]*',x) for x in row): rows.append(row)
                i+=1
            if rows:
                n=max(len(x) for x in rows)
                rows=[x+['']*(n-len(x)) for x in rows]
                used=[j for j in range(n) if any(x[j] for x in rows)]
                out.append(table([[x[j] for j in used] for x in rows]))
            continue
        if line.startswith('#'):
            n=len(line)-len(line.lstrip('#'));out.append(p(line[n:].strip(),'h1' if n==1 else 'h2' if n==2 else 'h3'));i+=1;continue
        if line.startswith('[[') and ('Overzicht' in line or 'Monsters Glossary' in line or 'Alle contacten' in line):i+=1;continue
        block=[line];i+=1
        if not re.match(r'^[-\d]',line):
            while i<len(lines) and lines[i].strip() and not re.match(r'^[#>|!`-]',lines[i].strip()) and not re.match(r'^\d+\.',lines[i].strip()):
                block.append(lines[i].strip());i+=1
        out.append(p(' '.join(block)))
    return out

class Doc(SimpleDocTemplate):
    def __init__(self,path,label):
        super().__init__(str(path),pagesize=(W,H),leftMargin=L,rightMargin=R,topMargin=T,bottomMargin=B,title='The Last Wish | Sessie 001 | '+label,author='Farore Vault')
        self.label=label
    def beforePage(self):
        c=self.canv;c.saveState();c.setFillColor(INK);c.setFont('BodyB',8)
        c.drawString(L,H-31,'THE LAST WISH  /  SESSIE 001')
        c.setFont('Body',8);c.drawRightString(W-R,H-31,self.label)
        c.setStrokeColor(GOLD);c.setLineWidth(.6);c.line(L,H-40,W-R,H-40)
        c.setFont('Body',8);c.drawString(L,25,'Pharagax  |  D&D 5E 2014');c.drawRightString(W-R,25,str(self.page));c.restoreState()
def build(path,label,story):Doc(path,label).build(story)
def cover(title,sub,body):return [Spacer(1,65),p('THE LAST WISH','h2'),p(title,'h1'),p(sub,'h2'),Spacer(1,20),p(body),PageBreak()]
def image_flow(path,mh=560):
    im=PILImage.open(path).convert('RGB');w,h=im.size;scale=min(CW/w,mh/h)
    dest=ASSET/(hashlib.sha1(str(path).encode()).hexdigest()[:12]+'.jpg')
    im.thumbnail((2000,2400));im.save(dest,quality=93,subsampling=0)
    return Image(str(dest),width=w*scale,height=h*scale,hAlign='CENTER')
def statblock(path):
    s=path.read_text(); y=yaml.safe_load(re.search(r'```statblock\n(.*?)```',s,re.S)[1]);out=[p(y['name'],'h1')]
    out.append(p(f"{y['size']} {y['type']}, {y['alignment']}"))
    out.append(table([['AC','HP','Speed','CR'],[str(y['ac']),f"{y['hp']} ({y['hit_dice']})",y['speed'],str(y['cr'])]]))
    out.append(Spacer(1,10));out.append(table([['STR','DEX','CON','INT','WIS','CHA'],[f'{v} ({(v-10)//2:+})' for v in y['stats']]]))
    for k,label in [('saves','Saving throws'),('skillsaves','Skills'),('damage_vulnerabilities','Damage vulnerabilities'),('damage_resistances','Damage resistances'),('damage_immunities','Damage immunities'),('condition_immunities','Condition immunities'),('senses','Senses'),('languages','Languages')]:
        if k in y:
            val=y[k]
            if isinstance(val,list):val=', '.join(f'{k} {v:+}' for d in val for k,v in d.items())
            out.append(p(f'**{label}:** {val}'))
    for k,label in [('traits','Traits'),('actions','Actions'),('reactions','Reactions')]:
        if k in y:
            out.append(p(label,'h2'))
            for entry in y[k]:out.append(p(f"**{entry['name']}.** {entry['desc']}"))
    if y['name'].startswith('Nyima'):
        compact=ParagraphStyle('nyima',parent=styles['body'],fontSize=9.4,leading=13,spaceAfter=5)
        out=[Paragraph(e.text,compact) if isinstance(e,Paragraph) and e.style==styles['body'] else e for e in out]
    return out

def dm():
    story=cover('Het draaiboek','De Brug der Twee Bestemmingen','ALLEEN VOOR DE DM. Volledige sessietekst, zes brugscènes, 2014-monsterprofielen, NPC-fiches en administratie. Lees de uitkomsten vooraf door. De spelersbijlagen staan in een afzonderlijk bestand.')
    story += [p('Aan tafel beginnen','h1'),p('Leg de spelerskaarten, papier, potloden, zes lichtmarkers en beide godentellers klaar. De vier personages zijn voor deze sessie level 5. Controleer de actuele spelersbladen: de vault bevat vooral proloognotities.'),p('Tempo','h2'),p('Volledig: 4 1/2-6 uur. Kort: 3-4 uur; redding, harpies en kort gesprek bij het vaandel. Laat de bronzen wachters na een duidelijke reparatie zonder worpen wijken.'),table([['Volgorde','Moment'],['1. Nereon','Vóór Grot I'],['2. Bloed van de Kampioen','Grot I'],['3. Twee harpies','Na Iroas 1'],['4. Schaduwen van het Verleden','Grot II'],['5. Bronzen wachters','Na Iroas 2'],['6. Laatste Vlam','Grot III'],['7. Orestans vaandel','Na Iroas 3'],['8. Ianthe / Erebos','Aankomst; afhankelijk van de route']]),p('Drukwerk en voorbereiding','h2'),p('A4, enkelzijdig, 100% / ware grootte. Alle bladen hebben links 30 mm perforatieruimte. Perforeer uitsluitend in die marge. De tafelkaarten hebben een aparte schaalinstructie. Geen automatische aanpassing aan pagina.'),p('Bronstatus','h2'),p('Farore-homebrewmap aangetroffen maar leeg. Homebrew uit sessie-, NPC- en itemnotities blijft van toepassing. De sessie start na vijf reisdagen met Nyima; de persoonlijke prologen lopen in de logs nog achter. Vul die overgang met de spelers in, zonder hun keuzes vast te leggen.'),p('Beloningen','h2'),p('De Eerste Lauwer is ontvangen; het Zegel is bemachtigd maar niet vanzelf geïdentificeerd of afgestemd. De Loep en het Figma-briefje zijn een voorstel dat nog niet is uitgereikt. Bewaar die handouts tot de scène gespeeld is.'),PageBreak()]
    story+=parse_md(md_text(S/'001 - Phanarax Brug.md'))
    story += [PageBreak()]+parse_md(md_text(S/'002 - Encounters op de brugdelen.md'))
    for f in sorted((S/'Brugdelen').glob('*.md')):story += [PageBreak()]+parse_md(md_text(f))
    for name in ['Harpy','Animated Armor','Wight','Skeleton']:
        story += [PageBreak()]+statblock(ROOT/f'D&D 5E/Base Edition/Monsters/{name}.md')
    story += [PageBreak(),p('Puzzelmanifestaties','h1'),p('Grot II: drie manifestaties, elk AC 12 / HP 10. Geen eigen aanvallen, resistances of ability drain. Alleen indien technisch nodig een save van +0. Geen Monster Manual Shadows.'),p('De vijfde schaduw','h2'),p('Verschijnsel zonder monsterstatblok. Blijft op 30 feet, wijkt uit, valt niet aan. Geworpen voorwerpen gaan erdoor. Passende goddelijke magie kan haar tot het einde van de beproeving onderdrukken.'),p('Nereon','h2'),p('11 HP voor de reddingsscène. Gordel scheurt na drie volledige reddingsrondes; val nog 10 feet: 1d6 schade. Geen extra, verzonnen gevechtsprofiel.'),p('Orestan in zonlicht','h2'),p('Gebruik Wight; Common. Direct zonlicht geeft disadvantage op aanvallen en visuele Perception. Life Drain pas onder de helft van zijn HP. Hoornsignaal kan ook tijdens gevecht de wacht beëindigen.'),p('2014 bronvermelding','h2'),p('Monsterprofielen overgenomen uit de lokale Base Edition-notities. Dit werk bevat materiaal uit het System Reference Document 5.1 van Wizards of the Coast LLC, onder Creative Commons Attribution 4.0. https://dnd.wizards.com/resources/systems-reference-document | https://creativecommons.org/licenses/by/4.0/legalcode. Wijzigingen: opmaak en campagnegebruik; monsterwaarden behouden.'),PageBreak()]
    story+=parse_md(md_text(ROOT/'The Last Wish/NPCS/Nyima.md').split('## Statblok')[0])
    story += [PageBreak()]+statblock(ROOT/'The Last Wish/NPCS/Nyima.md')
    for name in ['02 - Ianthe - De Ruiter die Tweemaal Telt.md','01 - Melantho - Hoedster van de Vier Overspanningen.md','23 - Eryx - De Onvoltooide Heildronk.md','16 - Lysandra Kyros - Meesteres van de Gouden Lier.md','07 - Theron Kalies - Meester van het Laatste Bod.md']:
        story += [PageBreak()]+parse_md(md_text(ROOT/'The Last Wish/Artefacts/NPCS/Akros'/name))
    story += [PageBreak(),p('Nereon, Orestan en Myr','h1'),table([['NPC','Spelen / weten / grenzen'],['Nereon','Gewonde brugwerker. Wil eerst leven, dan gereedschap. Zag Grot I zonder deuren; kent de proef niet. Leent smith\'s tools en touw. Kan later Melantho introduceren.'],['Orestan','Dode sergeant. Wacht op aflossing; gebroken hoorn, oude compagnie. Tekst: Bij het antwoord van de poort eindigt de wacht. Kent geen persoonlijke campagnemysteries.'],['Myr','Verdwaalde ziel op eerste schaduwbrug. Weet zijn achternaam niet. Zijn eigen kras keert terug. Vervaagt bij grotdrempel; geen tol, buit of gevechtsprofiel.'],['Erebos','Onverbiddelijke gastheer bij Erebos 3. Groep leeft en behoudt uitrusting. Biedt een toegestane queeste om een vergeten ziel te begeleiden; naam en vervolg zijn nog open.']]),p('DM-geheugensteun: personages','h2')]
    for f in sorted((ROOT/'The Last Wish/Players').glob('*.md')):
        txt=f.read_text(); meta=yaml.safe_load(txt.split('---')[1]);story+=[p(f.stem,'h3'),p('**Doel:** '+meta.get('doel','')),p('**Laatste gelogde situatie (proloog):** '+meta.get('huidige_situatie',''))]
    story += [PageBreak(),p('Sessieadministratie','h1'),p('Iroas: [ ] [ ] [ ]     Erebos: [ ] [ ] [ ]     Vlam: [ ] [ ] [ ] [ ] [ ] [ ]'),table([['Passage','Proef / deur / Iroas / Erebos / gevolg']]+[[str(i),'________________________________________'] for i in range(1,6)],[50,CW-50]),p('Encounter- en middelenlog','h2'),table([['Onderdeel','Notities'],['Nereon / tools','________________________________________'],['Harpies / buit','________________________________________'],['Mechanisme / wachters','________________________________________'],['Orestan / vaandel','________________________________________'],['HP / max HP / rests','________________________________________'],['Myr / extra gestalte','________________________________________'],['Ianthe / flacons','________________________________________'],['Vervolg / spelerskeuzes','________________________________________']]),PageBreak(),p('Initiatief en vijandelijke HP','h1'),table([['Vijand','AC','Start HP','Huidige HP / condities'],['Harpy A','11','38','_____________________'],['Harpy B','11','38','_____________________'],['Wachter A','18','33','_____________________'],['Wachter B','18','33','_____________________'],['Orestan','14','45','_____________________'],['Skelet A','13','13','_____________________'],['Skelet B','13','13','_____________________']],[120,40,60,CW-220]),p('Initiatiefvolgorde','h2'),table([['Init.','Naam','Concentration / conditions']]+[['____','________________','_______________________'] for _ in range(10)],[45,150,CW-195])]
    path=OUT/'01-DM-draaiboek.pdf';build(path,'ALLEEN DM',story);return path

def players():
    story=cover('Spelersbladen','Arowel / Darius / Dorian / Plink','Persoonlijke invulbladen met uitsluitend bevestigde informatie. De volledige actuele character sheets zijn niet in de vault gevonden. Lege velden moeten vóór het spelen worden aangevuld vanaf de echte spelersbladen. Geen ability scores, spreuken of uitrusting zijn afgeleid uit illustraties.')
    art=['Arowel - Performance - Theros.png','Darius - Behind his desk - Theros.png','Dorian - Archaeology and giant shield v2.png','Plink - Prying open a door - Theros - Boots.png']
    names=['Arowel Starweaver','Darius Voss','Dorian Veldt','Plink Bugmoss (RIB)']
    facts=[('Level 5; bardvermogens genoemd. AC 15; HP 49; initiatiefveld +4 in vault: controleer met speler. Elvish genoemd.','De Eerste Lauwer ontvangen. Overige inventaris en spreuken aanvullen.'),('Human (Variant); Rogue (Mastermind); Guild Artisan; True Neutral. Level 5 volgens sessievoorbereiding.','Uitnodiging en catalogus. Loep nog niet uitgereikt.'),('Hexblade Warlock; Neutral Good. Level 5 volgens sessievoorbereiding.','Sentinel Edge genoemd; exacte spelwaarden niet vastgelegd.'),('Level 5 volgens sessievoorbereiding. Race, class en volledige waarden ontbreken.','26 sleutels; Zegel van de Gevleugelde Helm bemachtigd. Identificatie en attunement niet automatisch.')]
    for name,img,(known,items) in zip(names,art,facts):
        story += [p(name,'h1'),p('PERSOONLIJK SPELERSBLAD - AANVULLEN VÓÓR SPELEN','small'),image_flow(ROOT/'The Last Wish/Players/Media'/img,200),p(known),table([['Speler','Level','Class / subclass'],['________________','5','________________________']]),table([['AC','Max HP','HP nu','Temp HP','Initiatief','Speed'],['_____','_____','_____','_____','_____','_____']]),p('Ability scores en saving throws','h2'),table([['Ability','Score','Modifier','Save / proficiency']]+[[a,'_____','_____','________________'] for a in ['STR','DEX','CON','INT','WIS','CHA']],[60,60,70,CW-190]),p('Proficiency bonus: ____   Passive Perception: ____   Hit Dice: ____','small'),PageBreak(),p(name+' / acties & middelen','h1'),table([['Aanval / cantrip','To hit / save','Damage / bereik']]+[['________________','__________','________________'] for _ in range(3)]),p('Class features / feats / skills','h2'),table([['Eigenschap','Waarde / gebruik']]+[['_________________','________________________________'] for _ in range(4)],[160,CW-160]),p('Spellcasting','h2'),p('Spellcasting ability: ____   Save DC: ____   Spell attack: ____'),table([['Slotlevel','Maximum','Beschikbaar'],['1 / 2 / 3','____ / ____ / ____','____ / ____ / ____'],['Pact slots','____  Slotlevel: ____','____']]),p('Spreuken bekend / voorbereid: ____________________________________'),p('________________________________________________________________'),p('Uitrusting en afstemming','h2'),p(items),p('Attunement 1: ____________________  2: ____________________'),p('Attunement 3: ____________________  Munten: _______________'),p('Death saves: succes [ ] [ ] [ ]   mislukt [ ] [ ] [ ]'),p('Verbruikte middelen / notities: __________________________________'),p('________________________________________________________________'),PageBreak()]
    story.pop();path=OUT/'02-Spelersbladen-in-te-vullen.pdf';build(path,'PERSOONLIJK',story);return path

def image_pdf(path,img,title,sub='SPELERSHANDOUT'):
    build(path,sub,[p(title,'h1'),image_flow(img,650)])
def frame_pdf(src,title,out):
    reader=PdfReader(src);writer=PdfWriter()
    for pg in reader.pages:
        buf=io.BytesIO();c=canvas.Canvas(buf,pagesize=(W,H));c.setFont('BodyB',9);c.drawString(L,H-32,title);c.setFont('Body',8);c.drawString(L,25,'The Last Wish | Spelershandout');c.save();base=PdfReader(buf).pages[0]
        ww,hh=float(pg.mediabox.width),float(pg.mediabox.height);sc=min(CW/ww,(H-105)/hh)
        base.merge_transformed_page(pg,Transformation().scale(sc).translate(L+(CW-ww*sc)/2,55+(H-105-hh*sc)/2));writer.add_page(base)
    with open(out,'wb') as f:writer.write(f)

def handouts():
    parts=[]
    def section(title,story):
        path=TMP/f'handout-{len(parts)}.pdf';build(path,'SPELERSHANDOUT', [p(title,'h1')]+story);parts.append((title,path))
    section('Spelershandouts',[p('Bewaar dit deel apart van het DM-draaiboek. Geef inscripties en brieven pas bij de juiste scène. Character sheets en magische voorwerpkaarten worden door de DM toegevoegd.'),p('De kaarten van Akros, Theros en Meletis volgen achteraan. Schaal onbekend; uitsluitend ter oriëntatie.'),p('Print A4 enkelzijdig op ware grootte. De vrije linkermarge is 30 mm. Voor uitdeelkaarten: bewaar de hele A4 in een hoes, of knip buiten de inhoud en gebruik een kaartjeshoes.')])
    for title,body in [('De drempel','Twee wegen worden aangeboden. Slechts één keert naar de levenden terug.'),('Het altaar','Geen overwinning zonder bloed. Maar wiens bloed verdient de overwinning?'),('De drie cirkels','Wat achter je ligt, zal je altijd volgen. Tenzij je besluit het onder ogen te zien.'),('De vlam','Een vlam kan de weg wijzen. Of zij kan het einde verlichten.'),('De terugkeer','Niet elke stap brengt de reiziger dichter bij zijn bestemming.'),('Tweede terugkeer','Tweemaal nam het einde jullie aan. Een derde maal houdt het de weg open.'),('De derde lauwer','Hij die de dood vreest, zal nooit overwinnen.\n\nHij die enkel de overwinning zoekt, zal nooit begrijpen wat zij kost.'),('Het vaandel','Bij het antwoord van de poort eindigt de wacht.')]:
        section(title,[Spacer(1,120),p(body,'inscription')])
    for fn,title in [('brief.pdf','Brief van het Huis van de Gouden Speer'),('catalog.pdf','Voorlopige veilingcatalogus')]:
        out=TMP/('a4-'+fn);frame_pdf(ROOT/'The Last Wish/Artefacts/Letters'/fn,title,out);parts.append((title,out))
    plink=md_text(ROOT/'The Last Wish/Players/Plink Bugmoss (RIB).md');section('Brief van De Vos',parse_md(plink.split('# Brief aan Plink Bugmoss',1)[1]))
    for name in ['Akros','Theros','Meletis']:
        out=TMP/(name+'.pdf');image_pdf(out,ROOT/f'The Last Wish/Artefacts/Maps/{name}.png',name+' - overzichtskaart');parts.append((name+' - overzichtskaart',out))
    for name,path in [('Nyima',ROOT/'The Last Wish/NPCS/Media/Nyima - Portret v2.png'),('Ianthe',ROOT/'The Last Wish/Artefacts/NPCS/Akros/Portretten/02-Ianthe-v2.png')]:
        out=TMP/(name+'.pdf');image_pdf(out,path,name);parts.append((name+' - portret',out))
    path=TMP/'03-Spelershandouts.pdf';merge(parts,path);return path

def merge(parts,out):
    wr=PdfWriter()
    for title,path in parts:wr.append(str(path),outline_item=title,import_outline=False)
    wr.add_metadata({'/Title':'The Last Wish - Sessie 001','/Author':'Farore Vault'})
    with open(out,'wb') as f:wr.write(f)
    return len(wr.pages)

def maps():
    path=TMP/'04-Tafelkaarten-100-procent.pdf';c=canvas.Canvas(str(path),pagesize=(W,H));page=0
    def head(title,sub):
        nonlocal page
        page+=1;c.setFillColor(INK);c.setFont('BodyB',17);c.drawString(L,H-66,title);c.setFont('Body',9);c.drawString(L,H-86,sub)
        c.setFont('Body',8);c.drawString(L,25,'The Last Wish | A4 | 100% / ware grootte');c.drawRightString(W-R,25,str(page))
    def txt(x,y,t,size=9):c.setFillColor(INK);c.setFont('Body',size);c.drawString(x,y,t)
    head('Tafelkaarten','Nieuwe speelschema\'s op basis van de encountermaten; geen bestaande Atlas-kaarten.');
    y=H-135
    for line in ['Print enkelzijdig op A4, 100% / ware grootte.','Elk klein vak is exact 1 inch (25,4 mm) en stelt 5 feet voor.','Links blijft 30 mm vrij om de bladen in een binder te bewaren.','De bridge tiles tonen één herbruikbaar brugdeel met twee platforms.','Leg de twee vellen achter elkaar met 2 rijen overlap.','Knip desgewenst uitsluitend de overlaprand, buiten de kaart.','Grotten: vrije speelindeling binnen 40 feet doorsnede.','Posities in grotten zijn tekenvoorstellen; de puzzeltekst is leidend.','De DM-kaart is een verkleind schema met vijandposities.','Spelerskaarten hebben geen oplossingen of vijandlabels.']:
        txt(L,y,line);y-=25
    txt(L,y-25,'Kalibratie: onderstaande lijn moet precies 100 mm meten.')
    c.setLineWidth(1);c.line(L,y-55,L+100/25.4*72,y-55)
    for x in [L,L+100/25.4*72]:c.line(x,y-60,x,y-50)
    c.showPage()
    # Two overlapping A4 tiles; 30 grid rows = 6 + 18 + 6.
    u=72; x0=L+6; top=H-135
    for start,end,label in [(0,16,'A'),(14,30,'B')]:
        head('Brugdeel - tegel '+label,'1 vak = 5 feet | 1 inch; 2 rijen overlap met de andere tegel.')
        # Rotate long direction across rows; each printed half fits within A4.
        # 16 rows at full inch do not fit A4: use two columns, eight rows per tile segment instead.
        c.showPage()
    c.save()
    # Rebuild bridge tiles as four contiguous eight-row pages (plus 1-row overlap).
    c=canvas.Canvas(str(path),pagesize=(W,H));page=0
    head('Tafelkaarten','A4 / binderformaat / raster van exact 1 inch = 5 feet')
    y=H-135
    for line in ['Print enkelzijdig, 100% / ware grootte. Geen pagina-aanpassing.','Meet de kalibratielijn vóór het spelen: exact 100 mm.','Brug: vier tegels A-D. Overlap telkens de laatste en eerste rij.','De brug heeft een dek van 90 x 20 feet; platforms zijn 30 x 30 feet.','Het hele samengestelde brugdeel meet 6 x 30 vakken.','In de binder kunnen de tegels los worden opgeborgen.','Grotten: één herbruikbaar schema, verdeeld over twee tegels.','Alle geometrie is een tekenvoorstel uit de geschreven sessie.','De stadskaarten staan in de spelershandouts; schaal onbekend.']:
        txt(L,y,line);y-=28
    txt(L,y-25,'Kalibratie: exact 100 mm');c.line(L,y-55,L+100/25.4*72,y-55)
    for x in [L,L+100/25.4*72]:c.line(x,y-60,x,y-50)
    c.showPage()
    for idx,(start,end) in enumerate([(0,8),(7,15),(14,22),(21,30)]):
        head('Brugdeel - tegel '+chr(65+idx),'Rijen '+str(start+1)+'-'+str(end)+' | 1 vak = 5 feet | Bergzijde (A) naar Akros (D)')
        x0=L+7;top=H-130;rows=end-start
        c.setLineWidth(.35);c.setStrokeColor(colors.HexColor('#aeb5b5'))
        for row in range(start,end):
            platform=row<6 or row>=24;lo=0 if platform else 1;hi=6 if platform else 5
            for col in range(lo,hi):
                c.rect(x0+col*u,top-(row-start+1)*u,u,u,fill=0,stroke=1)
        c.setStrokeColor(INK);c.setLineWidth(1)
        for row in range(start,end):
            lo=0 if row<6 or row>=24 else 1;hi=6 if row<6 or row>=24 else 5
            for col in [lo,hi]:c.line(x0+col*u,top-(row-start)*u,x0+col*u,top-(row-start+1)*u)
        txt(L,top-rows*u-22,'Overlappende rij bij aansluiting uitlijnen. Geen vijandposities op deze kaart.',8)
        if idx==0:txt(x0+7,top+13,'BERGZIJDE / INKOMEND PLATFORM',8)
        c.showPage()
    # Cave square 8x8, split into 4 rows per sheet; one row overlap.
    for label,start,end in [('A',0,5),('B',4,8)]:
        head('Stiltegrot - tegel '+label,'40 feet doorsnede | 1 vak = 5 feet | één rij overlap')
        # eight columns exceed binder width; rotate into 2x2 quadrants below instead.
        c.showPage()
    c.save()
    # Remove temporary cave blank pages; add compact non-miniature cave diagram instead.
    rd=PdfReader(path);wr=PdfWriter()
    for pg in rd.pages[:-2]:wr.add_page(pg)
    buf=io.BytesIO();cv=canvas.Canvas(buf,pagesize=(W,H));cv.setFont('BodyB',18);cv.drawString(L,H-65,'Stiltegrot - overzicht')
    cv.setFont('Body',9);cv.drawString(L,H-88,'40 feet doorsnede | verkleind schema, niet op miniaturenschaal')
    x,y=L+30,220;unit=48
    cv.setStrokeColor(colors.HexColor('#b9bdbd'));cv.setLineWidth(.3)
    for i in range(9):cv.line(x+i*unit,y,x+i*unit,y+8*unit);cv.line(x,y+i*unit,x+8*unit,y+i*unit)
    cv.setStrokeColor(INK);cv.setLineWidth(1.2);cv.circle(x+4*unit,y+4*unit,4*unit)
    cv.setFont('Body',9);cv.drawString(x+20,y+8*unit+13,'DEUR MET SPEER EN LAUWER');cv.drawRightString(x+8*unit,y+8*unit+30,'DEUR MET KROON')
    cv.drawCentredString(x+4*unit,y-22,'INGANG');cv.drawCentredString(x+4*unit,y+4*unit,'Plaats hier altaar / cirkels / vlam')
    cv.setFont('Body',9);cv.drawString(L,140,'Nieuwe plaatsingsschets. De bron legt geen exacte objectposities vast.');cv.drawString(L,120,'Gebruik dit blad voor alle drie grotten en wis verplaatsbare markers.');cv.save()
    wr.add_page(PdfReader(buf).pages[0])
    buf=io.BytesIO();cv=canvas.Canvas(buf,pagesize=(W,H));cv.setFont('BodyB',18);cv.drawString(L,H-65,'Encounterposities / alleen DM')
    cv.setFont('Body',9);cv.drawString(L,H-87,'Voorstelschema\'s op basis van de encountertekst. 1 vak = 5 feet.')
    for idx,title in enumerate(['1 / Nereon','2 / Twee harpies','3 / Bronzen wachters','4 / Orestans vaandel']):
        x=L+idx*116;y=235;sz=22
        cv.setFont('BodyB',8);cv.drawString(x,710,title)
        cv.setLineWidth(.3)
        for row in range(18):
            for col in range(4):cv.rect(x+col*sz,y+row*sz,sz,sz)
        cv.setFont('Body',7)
        if idx==0:cv.drawString(x,y+9*sz,'kar >');cv.drawString(x,y+8*sz,'N: -10 ft.')
        if idx==1:cv.drawString(x,y+9*sz,'H1: -5 ft.');cv.drawString(x,y+13*sz,'H2 / cover')
        if idx==2:cv.drawString(x,y+12*sz,'mechanisme');cv.drawString(x,y+14*sz,'W1  boog W2')
        if idx==3:cv.drawString(x,y+10*sz,'S1  O  S2');cv.drawString(x,y+18*sz+12,'poort: sein')
    cv.setFont('Body',9)
    for i,line in enumerate(['Richting Akros bovenaan. Platforms buiten dit verkleinde schema.','Brug 1 en 2: onderhoudsterras 20 feet onder het dek; toon het vooraf.','Cover alleen waar vuurschaal of steenblok daadwerkelijk de lijn blokkeert.','Nereon hangt 10 feet onder de rand; harpy 1 zit 5 feet onder het dek.','Wachters: mechanisme 10 feet vóór boog; waarschuwen op 15 feet.','Orestan: direct zonlicht. Tekst op vaandelvoet is zonder worp leesbaar.']):cv.drawString(L,190-i*19,line)
    cv.save();wr.add_page(PdfReader(buf).pages[0])
    # Full-scale reusable cave: four quadrants with one shared row / column.
    for label,cs,ce,rs,re_ in [('NW',0,5,0,5),('NO',4,8,0,5),('ZW',0,5,4,8),('ZO',4,8,4,8)]:
        buf=io.BytesIO();cv=canvas.Canvas(buf,pagesize=(W,H))
        cv.setFont('BodyB',18);cv.drawString(L,H-65,'Stiltegrot - tegel '+label)
        cv.setFont('Body',9);cv.drawString(L,H-88,'1 vak = 5 feet | 1 inch | overlap aangrenzende rij / kolom')
        gx,gy=L+8,H-140;uu=72;cols,rows=ce-cs,re_-rs
        cv.setStrokeColor(colors.HexColor('#adb6b6'));cv.setLineWidth(.35)
        for row in range(rows):
            for col in range(cols):cv.rect(gx+col*uu,gy-(row+1)*uu,uu,uu)
        clip=cv.beginPath();clip.rect(gx,gy-rows*uu,cols*uu,rows*uu);cv.saveState();cv.clipPath(clip,stroke=0)
        cv.setLineWidth(1.5);cv.setStrokeColor(INK);cv.circle(gx+(4-cs)*uu,gy-(4-rs)*uu,4*uu);cv.restoreState()
        cv.setFont('Body',9);cv.drawString(L,gy-rows*uu-30,'40 feet doorsnede. Plaats objecten en deurmarkers volgens de scène.')
        cv.drawString(L,25,'The Last Wish | A4 | 100% / ware grootte | Grot '+label)
        cv.save();wr.add_page(PdfReader(buf).pages[0])
    with open(path,'wb') as f:wr.write(f)
    return path

def main():
    d=dm();h=handouts();m=maps()
    master=OUT/'00-Sessie-001-complete-binder.pdf'
    index=TMP/'index.pdf';counts=[len(PdfReader(x).pages) for x in [d,h,m]]
    def index_story(offset=2):
        rows=[['Tab','Inhoud','Pagina\'s']];n=offset+1
        for label,name,count in zip(['A','B','C'],['DM-draaiboek & NPC\'s','Spelershandouts & kaarten','Tafelkaarten & DM-schema'],counts):
            rows.append([label,name,f'{n}-{n+count-1}']);n+=count
        rows.append(['D','Eigen character sheets & itemkaarten','Zelf toevoegen'])
        return cover('Sessie 001','De Brug der Twee Bestemmingen','Printpakket voor een A4-ringbinder. D&D 5E 2014. Nederlandstalige sessienotities, kaarten, encounters, monsters en NPC\'s uit Farore Vault. Character sheets en magische voorwerpkaarten voeg je zelf toe achter tab D.')+[p('Binderinhoud','h1'),table(rows,[35,290,CW-325]),p('Zo print je dit pakket','h2'),p('Print enkelzijdig op A4, ware grootte / 100%. Links blijft 30 mm vrij voor 2- of 4-gaats perforatie. Enkelzijdig houdt de marge steeds links. Gebruik tabbladen A-D en steek kleurhandouts desgewenst in transparante hoezen.'),p('Tafelkaarten','h2'),p('Sectie C bevat vier losse brugtegels en vier grottegels met 1-inch-vakken. Leg aangrenzende tegels met één rij of kolom overlap. Meet eerst de 100-mm-kalibratielijn. Bewaar de losse A4-vellen na afloop in de binder.'),p('Uitdelen','h2'),p('Sectie A bevat oplossingen en NPC-geheimen. Houd die achter je scherm. Geef de handouts uit B per scène. Het DM-positieschema in C blijft achter het scherm; de overige tafelkaarten mogen op tafel.'),p('Paginanummers','h2'),p('De PDF-bladnummers in deze index zijn doorlopend. De kleine voetteksten tellen per los printdeel. PDF-bladwijzers leiden naar de hoofdsecties.'),p('Inhoud','h2'),p('Alle zes brugscènes, drie hoofdproeven, wisselproeven, beide uitkomsten, vier monsterprofielen, Nyima, Ianthe en relevante stadscontacten zijn opgenomen. Character sheets en magische voorwerphandouts zijn op verzoek weggelaten. Bronbestanden en beheerde pluginbestanden zijn ongewijzigd.')]
    build(index,'PRINTINSTRUCTIES',index_story());nidx=len(PdfReader(index).pages)
    if nidx!=2:build(index,'PRINTINSTRUCTIES',index_story(nidx))
    merge([('Voorblad & printinstructies',index),('A - DM-draaiboek',d),('B - Spelershandouts',h),('C - Tafelkaarten',m)],master)
    playerout=OUT/'03-Spelerspakket-handouts-en-kaarten.pdf';playerout.write_bytes(h.read_bytes())
    mapout=OUT/'04-Tafelkaarten-ware-grootte.pdf';mapout.write_bytes(m.read_bytes())
    manifest={'pdfs':{f.name:len(PdfReader(f).pages) for f in OUT.glob('*.pdf')},'sections':dict(zip(['DM','Handouts','Tafelkaarten'],counts)),'user_additions':'Character sheets en magische voorwerphandouts op verzoek weggelaten.'}
    (OUT/'LEESMIJ.txt').write_text('THE LAST WISH - SESSIE 001\n\nPrint A4 enkelzijdig op 100% / ware grootte. Linkermarge 30 mm voor perforatie.\n00 is de volledige binder; 01, 03 en 04 zijn alternatieve losse printdelen. Print die niet allemaal dubbel.\nCharacter sheets en magische voorwerpkaarten voeg je zelf toe achter tab D.\nBrugtegels A-D: één rij overlap; kalibratielijn is 100 mm.\nGrottegels NW/NO/ZW/ZO: één rij en één kolom overlap.\n\n'+json.dumps(manifest,ensure_ascii=False,indent=2))
    print(json.dumps(manifest,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
