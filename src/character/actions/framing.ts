/** 三视图每列需要容纳人物+车，而不只是人体宽度。 */
export function workThreeViewHalfHeight(halfHeight:number,aspect:number,isWork:boolean):number {
  return isWork ? Math.max(halfHeight,3.6/Math.max(.01,aspect)) : halfHeight;
}
