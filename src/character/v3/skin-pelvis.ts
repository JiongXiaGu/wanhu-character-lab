import { B, type Cage } from './types';
import { ring, face } from './cage';

/** 皮肤专用骨盆：8点腰口、两侧8点根口、4块有限宽度裆底；非叠加补壳。 */
export function makeSkinPelvis(c: Cage, waist: number[]): [number[], number[]] {
  if (waist.length !== 8) throw new Error('固定皮肤腰口必须为8点');
  const profile: [number, number][] = [[-.45,.9],[.5,.9],[1,0],[.5,-.9],[-.45,-.9],[-.88,-.52],[-1,0],[-.88,.52]];
  const roots: number[][] = [];
  for (const side of [1, -1]) {
    const right = side === 1, name = right ? 'Right' : 'Left';
    const thigh = right ? B.RightThigh : B.LeftThigh;
    const directed = right ? profile : profile.map(([x, z]) => [-x, -z] as [number, number]);
    const root = ring(c, `SkinPelvis.${name}.Root`, [side*.101,.94,0], [1,0,0], [0,0,1], directed, .09, .094, [B.Hips,thigh,.55]);
    for (const i of [5,6,7]) {
      c.vertices[root[i]].p[1] = i === 6 ? .855 : .882;
      c.vertices[root[i]].w = [B.Hips, thigh, i === 6 ? .35 : .5];
    }
    roots.push(root);
    for (let j = 0; j < 4; j++) {
      const offset = right ? 0 : 4;
      face(c, [waist[(offset+j)%8],waist[(offset+j+1)%8],root[j+1],root[j]], 'pelvis');
    }
  }
  const [r,l] = roots;
  face(c, [waist[4],r[4],l[0]], 'pelvis');
  face(c, [waist[0],l[4],r[0]], 'pelvis');
  const right = [r[4],r[5],r[6],r[7],r[0]], left = [l[0],l[7],l[6],l[5],l[4]];
  for (let i=0;i<4;i++) face(c,[right[i],right[i+1],left[i+1],left[i]],'pelvis');
  return [r,l];
}

/** 仅此固定皮肤接口由8点根口过渡到原6点大腿，保留原膝/脚拓扑。 */
export function connectSkinThigh(c: Cage, root: number[], thigh: number[]): void {
  if (root.length !== 8 || thigh.length !== 6) throw new Error('固定皮肤腿口采样数不匹配');
  for(let j=0;j<4;j++) face(c,[root[j],root[j+1],thigh[j+1],thigh[j]],'thigh');
  face(c,[root[4],root[5],thigh[5],thigh[4]],'thigh');
  face(c,[root[5],root[6],thigh[5]],'thigh');
  face(c,[root[6],root[7],thigh[5]],'thigh');
  face(c,[root[7],root[0],thigh[0],thigh[5]],'thigh');
}
