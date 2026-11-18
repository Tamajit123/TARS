/** Visual viewport coordinates use CSS pixels, including browser zoom. */
export function keyboardViewport(layoutHeight:number,visibleHeight:number,offsetTop:number,scale:number,editing:boolean){
  const valid=[layoutHeight,visibleHeight,offsetTop,scale].every(Number.isFinite)&&layoutHeight>0&&visibleHeight>0&&scale>0;
  const bottom=valid?Math.min(layoutHeight,visibleHeight+Math.max(0,offsetTop)):layoutHeight;
  // Pinch zoom also shrinks visualViewport; never mistake that for a keyboard.
  return {open:valid&&editing&&Math.abs(scale-1)<0.05&&layoutHeight-bottom>80,bottom};
}
