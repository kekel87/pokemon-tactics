import zlib,struct,sys
def read_png(path):
    d=open(path,'rb').read(); p=8; idat=b''; plte=None
    while p<len(d):
        n,t=struct.unpack('>I4s',d[p:p+8]); body=d[p+8:p+8+n]; p+=12+n
        if t==b'IHDR': w,h,bd,ct=struct.unpack('>IIBB',body[:10])
        elif t==b'IDAT': idat+=body
    raw=zlib.decompress(idat); assert ct==3
    bpp_bits=bd; stride=(w*bd+7)//8
    rows=[]; prev=bytearray(stride); pos=0
    for y in range(h):
        f=raw[pos]; line=bytearray(raw[pos+1:pos+1+stride]); pos+=1+stride
        for i in range(stride):
            a=line[i-1] if i>0 else 0; b=prev[i]; c=prev[i-1] if i>0 else 0
            if f==1: line[i]=(line[i]+a)&255
            elif f==2: line[i]=(line[i]+b)&255
            elif f==3: line[i]=(line[i]+((a+b)>>1))&255
            elif f==4:
                pa=abs(b-c);pb=abs(a-c);pc=abs(a+b-2*c);pr=a if pa<=pb and pa<=pc else (b if pb<=pc else c)
                line[i]=(line[i]+pr)&255
        rows.append(line); prev=line
    px=[]
    for line in rows:
        r=[]
        for x in range(w):
            if bd==8: r.append(line[x])
            else:
                per=8//bd; byte=line[x//per]; sh=8-bd*(x%per+1); r.append((byte>>sh)&((1<<bd)-1))
        px.append(r)
    return w,h,px
def read_pal(path):
    L=open(path).read().split('\n'); n=int(L[2]); return [tuple(map(int,L[3+i].split())) for i in range(n)]
w,h,px=read_png('fr_regionmap.png')
pal=read_pal('fr_region_map.pal')
tm=open('fr_kanto.bin','rb').read()
ents=struct.unpack('<%dH'%(len(tm)//2),tm)
W,H=30,20; out=[[(0,0,0)]*(W*8) for _ in range(H*8)]
tpr=w//8
for i,e in enumerate(ents):
    tile=e&0x3ff; hf=(e>>10)&1; vf=(e>>11)&1; pb=(e>>12)&15
    tx,ty=(i%W)*8,(i//W)*8; sx,sy=(tile%tpr)*8,(tile//tpr)*8
    for yy in range(8):
        for xx in range(8):
            v=px[sy+(7-yy if vf else yy)][sx+(7-xx if hf else xx)]
            out[ty+yy][tx+xx]=pal[pb*16+v] if pb*16+v<len(pal) else (255,0,255)
with open('kanto_assembled.ppm','wb') as f:
    f.write(b'P6 %d %d 255\n'%(W*8,H*8))
    for r in out:
        for c in r: f.write(bytes(c))
print('ok',len(ents),len(pal))
