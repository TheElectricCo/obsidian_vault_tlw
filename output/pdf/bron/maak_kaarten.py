from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image
from pypdf import PdfReader

ROOT = Path.cwd()
OUT = ROOT / 'output/pdf'
ART = ROOT / 'The Last Wish/Artefacts/Scenery/Akros'
for name, file in [('Body','Georgia.ttf'), ('Bold','Georgia Bold.ttf'), ('Italic','Georgia Italic.ttf')]:
    pdfmetrics.registerFont(TTFont(name, '/System/Library/Fonts/Supplemental/' + file))
W, H = 595.276, 841.89
INK = HexColor('#29251f')
PAPER = HexColor('#faf6eb')

menus = [
 dict(file='De Rustende Veteraan - Spijzen en dranken.pdf', title='De Rustende Veteraan', host='Eryx', point='23', color='#7c4934', art='23-The-Veterans-Rest.png',
 motto='Een warme haard. Een volle kom. Een stoel die op u wacht.',
 intro='Onder het verbleekte vaandel geurt het naar laurier en vers brood. Hier mag een avond eenvoudig voorbijgaan.',
 sections=[('Uit de kruik', [
 ('Bronwater', 'Een beker koel water voor iedere gast.', 'gratis'),
 ('Licht gerstebier', 'Een aardewerken beker, zacht en dorstlessend.', '4 kp'),
 ('Rode huiswijn', 'Een beker, naar wens met water aangelengd.', '1 zp'),
 ('Warme honingwijn', 'Een beker wijn met honing en tijm.', '2 zp'),
 ('Salie en berghoning', 'Een dampende beker kruidenthee.', '5 kp')]),
 ('Van het haardvuur', [
 ('Brood van de dag', 'Een dikke snee met olijfolie en grof zout.', '2 kp'),
 ('De veldkom', 'Linzen, ui en laurier; geserveerd met brood.', '1 zp'),
 ('De laatste wacht', 'Bonenstoof met gerookt spek en brood.', '2 zp'),
 ('Lamsstoof van de haard', 'Langzaam gegaard met wortels, tijm en gerst.', '4 zp'),
 ('De gedeelde plank', 'Brood, schapenkaas, olijven en ui voor twee.', '3 zp')]),
 ('Een zoete afsluiter', [
 ('Gebakken appel', 'Warm uit de sintels, met een lepel honing.', '5 kp'),
 ('Vijgen met zachte kaas', 'Twee gedroogde vijgen op verse schapenkaas.', '8 kp')])],
 note='De veldkom met brood en een beker bronwater: 1 zp. Vraag Eryx naar de pot van vandaag.'),
 dict(file='De Speer en het Schild - Spijzen en dranken.pdf', title='De Speer en het Schild', host='Dione', point='24', color='#8e3434', art='24-The-Spear-and-Shield.png',
 motto='Voor grote dorst en honger na de wacht.',
 intro='Onder het rode doek klinken bekers en gelach. Dione zet de kruiken neer terwijl de grill nog knettert.',
 sections=[('Hef de beker', [
 ('Bronwater', 'Een beker voor bij de maaltijd of tussendoor.', 'gratis'),
 ('Garnizoensbier', 'Een beker stevig gerstebier.', '4 kp'),
 ('Rode huiswijn', 'Een beker, naar wens met water aangelengd.', '1 zp'),
 ('Kruik voor de tafel', 'Huiswijn voor vier bekers.', '4 zp'),
 ('Granaatappelkoeler', 'Een beker verdund vruchtensap met munt.', '6 kp')]),
 ('Van rooster en ketel', [
 ('Het eerste schild', 'Platbrood met geplette kikkererwten en kruiden.', '8 kp'),
 ('De soldatenpot', 'Gerst, bonen en prei, met een stuk brood.', '1 zp'),
 ('De speer van Dione', 'Twee varkensspiesen met ui en platbrood.', '3 zp'),
 ('Rooddoekschotel', 'Gegrilde geitenkaas, olijven en warme groenten.', '2 zp'),
 ('De volle compagnie', 'Zes spiesen, brood en bonensalade voor drie.', '8 zp')]),
 ('Na de maaltijd', [
 ('Sesamkoek', 'Een knapperige koek met honing.', '4 kp'),
 ('Honingkwark', 'Zachte wrongel met walnoten.', '6 kp')])],
 note='Wachtmaaltijd: soldatenpot, brood en een beker garnizoensbier samen voor 1 zp en 4 kp.'),
 dict(file='Klifwacht - Spijzen en dranken.pdf', title='Klifwacht', host='Rhode', point='26', color='#3d6265', art='26-Cliffwatch.png',
 motto='Waar de bergen zwijgen en de wijn mag spreken.',
 intro='De avond valt in blauwe lagen over de kloof. Op tafel staan brede bekers, warme schalen en een kleine lamp.',
 sections=[('In de brede beker', [
 ('Bronwater', 'Koel geschonken in stevig aardewerk.', 'gratis'),
 ('Bergthee', 'Een beker salie, tijm en een weinig honing.', '6 kp'),
 ('Witte huiswijn', 'Een beker lichte wijn uit de uitlopers.', '2 zp'),
 ('Donkere hellingwijn', 'Een beker volle rode wijn.', '3 zp'),
 ('Kruik bij zonsondergang', 'Witte huiswijn voor vier bekers.', '8 zp')]),
 ('Van helling en haard', [
 ('Brood en olijven', 'Warm brood, olijfolie en gekneusde olijven.', '1 zp'),
 ('De koerierskom', 'Kikkererwten met bladgroen, prei en brood.', '2 zp'),
 ('Gevulde wijnbladeren', 'Gerst, dille en rozijnen, met schapenkaas.', '3 zp'),
 ('Geit van de bergweide', 'Gestoofd met tijm, ui en geroosterde wortels.', '5 zp'),
 ('De stille tafel', 'Brood, kaas, noten, olijven en vijgen voor twee.', '5 zp')]),
 ('Bij het laatste licht', [
 ('Peer in wijn', 'Zacht gestoofd in rode wijn en honing.', '1 zp'),
 ('Honingkoek met noten', 'Een kleine punt met walnoot en sesam.', '8 kp')])],
 note='De koerierskom met brood en bergthee samen: 2 zp en 6 kp. Vraag Rhode naar de dagschotel.'),
]

smith = dict(file='Het Sintelaambeeld - Diensten en tarieven.pdf', title='Het Sintelaambeeld', host='Antigone', point='25', color='#955226', art='25-The-Ember-Anvil.png',
 motto='Goed ijzer. Eerlijk werk. Een afspraak die standhoudt.',
 intro='Onder de beroete luifel brandt het vuur van Purphoros. Breng uw beschadigde werk mee; Antigone bekijkt het met u.',
 sections=[('Wapens en uitrusting', [
 ('Nazicht van een voorwerp', 'Scheuren, speling en slijtage beoordelen; 15 minuten.', '2 zp'),
 ('Slijpen en ontroesten', 'Eén gewoon wapen reinigen en slijpen; 1 uur.', '3 zp'),
 ('Gevest of schildgreep herstellen', 'Kleine delen en bevestiging inbegrepen; een halve dag.', '5 zp'),
 ('Losse klinknagels vervangen', 'Tot vijf gewone klinknagels in metaalwerk; 2 uur.', '4 zp'),
 ('Verbogen beslag richten', 'Licht beschadigd beslag of een gesp; 1 tot 2 uur.', '3 zp')]),
 ('Sloten en sleutels', [
 ('Sleutel bijmaken', 'Met een werkend voorbeeld van een gewoon slot; 1 dag.', '1 gp'),
 ('Gewoon slot herstellen', 'Reinigen en kleine delen vervangen; 1 tot 2 dagen.', 'vanaf 2 gp'),
 ('Nieuw gewoon slot met sleutel', 'Eenvoudig model; op voorraad of binnen 3 dagen.', '10 gp')]),
 ('Nieuw smeedwerk en maatwerk', [
 ('Tien ijzeren pitons', 'Eenvoudige ijzeren klimspijkers; 1 dag.', '5 zp'),
 ('Scharnier of eenvoudige grendel', 'Per stuk, zonder plaatsing; 1 dag.', 'vanaf 5 zp'),
 ('Gebroken wapen of zwaar pantser', 'Eerst beoordeling van schade en materiaal.', 'op offerte'),
 ('Gereedschap op maat', 'Schets, materiaal en levertijd samen af te spreken.', 'op offerte')])],
 note='Tarieven omvatten arbeid en gewone kleine materialen. Bij grotere schade volgt eerst een prijsafspraak. Levertijden gelden vanaf aanvang; vraag naar de wachtrij.')

def para(c, text, x, top, width, size=9, font='Body', color=INK, leading=None):
    style=ParagraphStyle('p', fontName=font, fontSize=size, leading=leading or size*1.4, textColor=color)
    p=Paragraph(text, style)
    _, height=p.wrap(width, 500)
    p.drawOn(c, x, top-height)
    return top-height

def build(d):
    path=OUT/d['file']
    c=canvas.Canvas(str(path), pagesize=(W,H))
    c.setTitle(d['title'] + (' | Diensten en tarieven' if d is smith else ' | Spijzen en dranken'))
    c.setAuthor('Farore | The Last Wish')
    accent=HexColor(d['color'])
    c.setFillColor(PAPER); c.rect(0,0,W,H,fill=1,stroke=0)
    # A broad crop of existing campaign scenery ties each handout to its location.
    im=Image.open(ART/d['art']).convert('RGB')
    iw,ih=im.size
    target=(W-64)/110
    crop_h=int(iw/target)
    center=int(ih*.48)
    im=im.crop((0,max(0,center-crop_h//2),iw,min(ih,center+crop_h//2)))
    c.drawImage(ImageReader(im),32,H-142,width=W-64,height=110,mask='auto')
    c.setFillColor(accent); c.rect(32,H-145,W-64,3,fill=1,stroke=0)
    c.setFont('Body',8); c.setFillColor(accent)
    c.drawString(38,H-165,'AKROS  /  ' + ('SMIDSE' if d is smith else 'SPIJZEN & DRANKEN'))
    c.drawRightString(W-38,H-165,'KAARTPUNT '+d['point'])
    y=para(c,d['title'],38,H-180,W-76,26,'Bold',accent,30)
    y=para(c,d['motto'],38,y-8,W-76,10,'Italic',INK,14)
    y=para(c,d['intro'],38,y-8,W-76,9,'Body',INK,12)-14
    for heading,rows in d['sections']:
        c.setFillColor(accent); c.setFont('Bold',11)
        c.drawString(38,y-11,heading)
        c.setStrokeColor(Color(accent.red,accent.green,accent.blue,alpha=.35)); c.setLineWidth(.5)
        c.line(38,y-17,W-38,y-17)
        y-=25
        for name,desc,price in rows:
            c.setFillColor(INK); c.setFont('Bold',9.4); c.drawString(38,y-9,name)
            c.setFillColor(accent); c.setFont('Bold',9.4); c.drawRightString(W-38,y-9,price)
            bottom=para(c,desc,38,y-14,W-76,8.1,'Body',INK,10.5)
            y=bottom-3
        y-=4
    assert y>100, (d['title'],y)
    c.setFillColor(HexColor('#efe7d6')); c.roundRect(32,60,W-64, y-66,4,fill=1,stroke=0)
    bottom=para(c,d['note'],42,y-15,W-84,8.2,'Italic',INK,11)
    if d is smith:
        bottom=para(c,'Alle werk is niet-magisch. Verzorging en herstellingen geven geen extra gevechtsvoordeel. Slotenwerk op vertoon van eigendom of toestemming.',42,bottom-7,W-84,7.6,'Body',INK,10)
    assert bottom>65, (d['title'],bottom)
    c.setFillColor(accent); c.setFont('Body',7.4)
    c.drawString(38,41,'kp = koperstuk   |   zp = zilverstuk   |   gp = goudstuk')
    c.drawRightString(W-38,41,'10 kp = 1 zp   |   10 zp = 1 gp')
    c.setFont('Italic',7.4); c.drawString(38,27,('Aan het aambeeld: ' if d is smith else 'Uw gastheer: ' if d['host']=='Eryx' else 'Uw gastvrouw: ')+d['host'])
    c.drawRightString(W-38,27,'Het Sintelaambeeld' if d is smith else 'Prijzen per portie, tenzij anders vermeld')
    c.save()
    r=PdfReader(path)
    assert len(r.pages)==1
    assert d['title'] in r.pages[0].extract_text()
    print(path.name, '1 pagina', 'onderkant inhoud:', round(y,1))

for d in menus+[smith]: build(d)
