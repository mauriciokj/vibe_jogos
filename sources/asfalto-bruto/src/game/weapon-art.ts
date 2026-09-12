export function drawHeldWeapon(c: CanvasRenderingContext2D, x: number, y: number, id: string) {
  c.save();c.translate(x,y);
  if(id==='chain') {
    for(let i=0;i<7;i++){c.strokeStyle=i%2?'#869aa2':'#e0e6d0';c.lineWidth=2;c.beginPath();c.ellipse(-Math.sin(i*.65)*4,-i*4.5-2,2.7,4,i*.13,0,Math.PI*2);c.stroke();}
  } else if(id==='bottle') {
    c.fillStyle='#d9c19c';c.fillRect(-2,-5,4,7);c.fillStyle='#67a28a';c.fillRect(-2,-12,4,9);c.fillRect(-5,-29,10,20);
    c.fillStyle='#e6d5a5';c.fillRect(-5,-23,10,8);c.fillStyle='#c8ebbe';c.fillRect(-4,-29,2,15);
  } else {
    c.fillStyle='#574e4a';c.fillRect(-2,-10,4,12);c.fillStyle=id==='bat'?'#c99c66':'#b3b0a0';c.fillRect(id==='bat'?-4:-2,-33,id==='bat'?8:5,25);
    c.fillStyle='#efdab1';c.fillRect(-2,-33,2,21);
  }
  c.restore();
}
