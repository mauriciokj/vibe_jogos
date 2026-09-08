// Small original vector illustrations for the garage; no downloaded assets.
export function weaponArt(id: string) {
  const art=id==='bottle'
    ? '<g transform="rotate(20 120 85)"><path d="M107 20h26v32l17 22v63q0 12-12 12h-36q-12 0-12-12V74l17-22z" fill="#508570" stroke="#acd2a5" stroke-width="3"/><path d="M107 20h26v10h-26z" fill="#ddc08b"/><path d="M98 89h44v37H98z" fill="#e7d6a1"/><path d="m108 117 9-19 5 11 9-7" fill="none" stroke="#425e53" stroke-width="4"/><path d="M101 75v59" stroke="#c7edc0" stroke-width="4"/></g>'
    : id==='bat'
    ? '<g transform="rotate(28 120 85)"><path d="M112 140c0-55-12-63-12-107 0-24 40-24 40 0 0 44-12 52-12 107z" fill="#c79860" stroke="#f0d3a0" stroke-width="3"/><path d="M111 140h18v17h-18z" fill="#39464a"/><path d="M110 149h20m-20-7h20m-20-7h20" stroke="#92a6a0" stroke-width="2"/><path d="M113 28v41" stroke="#f1d5a1" stroke-width="4"/></g>'
    : '<path d="M69 135 91 100 105 49q13-38 41-13t-4 48l-22 20" fill="none" stroke="#10262c" stroke-width="15"/>'+Array.from({length:11},(_,i)=>{const points=[[72,132],[82,117],[92,102],[99,86],[104,69],[110,52],[120,36],[137,32],[150,44],[150,63],[137,79]];const [x,y]=points[i];return `<ellipse cx="${x}" cy="${y}" rx="7" ry="12" transform="rotate(${i<7?30:i*24} ${x} ${y})" fill="none" stroke="${i%2?'#7d929d':'#d3e1d5'}" stroke-width="4"/>`;}).join('');
  return `<svg class="weapon-art" viewBox="0 0 240 180" aria-hidden="true"><ellipse cx="120" cy="166" rx="65" ry="6" fill="#0c1b2370"/>${art}</svg>`;
}
