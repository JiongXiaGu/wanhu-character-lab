from pathlib import Path

def replace(path,before,after):
    p=Path(path);t=p.read_text();assert t.count(before)==1,(path,before[:100],t.count(before));p.write_text(t.replace(before,after))

# 方冠横翼移至后壳，不改头发。
replace('src/character/wardrobe/adornments.ts',"solidBox(c,'CapWings',[0,1.739,-.086]","solidBox(c,'CapWings',[0,1.739,-.120]")

# 头巾是额前至耳后的U形束带；后部给低髻留开放空间，不按发型切换结构。
replace('src/character/v3/outfit.ts','  bridge(c, a, b, "equipment", "#a48760");','''  // 额前束带后侧开放，避免闭环横穿低髻；所有发型使用同一制作结构。
  for(const i of [6,7,0,1]){
    const j=(i+1)%8;
    face(c,[a[i],a[j],b[j],b[i]],"equipment","#a48760");
  }''')

# 内侧大腿保持既有行走间距；裸露膝部的袖口另留前后厚度，不能照搬隐藏皮肤的长裤口。
replace('src/character/wardrobe/assets/short-bottoms.ts',"      if(r>0)for(const vi of next)c.vertices[vi].w=kneeWeights(c.vertices[vi].p,thigh,shin);", """      const inner:readonly [number,number][]=skirt?
        [[.089,.087],[.077,.082],[.075,.090],[.075,.090]]:
        [[.089,.087],[.075,.090],[.075,.090]];
      const [innerWidth,innerDepth]=inner[r];
      for(const k of [0,4,5,6,7])c.vertices[next[k]].p=[side*(.101+profile[k][0]*innerWidth),y,side*profile[k][1]*innerDepth];
      if(r>0)for(const vi of next)c.vertices[vi].w=kneeWeights(c.vertices[vi].p,thigh,shin);""")

p=Path('Documentation/轻便服饰与头饰安全留量.md');p.write_text(p.read_text().rstrip()+'''\n\n## 固定内侧制作留量\n\n首轮源帧/中点检查定位到慢跑时两条短装内侧互相贯穿。大腿内侧保留行走间距，露膝下摆单独预留厚度；不更改人体或全局膝部权重、不缩减动作或放宽检测。方冠横翼移至后壳，额前束带使用固定后侧开放的U形结构，给低髻留空间；不按发型切换隐藏表。\n''')
print('SECOND_BATCH_POSTFLIGHT_AUTHORED')
