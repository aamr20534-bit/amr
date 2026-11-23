# Generates the AMR logo/icons/splash. Run: python3 scripts/make-icons.py
from PIL import Image, ImageDraw
import os
S=1024
def logo(bg=True):
    im=Image.new("RGBA",(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    if bg:
        g=Image.new("RGBA",(S,S)); gp=g.load()
        for y in range(S):
            for x in range(S):
                t=(x+y)/(2*S); gp[x,y]=(int(79+(20-79)*t),int(70+(184-70)*t),int(229+(166-229)*t),255)
        m=Image.new("L",(S,S),0); ImageDraw.Draw(m).rounded_rectangle((0,0,S-1,S-1),230,fill=255); im.paste(g,(0,0),m); d=ImageDraw.Draw(im)
    # folder body + tab
    d.rounded_rectangle((200,330,824,780),70,fill="white"); d.rounded_rectangle((200,250,500,400),60,fill="white")
    # letter A cut-out
    c=(79,70,229,255); d.polygon([(512,400),(640,700),(580,700),(512,520),(444,700),(384,700)],fill=c); d.rectangle((440,620,584,668),fill=c)
    return im
os.makedirs("icons",exist_ok=True)
full=logo(); full.resize((512,512),Image.LANCZOS).save("icons/logo.png")
for s in (48,72,96,144,192,512): full.resize((s,s),Image.LANCZOS).save(f"icons/icon-{s}.png")
full.resize((64,64),Image.LANCZOS).save("favicon.png")
mask=Image.new("RGBA",(S,S),(0,0,0,0)); fg=logo(False).resize((620,620),Image.LANCZOS)
mk=Image.new("RGBA",(S,S),(79,70,229,255)); mk.paste(fg,(202,202),fg); mk.resize((512,512),Image.LANCZOS).save("icons/icon-maskable-512.png")
sp=Image.new("RGBA",(2732,2732),(15,23,42,255)); l=full.resize((700,700),Image.LANCZOS); sp.paste(l,(1016,1016),l); sp.convert("RGB").save("icons/splash.png")
# Android resources
dens={"mdpi":48,"hdpi":72,"xhdpi":96,"xxhdpi":144,"xxxhdpi":192}
for k,v in dens.items():
    p=f"android/app/src/main/res/mipmap-{k}"; os.makedirs(p,exist_ok=True)
    full.resize((v,v),Image.LANCZOS).save(p+"/ic_launcher.png"); full.resize((v,v),Image.LANCZOS).save(p+"/ic_launcher_round.png")
    fgs=int(v*108/48); f=Image.new("RGBA",(fgs,fgs),(0,0,0,0)); lg=logo(False).resize((int(fgs*.6),)*2,Image.LANCZOS); f.paste(lg,((fgs-lg.width)//2,)*2,lg); f.save(p+"/ic_launcher_foreground.png")
os.makedirs("android/app/src/main/res/drawable-nodpi",exist_ok=True)
full.resize((384,384),Image.LANCZOS).save("android/app/src/main/res/drawable-nodpi/splash_logo.png")
