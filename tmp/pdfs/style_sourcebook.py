from pathlib import Path
import sys,io,re,math,copy,json,zipfile,hashlib
from PIL import Image as PILImage
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate,PageTemplate,Frame,Paragraph,Spacer,PageBreak,NextPageTemplate,Table,TableStyle,Image,Flowable,KeepTogether,FrameBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY,TA_LEFT
from pypdf import PdfReader,PdfWriter,Transformation
import build_session_binder as src
ROOT=Path.cwd();TMP=ROOT/'tmp/pdfs/sourcebook';TMP.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'output/pdf/session-001-sourcebook';OUT.mkdir(parents=True,exist_ok=True)
W,H=src.W,src.H;L=85;R=35;BOTTOM=52;TOP=62;FULL=W-L-R;GAP=20;COL=(FULL-GAP)/2
BURG=colors.HexColor('#7d302c');INK=colors.HexColor('#292622');GOLD=colors.HexColor('#b28b50');PAPER=colors.HexColor('#fffdf8');TAN=colors.HexColor('#f1e8d3');SAGE=colors.HexColor('#e7ecdf')
for name,f in [('Book','Times New Roman.ttf'),('BookB','Times New Roman Bold.ttf'),('BookI','Times New Roman Italic.ttf'),('BookBI','Times New Roman Bold Italic.ttf')]:pdfmetrics.registerFont(TTFont(name,'/System/Library/Fonts/Supplemental/'+f))
pdfmetrics.registerFontFamily('Book',normal='Book',bold='BookB',italic='BookI',boldItalic='BookBI')
for key in src.styles:
 st=src.styles[key];st.fontName='BookB' if key.startswith('h') else 'BookI' if key in ['quote','inscription'] else 'Book';st.textColor=BURG if key.startswith('h') else INK
src.styles['body'].fontSize=10.2;src.styles['body'].leading=12.4;src.styles['body'].spaceAfter=4.5;src.styles['body'].alignment=TA_JUSTIFY
src.styles['small'].fontSize=8.6;src.styles['small'].leading=10.8
src.styles['h1'].fontSize=22;src.styles['h1'].leading=23;src.styles['h1'].spaceAfter=14
src.styles['h2'].fontSize=15;src.styles['h2'].leading=16;src.styles['h2'].spaceBefore=12;src.styles['h2'].spaceAfter=6
src.styles['h3'].fontSize=11.4;src.styles['h3'].leading=14
src.styles['quote'].fontSize=10.2;src.styles['quote'].leading=12.5;src.styles['quote'].backColor=TAN;src.styles['quote'].borderColor=GOLD;src.styles['quote'].borderWidth=.6;src.styles['quote'].borderPadding=9;src.styles['quote'].leftIndent=10;src.styles['quote'].rightIndent=9;src.styles['quote'].spaceBefore=8;src.styles['quote'].spaceAfter=12
src.styles['inscription'].fontSize=23;src.styles['inscription'].leading=32;src.styles['inscription'].borderColor=GOLD;src.styles['inscription'].backColor=PAPER
src.INK=INK;src.GOLD=GOLD;src.PALE=SAGE
for st in src.styles.values():
 st.hyphenationLang='nl_NL';st.embeddedHyphenation=1
for key in ['h1','h2','h3']:
 src.styles[key].hyphenationLang=None;src.styles[key].embeddedHyphenation=0
P=src.p

def merge_keep(parts,out):
 wr=PdfWriter()
 for title,path in parts:wr.append(str(path),outline_item=title,import_outline=True)
 wr.add_metadata({'/Title':'The Last Wish - Act I - The Pharagax Bridge','/Author':'Farore Vault'})
 with open(out,'wb') as stream:wr.write(stream)
 return len(wr.pages)
src.merge=merge_keep

def diamond(c,x,y,size=3):
 c.setFillColor(GOLD);p=c.beginPath();p.moveTo(x,y+size);p.lineTo(x+size,y);p.lineTo(x,y-size);p.lineTo(x-size,y);p.close();c.drawPath(p,fill=1,stroke=0)
def pagepaint(c,doc):
 c.saveState();c.setFillColor(PAPER);c.rect(L-9,40,FULL+18,H-80,fill=1,stroke=0)
 c.setFillColor(BURG);c.setFont('BookB',8);c.drawString(L,H-32,'THE LAST WISH');c.setFont('Book',8);c.drawRightString(W-R,H-32,doc.label.upper())
 c.setStrokeColor(GOLD);c.setLineWidth(.55);c.line(L,H-41,W-R,H-41);diamond(c,L,H-41,2)
 c.line(L,39,W-R,39);diamond(c,L+FULL/2,39,3)
 c.setFillColor(BURG);c.setFont('Book',8);c.drawString(L,24,'ACT I  /  THE PHARAGAX BRIDGE');c.drawRightString(W-R,24,str(doc.page))
 c.restoreState()
class BookDoc(BaseDocTemplate):
 def __init__(self,path,label,first='Book'):
  super().__init__(str(path),pagesize=(W,H),leftMargin=L,rightMargin=R,topMargin=TOP,bottomMargin=BOTTOM,title='The Last Wish - Act I - '+label,author='Farore Vault',allowSplitting=1)
  self.label=label
  full=Frame(L,BOTTOM,FULL,H-TOP-BOTTOM,id='full',leftPadding=0,rightPadding=0,bottomPadding=3,topPadding=0)
  left=Frame(L,BOTTOM,COL,H-TOP-BOTTOM,id='left',leftPadding=0,rightPadding=0,bottomPadding=3,topPadding=0)
  right=Frame(L+COL+GAP,BOTTOM,COL,H-TOP-BOTTOM,id='right',leftPadding=0,rightPadding=0,bottomPadding=3,topPadding=0)
  templates={'Full':PageTemplate('Full',[full],onPage=pagepaint),'Book':PageTemplate('Book',[left,right],onPage=pagepaint)}
  self.addPageTemplates([templates[first],templates['Full' if first=='Book' else 'Book']])
 def afterFlowable(self,f):
  if isinstance(f,Paragraph) and f.style.name=='h1':
   name=re.sub('<[^>]+>','',f.text);key='b'+str(self.seq.nextf('heading'));self.canv.bookmarkPage(key);self.canv.addOutlineEntry(name,key,0,False)

def fit_tables(story,width):
 for f in story:
  if isinstance(f,Table):
   old=[float(x) for x in f._argW];scale=width/sum(old);f._argW=[x*scale for x in old];f._colWidths=list(f._argW)
   f.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),SAGE),('LINEBELOW',(0,0),(-1,0),.7,GOLD),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5)]))
 return story

def draw_par(c,text,x,y,width,size=11,leading=14,color=INK,font='Book'):
 st=ParagraphStyle('canvas',fontName=font,fontSize=size,leading=leading,textColor=color)
 p=Paragraph(src.inline(text),st);w,h=p.wrap(width,1000);p.drawOn(c,x,y-h);return y-h

def cached_image(path):
 im=PILImage.open(path).convert('RGB');im.thumbnail((2100,2500));dest=TMP/(hashlib.sha1(str(path).encode()).hexdigest()[:12]+'.jpg');im.save(dest,quality=93,subsampling=0);return dest

def draw_img(c,path,x,y,w,h,mode='contain'):
 path=cached_image(path);im=PILImage.open(path);iw,ih=im.size
 if mode=='cover':
  scale=max(w/iw,h/ih);dw,dh=iw*scale,ih*scale
  c.saveState();p=c.beginPath();p.rect(x,y,w,h);c.clipPath(p,stroke=0);c.drawImage(str(path),x+(w-dw)/2,y+(h-dh)/2,dw,dh,mask='auto');c.restoreState()
 else:
  scale=min(w/iw,h/ih);c.drawImage(str(path),x+(w-iw*scale)/2,y+(h-ih*scale)/2,iw*scale,ih*scale,mask='auto')

def cover_pdf(path,kind='master'):
 c=canvas.Canvas(str(path),pagesize=(W,H));c.setFillColor(colors.white);c.rect(0,0,W,H,fill=1,stroke=0)
 if kind=='master':
  c.setFillColor(BURG);c.setFont('BookB',17);c.drawString(L,H-67,'THE LAST WISH')
  c.setFont('BookB',39);c.drawString(L,H-117,'ACT I')
  c.setFont('Book',25);c.drawString(L,H-150,'THE PHARAGAX BRIDGE')
  c.setStrokeColor(GOLD);c.setLineWidth(1);c.line(L,H-169,W-R,H-169)
  art=ROOT/'The Last Wish/Artefacts/Scenery/Akros/01-Bridge-of-Pharagax.png'
  draw_img(c,art,L,310,FULL,340,'cover')
  c.setFillColor(BURG);c.rect(L,289,FULL,21,fill=1,stroke=0);c.setFillColor(colors.white);c.setFont('Book',10);c.drawString(L+12,296,'DE BRUG DER TWEE BESTEMMINGEN')
  y=draw_par(c,'Een woordloze beproeving tussen Akros en het rijk van Erebos.',L,263,FULL,16,20,BURG,'BookI')
  draw_par(c,'Avontuur voor vier personages van level 5. Met het volledige draaiboek, encounters, monsters, NPC’s, spelershandouts en kaarten.',L,y-18,FULL,12,16)
  c.setFillColor(BURG);c.setFont('BookB',9);c.drawString(L,88,'FARORE VAULT  /  D&D 5E 2014')
  c.setFont('Book',9);c.drawString(L,69,'A4-ringbindereditie  •  30 mm perforatiemarge')
 else:
  # Same art/text division as the user's ACT I reference, within the binder area.
  draw_img(c,ROOT/'tmp/pdfs/assets/pharagax-original-1.png',L,67,230,696,'cover')
  x=L+249;wid=FULL-249
  c.setFillColor(BURG);c.setFont('BookB',24);c.drawString(x,746,'ACT I')
  y=draw_par(c,'THE PHARAGAX BRIDGE',x,720,wid,18,21,BURG)
  y=draw_par(c,'De Brug der Twee Bestemmingen',x,y-22,wid,17,21,BURG,'BookI')
  y=draw_par(c,'Vier overspanningen. Drie grotten. Twee goden die elk een weg aanbieden.',x,y-25,wid,13,17,INK,'BookI')
  y=draw_par(c,'Aan de overzijde wacht Akros. Maar wie de kroon volgt, komt niet dichter bij de levende stad. Elke doorgang draagt een keuze, en elke keuze laat iets achter.',x,y-22,wid,11.2,15)
  y=draw_par(c,'**Het draaiboek**\n\nVolledige sessietekst, zes encounters, 2014-monsters, NPC’s en administratie voor de Dungeon Master.',x,y-27,wid,11.2,15)
  y=draw_par(c,'**Groep:** vier personages, level 5.\n\n**Duur:** 4½-6 uur volledig; 3-4 uur met de korte selectie.',x,y-23,wid,10.5,14)
  draw_par(c,'Alleen voor de DM. De oplossingen en geheimen horen achter het scherm.',x,y-25,wid,10,13,BURG,'BookI')
 c.setStrokeColor(GOLD);c.setLineWidth(.6);c.line(L,48,W-R,48);diamond(c,L+FULL/2,48);c.save()

# Capture the authorized, complete content from the first bundle.
captured={}
def capture(path,label,story):captured[label]=story
src.build=capture
src.dm();story=captured['ALLEEN DM']
segments=[];part=[]
for f in story:
 if isinstance(f,PageBreak):segments.append(part);part=[]
 else:part.append(f)
if part:segments.append(part)

def title_of(seg):
 for f in seg:
  if isinstance(f,Paragraph) and f.style.name=='h1':return re.sub('<[^>]+>','',f.text)
 return ''

def thumb(path,w=COL,mh=220):
 path=cached_image(path);im=PILImage.open(path);iw,ih=im.size;sc=min(w/iw,mh/ih);return Image(str(path),iw*sc,ih*sc,hAlign='CENTER')

# A shaded stat block laid out as an independent sourcebook card.
class Card(Flowable):
 def __init__(self,flowables,width):super().__init__();self.parts=flowables;self.width=width
 def wrap(self,aW,aH):
  self.heights=[];h=20
  for f in self.parts:
   if isinstance(f,Table):fit_tables([f],self.width-20)
   _,fh=f.wrap(self.width-20,10000);self.heights.append(fh);h+=fh+getattr(f,'spaceBefore',0)+getattr(f,'spaceAfter',0)
  self.height=h+8;return self.width,self.height
 def draw(self):
  c=self.canv;c.setFillColor(TAN);c.rect(0,0,self.width,self.height,fill=1,stroke=0);c.setFillColor(BURG);c.rect(0,self.height-4,self.width,4,fill=1,stroke=0);c.rect(0,0,self.width,3,fill=1,stroke=0)
  y=self.height-13
  for f,fh in zip(self.parts,self.heights):
   y-=getattr(f,'spaceBefore',0)+fh;f.drawOn(c,10,y);y-=getattr(f,'spaceAfter',0)

# Omit the plain old cover. Everything else is preserved and reflowed.
book=[];first=True
portraits={'Nyima - de Berggids':ROOT/'The Last Wish/NPCS/Media/Nyima - Portret v2.png',
'Ianthe - De Ruiter die Tweemaal Telt':ROOT/'The Last Wish/Artefacts/NPCS/Akros/Portretten/02-Ianthe-v2.png',
'Melantho - Hoedster van de Vier Overspanningen':ROOT/'The Last Wish/Artefacts/NPCS/Akros/Portretten/01-Melantho-v2.png',
'Eryx - De Onvoltooide Heildronk':ROOT/'The Last Wish/Artefacts/NPCS/Akros/Portretten/23-Eryx-v2.png',
'Lysandra Kyros - Meesteres van de Gouden Lier':ROOT/'The Last Wish/Artefacts/NPCS/Akros/Portretten/16-Lysandra-Kyros-v2.png',
'Theron Kalies - Meester van het Laatste Bod':ROOT/'The Last Wish/Artefacts/NPCS/Akros/Portretten/07-Theron-Kalies-v2.png'}
# Resolve portrait stems from vault names, without inventing filenames.
for k,path in list(portraits.items()):
 if not path.exists():
  match=list(path.parent.glob(path.name.split('-')[0]+'-*-v2.png'))
  if match:portraits[k]=match[0]
monster_names={'Harpy','Animated Armor','Wight','Skeleton'}
after_session=[]
for seg in segments:
 for j,f in enumerate(seg):
  if isinstance(f,Paragraph) and re.sub('<[^>]+>','',f.text) in ['Na de sessie','Na het spelen']:
   after_session.extend(seg[j:]);del seg[j:];break
# Consolidate the end-of-session checklists into one deliberate reference page.
segments.insert(-2,[P('Afronding & administratie','h1')]+after_session)
for seg in segments[1:]:
 title=title_of(seg)
 if title in monster_names:continue
 full=title in ['Aan tafel beginnen','Encounters op de brugdelen','Sessieadministratie','Initiatief en vijandelijke HP'] or title.startswith('Nyima,')
 template='Full' if full else 'Book'
 if first:book += [NextPageTemplate(template)];first=False
 elif title.startswith('Tweede schaduwbrug'):book += [FrameBreak()]
 else:book += [NextPageTemplate(template),PageBreak()]
 # Page templates change on the following page, including first template handled below.
 if title=='Aan tafel beginnen':
  seg.insert(1,thumb(ROOT/'The Last Wish/Artefacts/Scenery/Road to Pharagax/05 - The Titan Stairs.png',FULL,155))
 if title=='De Brug der Twee Bestemmingen':
  seg.insert(1,thumb(ROOT/'The Last Wish/Artefacts/Scenery/Akros/01-Bridge-of-Pharagax.png',COL,170))
 if title in portraits:
  seg.insert(1,thumb(portraits[title],COL,165));seg.insert(2,Spacer(1,10))
 fit_tables(seg,FULL if full else COL)
 if title.startswith('Brugdeel 4'):
  for j,f in enumerate(seg):
   if isinstance(f,Paragraph):
    if f.style.name in ['body','quote']:
     st=ParagraphStyle('oreg',parent=f.style,fontSize=9.8,leading=11.2,spaceAfter=3)
     if f.style.name=='quote':st.borderPadding=7;st.spaceBefore=6;st.spaceAfter=8
    elif f.style.name in ['h2','h3']:
     st=ParagraphStyle('ohead',parent=f.style,fontSize=13 if f.style.name=='h2' else 11,leading=14.5,spaceBefore=8,spaceAfter=4)
    else:continue
    seg[j]=Paragraph(f.text,st)
  for f in seg:
   if isinstance(f,Table) and len(f._argW)==3:
    f._argW=[45,45,COL-90];f._colWidths=list(f._argW)
 seg=[KeepTogether([f]) if isinstance(f,Paragraph) and (f.style.name=='quote' or (f.style.name=='oreg' and f.style.backColor)) else f for f in seg]
 book.extend(seg)
 # Insert the four monster cards before puzzle/NPC material.
 if title.startswith('Tweede schaduwbrug'):
  for pair in [('Harpy','Animated Armor'),('Wight','Skeleton')]:
   book += [NextPageTemplate('Full'),PageBreak(),P('Bestiarium','h1')]
   cards=[]
   for name in pair:
    parts=src.statblock(ROOT/f'D&D 5E/Base Edition/Monsters/{name}.md')
    # Independent compact style preserves all stats while fitting a printable card.
    compact=ParagraphStyle('statbody',parent=src.styles['body'],fontSize=10,leading=12,spaceAfter=5,alignment=TA_LEFT)
    head=ParagraphStyle('stathead',parent=src.styles['h1'],fontSize=20,leading=22,spaceAfter=8)
    sh=ParagraphStyle('statsub',parent=src.styles['h2'],fontSize=13,leading=14,spaceBefore=8,spaceAfter=5)
    for i,f in enumerate(parts):
     if isinstance(f,Paragraph):parts[i]=Paragraph(f.text,head if f.style.name=='h1' else sh if f.style.name=='h2' else compact)
    cards.append(Card(parts,COL))
   t=Table([[cards[0],cards[1]]],colWidths=[COL+GAP,COL],hAlign='LEFT');t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),0)]));book.append(t)

body=TMP/'dm-body.pdf';BookDoc(body,'Draaiboek',first='Full').build(book)
cover=TMP/'dm-cover.pdf';cover_pdf(cover,'dm');dmout=OUT/'01-DM-draaiboek.pdf';src.merge([('Act I',cover),('Draaiboek',body)],dmout)

# Player handouts use the same book typography and custom scene ornaments.
# Reuse the clean original source pages for letters, keep all inscriptions player-facing.
artbridge=ROOT/'The Last Wish/Artefacts/Scenery/Akros/01-Bridge-of-Pharagax.png'
inscriptions=[('De drempel','Twee wegen worden aangeboden. Slechts één keert naar de levenden terug.'),('Het altaar','Geen overwinning zonder bloed. Maar wiens bloed verdient de overwinning?'),('De drie cirkels','Wat achter je ligt, zal je altijd volgen. Tenzij je besluit het onder ogen te zien.'),('De vlam','Een vlam kan de weg wijzen. Of zij kan het einde verlichten.'),('De terugkeer','Niet elke stap brengt de reiziger dichter bij zijn bestemming.'),('Tweede terugkeer','Tweemaal nam het einde jullie aan. Een derde maal houdt het de weg open.'),('De derde lauwer','Hij die de dood vreest, zal nooit overwinnen. Hij die enkel de overwinning zoekt, zal nooit begrijpen wat zij kost.'),('Het vaandel','Bij het antwoord van de poort eindigt de wacht.')]
parts=[]
intro=TMP/'handouts-intro.pdf';BookDoc(intro,'Spelershandouts',first='Full').build([P('Spelershandouts','h1'),thumb(artbridge,FULL,240),Spacer(1,20),P('De woorden in het steen','h2'),P('Geef elke inscriptie pas wanneer de groep haar ter plekke ziet. De brieven, portretten en overzichtskaarten kunnen afzonderlijk worden uitgedeeld.'),P('Bewaar dit deel apart van de DM-notities. Character sheets en magische voorwerphandouts voeg je zelf toe.'),P('A4, enkelzijdig, ware grootte. Linkermarge 30 mm. De overzichtskaarten hebben geen vastgelegde afdrukschaal.')]);parts.append(('Spelershandouts',intro))
for idx,(title,text) in enumerate(inscriptions):
 path=TMP/f'inscription-{idx}.pdf';c=canvas.Canvas(str(path),pagesize=(W,H));pagepaint(c,type('D',(),{'label':'Inscriptie','page':idx+2})())
 c.setFillColor(BURG);c.setFont('Book',11);c.drawString(L,H-92,'DE BRUG DER TWEE BESTEMMINGEN')
 draw_par(c,title.upper(),L,H-123,FULL,25,29,BURG,'BookB')
 # Thin framed tablet, large readable text, motifs tied to the two door symbols.
 x,y,w,h=L,290,FULL,260;c.setFillColor(TAN);c.rect(x,y,w,h,fill=1,stroke=0);c.setStrokeColor(GOLD);c.setLineWidth(.8);c.rect(x+7,y+7,w-14,h-14)
 for xx in [x+18,x+w-18]:
  for yy in [y+18,y+h-18]:diamond(c,xx,yy,3)
 st=ParagraphStyle('inscr',fontName='BookI',fontSize=22,leading=31,textColor=INK,alignment=1)
 q=Paragraph(src.inline(text),st);_,qh=q.wrap(w-58,500);q.drawOn(c,x+29,y+(h-qh)/2)
 c.setFont('BookI',10);c.setFillColor(BURG);c.drawCentredString(L+FULL/2,240,'Pharagax');c.save();parts.append((title,path))
for fn,title in [('brief.pdf','Brief van het Huis van de Gouden Speer'),('catalog.pdf','Voorlopige veilingcatalogus')]:
 path=TMP/('a4-'+fn);src.frame_pdf(ROOT/'The Last Wish/Artefacts/Letters'/fn,title,path);parts.append((title,path))
plink=src.md_text(ROOT/'The Last Wish/Players/Plink Bugmoss (RIB).md').split('# Brief aan Plink Bugmoss',1)[1]
path=TMP/'vos.pdf';BookDoc(path,'Brief van De Vos',first='Full').build([P('Brief van De Vos','h1')]+src.parse_md(plink));parts.append(('Brief van De Vos',path))
for name in ['Akros','Theros','Meletis']:
 path=TMP/(name+'.pdf');BookDoc(path,'Kaarten',first='Full').build([P(name,'h1'),P('Overzichtskaart','h3'),thumb(ROOT/f'The Last Wish/Artefacts/Maps/{name}.png',FULL,630)]);parts.append((name,path))
for name,img in [('Nyima',portraits['Nyima - de Berggids']),('Ianthe',portraits['Ianthe - De Ruiter die Tweemaal Telt'])]:
 path=TMP/(name+'.pdf');BookDoc(path,'Portretten',first='Full').build([P(name,'h1'),thumb(img,FULL,650)]);parts.append((name,path))
hout=OUT/'03-Spelerspakket-handouts-en-kaarten.pdf';src.merge(parts,hout)

# Restyle only the map furniture. Exact one-inch grid geometry is retained.
mapin=ROOT/'output/pdf/session-001/04-Tafelkaarten-ware-grootte.pdf';mout=OUT/'04-Tafelkaarten-ware-grootte.pdf'
wr=PdfWriter()
for i,pg in enumerate(PdfReader(mapin).pages):
 text=pg.extract_text();lines=text.splitlines();title=lines[0] if lines else 'Kaart'
 buf=io.BytesIO();c=canvas.Canvas(buf,pagesize=(W,H))
 # White overlay replaces old map headings without touching the grid.
 c.setFillColor(colors.white);c.rect(0,H-103,W,103,fill=1,stroke=0);c.rect(0,0,W,35,fill=1,stroke=0)
 c.setFillColor(BURG);c.setFont('BookB',19);c.drawString(L,H-66,title)
 if len(lines)>1:draw_par(c,lines[1],L,H-80,FULL,9,11)
 c.setStrokeColor(GOLD);c.setLineWidth(.5);c.line(L,H-104,W-R,H-104);c.line(L,38,W-R,38);diamond(c,L+FULL/2,38)
 c.setFillColor(BURG);c.setFont('Book',8);c.drawString(L,24,'ACT I  /  TAFELKAARTEN  /  100%');c.drawRightString(W-R,24,str(i+1));c.save()
 pg.merge_page(PdfReader(buf).pages[0]);wr.add_page(pg)
with open(mout,'wb') as f:wr.write(f)

# Index with exact assembled PDF page numbers.
countdm=len(PdfReader(dmout).pages);counth=len(PdfReader(hout).pages);countm=len(PdfReader(mout).pages)
index=TMP/'index.pdf';indexstory=[P('Inhoud & drukinstructies','h1'),P('Een avontuur voor de Dungeon Master','h2'),P('Drie goddelijke proeven verbinden vier brugdelen. Iroas biedt voortgang naar Akros; Erebos leidt steeds verder zijn rijk in. Deze editie bevat de huidige sessieversie uit de vault, vormgegeven naar je Figma-hoofdstuk “ACT I - The Pharagax Bridge”.'),src.table([['Tab','Inhoud','PDF-pagina’s'],['A','Draaiboek, encounters, bestiarium & NPC’s',f'3-{2+countdm}'],['B','Spelershandouts, brieven & overzichtskaarten',f'{3+countdm}-{2+countdm+counth}'],['C','Brug- en grottegels, plus het DM-positieschema',f'{3+countdm+counth}-{2+countdm+counth+countm}'],['D','Eigen character sheets & magische itemkaarten','Zelf toevoegen']],[35,300,FULL-335]),P('Voor je print','h2'),P('**A4, enkelzijdig, 100% / ware grootte.** De linkermarge van 30 mm blijft vrij voor perforatie. Gebruik tabbladen A-D en bescherm uitdeelkaarten desgewenst met hoezen. De kleine voetteksten tellen per los deel; deze inhoudsopgave gebruikt de PDF-bladnummers.'),P('Kaarten aan tafel','h2'),P('De vier brugtegels vormen samen een dek van 90 bij 20 feet, met twee platforms van 30 bij 30 feet. Elk vak is exact 1 inch en stelt 5 feet voor. Leg telkens één rij over elkaar. De vier grottegels hebben één rij en één kolom overlap. Meet eerst de kalibratielijn van 100 mm.'),P('Wat je uitdeelt','h2'),P('Houd sectie A en het DM-positieschema achter je scherm. Geef inscripties en brieven per scène. Character sheets en magische voorwerpkaarten zijn op jouw verzoek weggelaten. De spelregels en de huidige encounters zijn behouden; de oudere encountertekst in de Figma-stijlreferentie is niet overgenomen.'),P('Bronnen','h3'),P('Farore Vault • The Last Wish • Sessie 001. De monsterprofielen gebruiken de lokale D&D 5E 2014-bronnen; de volledige SRD-vermelding staat in het draaiboek. De oorspronkelijke vault- en Figma-bestanden zijn ongewijzigd.')]
BookDoc(index,'Inhoud',first='Full').build(indexstory)
assert len(PdfReader(index).pages)==1
mastercover=TMP/'cover.pdf';cover_pdf(mastercover,'master')
master=OUT/'00-Sessie-001-complete-binder.pdf';src.merge([('Act I',mastercover),('Inhoud',index),('A - Draaiboek',dmout),('B - Spelershandouts',hout),('C - Tafelkaarten',mout)],master)
manifest={f.name:{'pages':len(PdfReader(f).pages),'bytes':f.stat().st_size} for f in OUT.glob('*.pdf')}
(OUT/'LEESMIJ.txt').write_text('THE LAST WISH - ACT I - SOURCEBOOKEDITIE\n\nPrint het complete boek OF de losse delen, niet beide.\nA4, enkelzijdig, 100% / ware grootte. Linkermarge 30 mm voor perforatie.\nTab A: DM. Tab B: spelers. Tab C: tafelkaarten. Tab D: eigen character sheets en magische itemkaarten.\nKaarten: kalibratie 100 mm. Brug en grot op 1-inch-raster.\n\n'+json.dumps(manifest,indent=2))
archive=ROOT/'output/pdf/Sessie-001-Sourcebook-Printpakket.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for f in sorted(OUT.iterdir()):z.write(f,arcname='Sessie-001-Sourcebook/'+f.name)
print(json.dumps(manifest,indent=2))
