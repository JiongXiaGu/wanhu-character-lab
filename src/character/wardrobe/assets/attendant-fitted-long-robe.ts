import { B, rigid, type Cage, type Recipe, type Region, type Vec3, type Weight } from '../../v3/types';
import { HEX, add, cross, sub, unit, bridge, face, orient, ring, vertex } from '../../v3/cage';
import { kneeWeights } from '../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

/** C4：独立收袖内侍长衣。固定纸样/开衩厚边/静态双权重；不调用 C1/C2 工厂。 */
type Row = readonly [name: string, y: number, width: number, front: number, back: number];
const PROFILE = [
  [-.85,.65],[-.50,.95],[-.15,1],[.15,1],[.50,.95],[.85,.65],
  [1,0],[.85,-.80],[.15,-1],[-.15,-1],[-.85,-.80],[-1,0],
] as const;
const BODY: readonly Row[] = [
  ['SlitRoot', .880, .212, .135, .140],
  ['Hip', .940, .198, .130, .130],
  ['WaistLower', 1.052, .176, .110, .106],
  ['Waist', 1.086, .171, .108, .105],
  ['WaistUpper', 1.117, .175, .111, .108],
  ['Rib', 1.221, .195, .125, .119],
  ['Chest', 1.307, .210, .130, .123],
  ['Shoulder', 1.412, .198, .105, .102],
  ['Collar', 1.448, .082, .071, .068],
  ['Neck', 1.470, .066, .061, .061],
];
// 侧开衩下方只有前后片，不生成两侧封筒；前短后长，横向尺寸独立于 C1。
const SKIRT: readonly Row[] = [
  ['UpperPanel', .715, .218, .140, .145],
  ['KneeUpper', .580, .220, .145, .160],
  ['Knee', .489, .220, .148, .170],
  ['HemFacing', .365, .219, .146, .168],
  ['Hem', .350, .217, .145, .167],
];
// 下身保留圆角，并在两侧另加窄衩端点；不能把原圆角拉到侧轴上，造成髋部凹面。
const LOWER_PROFILE = [
  [-.99,.10],[-.85,.65],[-.50,.95],[-.35,1],[.35,1],[.50,.95],[.85,.65],[.99,.10],
  [1,0],[.99,-.10],[.85,-.80],[.35,-1],[-.35,-1],[-.85,-.80],[-.99,-.10],[-1,0],
] as const;
const ROOT_MAP = [1,2,3,4,5,6,8,10,11,12,13,15] as const;
const PANELS = [[0,1,2,3,4,5,6,7],[9,10,11,12,13,14]] as const;
const PANEL_COLUMNS = new Set<number>(PANELS.flat());
const THICKNESS = .006;
const regionFor = (y: number): Region => y >= 1.085 ? 'torso' : y >= .94 ? 'pelvis' : y >= .489 ? 'thigh' : 'shin';

function drapeWeight(p: Vec3, name: string): Weight {
  if (name === 'Neck' || name === 'Collar') return [B.Chest,B.Neck,.35];
  if (name === 'Shoulder' || name === 'Chest') return rigid(B.Chest);
  if (name === 'Rib') return [B.Spine,B.Chest,.35];
  if (name.startsWith('Waist')) return [B.Hips,B.Spine,.35];
  const thigh = p[0] > 0 ? B.RightThigh : B.LeftThigh;
  const shin = p[0] > 0 ? B.RightShin : B.LeftShin;
  if (name === 'Hip') return [B.Hips,thigh,.64];
  if (name === 'SlitRoot') return [B.Hips,thigh,.40];
  if (name === 'UpperPanel') return [B.Hips,thigh,.12];
  return kneeWeights(p,thigh,shin);
}

export function makeAttendantFittedLongRobe(recipe: Recipe): GarmentPiece {
  if (recipe.slots.top !== 'attendant_fitted_long_robe') throw Error('C4 作者只生成收袖内侍长衣');
  const c: Cage = {vertices:[],faces:[],anchors:{}};
  const {primary,secondary,accent} = recipe.dyes;
  function makeRow(row: Row, partial = false) {
    const [name,y,width,front,back] = row;
    const lower=name==='SlitRoot'||partial;
    return (lower?LOWER_PROFILE:PROFILE).map(([px,pz],k) => {
      const upper=['Rib','Chest','Shoulder','Collar','Neck'].includes(name);
      // 长片中间两列分担左右腿时保留横向间距，避免长摆中线在迈步中折穿前后片。
      const x=upper&&Math.abs(px)===.85?Math.sign(px)*.76:!upper&&Math.abs(px)===.15?Math.sign(px)*.35:px;
      const z=upper&&[0,5,7,10].includes(k)?Math.sign(pz)*.78:pz;
      if (partial && !PANEL_COLUMNS.has(k)) return -1;
      const rearDrop = z < 0 && name.startsWith('Hem') ? .040 : 0;
      const p: Vec3 = [x*width,y-rearDrop,z*(z<0?back:front)];
      return vertex(c,`Attendant.${name}.${k}`,p,drapeWeight(p,name));
    });
  }
  const body = BODY.map(r=>makeRow(r));
  for(let r=0;r<body.length-1;r++)for(let k=0;k<12;k++) {
    if(BODY[r][0]==='Chest' && [5,6,10,11].includes(k))continue;
    const trim=BODY[r][0]==='Collar';
    // 前襟随衣面共边，不叠一条悬浮装饰；轻窄腰线没有 C1 的凸出束带。
    const facing=k===2 && r>=6 && r<8;
    if(r===0){
      // 12 列髋圈连接 16 列侧衩根，保留原圆角，并显式接入四个新增端点。
      const a=ROOT_MAP[k],b=ROOT_MAP[(k+1)%12],path=[a];
      for(let j=(a+1)%16;j!==b;j=(j+1)%16)path.push(j);
      path.push(b);
      face(c,[body[1][k],...path.map(j=>body[0][j]),body[1][(k+1)%12]],regionFor(BODY[0][1]),primary);
    }else face(c,[body[r][k],body[r][(k+1)%12],body[r+1][(k+1)%12],body[r+1][k]],regionFor(BODY[r][1]),trim?accent:facing?secondary:primary);
  }
  const openings: Record<string,number[]> = {neck:body.at(-1)!};
  const chest=body[6],shoulder=body[7];
  for(const side of [1,-1] as const) {
    const right=side===1,label=right?'Right':'Left';
    const u=right?B.RightUpperArm:B.LeftUpperArm,l=right?B.RightForearm:B.LeftForearm,h=right?B.RightHand:B.LeftHand;
    let previous=right?[chest[5],chest[6],chest[7],shoulder[7],shoulder[6],shoulder[5]]:[chest[0],chest[11],chest[10],shoulder[10],shoulder[11],shoulder[0]];
    previous.forEach((i,k)=>{c.vertices[i].w=[B.Chest,u,k<3?.87:.62];});
    const rows: readonly [string,number,number,number,number,number,Weight][] = [
      ['SleeveHead',.273,1.309,0,.038,.056,[B.Chest,u,.50]],
      ['UpperSleeve',.309,1.244,0,.047,.049,[B.Chest,u,.10]],
      ['Upper',.340,1.189,0,.051,.046,rigid(u)],
      ['Elbow',.394,1.101,0,.044,.041,[u,l,.5]],
      ['ElbowLower',.414,1.066,.002,.039,.037,[u,l,.08]],
      ['Forearm',.456,.994,.009,.029,.027,rigid(l)],
      ['CuffFacing',.492,.932,.014,.025,.025,[l,h,.40]],
      ['Cuff',.508,.904,.014,.024,.024,[l,h,.18]],
    ];
    for(const [name,x,y,z,width,depth,w]of rows) {
      const next=ring(c,`Attendant.${label}.${name}`,[side*x,y,z],[side*.866,.5,0],[0,0,1],HEX,width,depth,w);
      bridge(c,previous,next,y>1.12?'upperArm':'forearm',name==='Cuff'?accent:primary);previous=next;
    }
    openings[label+'Cuff']=previous;
    // 肘内侧使用固定空间权重带，不依赖动作或当前性别。
    for(const v of c.vertices)if(new RegExp(`^Attendant\\.${label}\\.(Upper|Elbow|ElbowLower)\\.`).test(v.id)) {
      const along=(v.p[0]-side*.394)*side*.570-(v.p[1]-1.101)*.822;
      const half=.045+4*Math.max(0,v.p[2]);
      v.w=[u,l,Math.max(0,Math.min(1,.5-along/(2*half)))];
    }
  }
  const panels=[body[0],...SKIRT.map(r=>makeRow(r,true))];
  for(let r=0;r<panels.length-1;r++)for(const columns of PANELS)for(let i=0;i<columns.length-1;i++) {
    const a=columns[i],b=columns[i+1];
    face(c,[panels[r][a],panels[r][b],panels[r+1][b],panels[r+1][a]],regionFor(SKIRT[r][1]),r===SKIRT.length-1?accent:primary);
  }
  // 固定内收面与外层一一对应；开衩边、前后下缘都以实际厚边相连。
  const outerRows=[...panels.slice(1).reverse(),...body.slice(0,4)];
  orient(c);
  const lowerIds=new Set(outerRows.flat().filter(i=>i>=0));
  const lowerFaces=c.faces.filter(f=>f.v.every(i=>lowerIds.has(i)));
  const normals=new Map<number,Vec3>();
  for(const f of lowerFaces)for(let k=1;k<f.v.length-1;k++){
    const ids=[f.v[0],f.v[k],f.v[k+1]],normal=cross(sub(c.vertices[ids[1]].p,c.vertices[ids[0]].p),sub(c.vertices[ids[2]].p,c.vertices[ids[0]].p));
    for(const i of ids)normals.set(i,add(normals.get(i)??[0,0,0],normal));
  }
  const inner=new Map<number,number>();
  for(const loop of outerRows)for(let k=0;k<loop.length;k++) {
    const oi=loop[k];if(oi<0)continue;
    const o=c.vertices[oi],normal=unit(normals.get(oi)!);
    const p:Vec3=o.p.map((v,a)=>v-THICKNESS*normal[a]) as Vec3;
    inner.set(oi,vertex(c,o.id.replace('Attendant.','Attendant.Inner.'),p,[...o.w]));
  }
  for(const f of lowerFaces)face(c,f.v.map(i=>inner.get(i)!),f.region,primary);
  // 只连接纸样明确的边界，不扫描/自动修补任意破洞。
  const rim=(a:number,b:number)=>face(c,[a,b,inner.get(b)!,inner.get(a)!],regionFor(Math.min(c.vertices[a].p[1],c.vertices[b].p[1])),accent);
  for(const [a,b]of [[7,8],[8,9],[14,15],[15,0]])rim(body[0][a],body[0][b]);
  for(const columns of PANELS) {
    for(let r=0;r<panels.length-1;r++)for(const k of [columns[0],columns.at(-1)!])rim(panels[r][k],panels[r+1][k]);
    const hem=panels.at(-1)!;
    for(let k=0;k<columns.length-1;k++)rim(hem[columns[k]],hem[columns[k+1]]);
  }
  openings.waist=body[3].map(i=>inner.get(i)!);
  // 固定内外片三角对角线，随后统一朝向；封口仍由原接口流程生成 n-gon。
  c.faces=c.faces.flatMap(f=>f.v.slice(1,-1).map((_,i)=>({...f,v:[f.v[0],f.v[i+1],f.v[i+2]]})));
  orient(c);
  c.anchors={...openings,hem:PANELS.flatMap(cols=>cols.map(k=>panels.at(-1)![k])),slitRoot:body[0],chest};
  return {id:'attendant_fitted_long_robe',slot:'top',version:GARMENT_GEOMETRY_VERSION,mesh:c,
    covers:['torso','upperArm','forearm','pelvis'],openings};
}
