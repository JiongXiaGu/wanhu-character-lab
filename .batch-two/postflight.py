from pathlib import Path

def replace(path,before,after):
    p=Path(path);t=p.read_text();assert t.count(before)==1,(path,before[:100],t.count(before));p.write_text(t.replace(before,after))

# 方冠横翼原先贯穿头皮；只移动冠翼到后壳，保留完整帽壳和头发。
replace('src/character/wardrobe/adornments.ts',"solidBox(c,'CapWings',[0,1.739,-.086]","solidBox(c,'CapWings',[0,1.739,-.120]")

# 新短装首轮慢跑在左右腿内侧相交。裙摆的外侧展开不应挤占两腿行走间隙。
# 内侧五点回到既有独立裤装的安全轮廓；只外侧三点保留短裤/裙裤各自设计。
# 这是该衣服的固定制作表，不更改裸体、不改变骨骼、不改逐帧检测。
replace('src/character/wardrobe/assets/short-bottoms.ts',"      if(r>0)for(const vi of next)c.vertices[vi].w=kneeWeights(c.vertices[vi].p,thigh,shin);", """      const inner:readonly [number,number][]=skirt?
        [[.089,.087],[.07496,.07240],[.06518,.06223],[.06220,.05965]]:
        [[.089,.087],[.06590,.06298],[.06180,.05935]];
      const [innerWidth,innerDepth]=inner[r];
      for(const k of [0,4,5,6,7])c.vertices[next[k]].p=[side*(.101+profile[k][0]*innerWidth),y,side*profile[k][1]*innerDepth];
      if(r>0)for(const vi of next)c.vertices[vi].w=kneeWeights(c.vertices[vi].p,thigh,shin);""")

p=Path('Documentation/轻便服饰与头饰安全留量.md');p.write_text(p.read_text().rstrip()+'''\n\n## 固定内侧制作留量\n\n首轮源帧/中点检查定位到慢跑时两条短装内侧互相贯穿，而非皮肤或骨架错误。短装内侧五点采用既有独立裤装的留量，外侧三点保留各自短裤/裙裤展开；不靠缩减动作或放宽检测通过。方冠横翼移至后壳，避免原翼片横切头皮。\n''')
print('SECOND_BATCH_POSTFLIGHT_AUTHORED')
