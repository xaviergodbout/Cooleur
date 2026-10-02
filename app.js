const MAX_COLORS = 10;
const MIN_COLORS = 2;
const schemes = {
  balanced: [0, 35, 155, 210, 265, 325],
  monochromatic: [0, 0, 0, 0, 0, 0],
  analogous: [-55, -32, -12, 12, 32, 55],
  complementary: [0, 12, -12, 180, 192, 168],
  triadic: [0, 12, 120, 132, 240, 252],
  tetradic: [0, 60, 180, 240, 12, 192],
  square: [0, 90, 180, 270, 12, 102]
};

const els = {
  palette: document.querySelector('#palette'), status: document.querySelector('#paletteStatus'),
  harmony: document.querySelector('#harmonySelect'), harmonyTrigger: document.querySelector('#harmonyTrigger'), harmonyMenu: document.querySelector('#harmonyMenu'), harmonyLabel: document.querySelector('#harmonyLabel'), themeToggle: document.querySelector('#themeToggle'),
  generate: document.querySelector('#generateButton'), add: document.querySelector('#addColorButton'),
  variations: document.querySelector('#variationsButton'), variationView: document.querySelector('#variationsView'),
  closeDialog: document.querySelector('#closeVariations'), variationGrid: document.querySelector('#variationGrid'),
  adjustmentsButton: document.querySelector('#adjustmentsButton'), adjustmentsPanel: document.querySelector('#adjustmentsPanel'),
  closeAdjustments: document.querySelector('#closeAdjustments'),
  exportButton: document.querySelector('#exportButton'), exportMenu: document.querySelector('#exportMenu'),
  toast: document.querySelector('#toast'), reset: document.querySelector('#resetAdjustments'),
  editor: document.querySelector('#colorEditor'), editorValue: document.querySelector('#editorValue'), editorFormat: document.querySelector('#editorFormat'), editorHue: document.querySelector('#editorHue'), colorPlane: document.querySelector('#colorPlane')
};

const initial = ['#EF476F', '#F78C6B', '#FFD166', '#06D6A0', '#118AB2', '#073B4C'];
let state = {
  colors: initial.map((hex, i) => ({ id: crypto.randomUUID?.() || `${Date.now()}-${i}`, hex, locked: false })),
  baseColors: [...initial], format: 'hex', harmony: 'balanced', variation: 'luminance',
  adjustments: { hue: 0, saturation: 0, brightness: 0, temperature: 0 }
};

function clamp(n, min = 0, max = 100) { return Math.min(max, Math.max(min, n)); }
function wrap(n, max = 360) { return ((n % max) + max) % max; }
function hexToRgb(hex) {
  const raw = hex.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(raw)) return null;
  return { r: parseInt(raw.slice(0,2),16), g: parseInt(raw.slice(2,4),16), b: parseInt(raw.slice(4,6),16) };
}
function rgbToHex(r,g,b) { return `#${[r,g,b].map(v => Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('').toUpperCase()}`; }
function rgbToHsl(r,g,b) {
  r/=255; g/=255; b/=255; const max=Math.max(r,g,b), min=Math.min(r,g,b); let h=0,s=0; const l=(max+min)/2;
  if (max !== min) { const d=max-min; s=l>.5?d/(2-max-min):d/(max+min); switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;} h*=60; }
  return { h, s:s*100, l:l*100 };
}
function hslToRgb(h,s,l) {
  h=wrap(h)/360; s=clamp(s)/100; l=clamp(l)/100;
  if (!s) { const v=Math.round(l*255); return {r:v,g:v,b:v}; }
  const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
  const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
  return {r:hue2rgb(p,q,h+1/3)*255,g:hue2rgb(p,q,h)*255,b:hue2rgb(p,q,h-1/3)*255};
}
function hslToHex(h,s,l) { const {r,g,b}=hslToRgb(h,s,l); return rgbToHex(r,g,b); }
function hexToHsl(hex) { const rgb=hexToRgb(hex); return rgb ? rgbToHsl(rgb.r,rgb.g,rgb.b) : null; }
function contrast(hex) { const {r,g,b}=hexToRgb(hex); const lum=(.299*r+.587*g+.114*b)/255; return lum>.62?'#16171a':'#ffffff'; }
function displayValue(hex) {
  const rgb=hexToRgb(hex), hsl=hexToHsl(hex);
  if (state.format==='rgb') return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  if (state.format==='hsl') return `${Math.round(hsl.h)}°, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%`;
  return hex;
}
function parseColor(value) {
  const clean=value.trim();
  if (/^#?[0-9a-f]{6}$/i.test(clean)) return `#${clean.replace('#','').toUpperCase()}`;
  const nums=clean.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!nums || nums.length<3) return null;
  if (state.format==='hsl' || /hsl/i.test(clean)) return hslToHex(nums[0],nums[1],nums[2]);
  return rgbToHex(nums[0],nums[1],nums[2]);
}
function colorName(hex) {
  const {h,s,l}=hexToHsl(hex);
  if(l<13)return 'Near black'; if(l>92)return 'Soft white'; if(s<10)return l<50?'Slate gray':'Mist gray';
  const names=['Crimson','Tangerine','Amber','Chartreuse','Emerald','Seafoam','Cyan','Azure','Indigo','Violet','Magenta','Rose'];
  const base=names[Math.round(wrap(h)/30)%12];
  return `${l<34?'Deep ':l>72?'Light ':s<45?'Soft ':''}${base}`;
}
function showToast(message) { els.toast.textContent=message; els.toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>els.toast.classList.remove('show'),1600); }
function lockIcon(locked) {
  return locked
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12v10H6z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10V7a5 5 0 0 1 9.6-2M6 10h12v10H6z"/></svg>';
}
const pencilIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.5-1 10.7-10.7-3.5-3.5L5 15.5 4 20Z"/><path d="m13.8 6.7 3.5 3.5"/></svg>';
function setFormat(format){state.format=format;render();}
function setTheme(theme){
  document.documentElement.dataset.theme=theme;
  els.themeToggle.setAttribute('aria-pressed',String(theme==='dark'));
  els.themeToggle.setAttribute('aria-label',`Switch to ${theme==='dark'?'light':'dark'} theme`);
  els.themeToggle.title=`Switch to ${theme==='dark'?'light':'dark'} theme`;
  try{localStorage.setItem('cooleur-theme',theme);}catch{}
}

function render() {
  els.palette.innerHTML='';
  const buttonColor=state.colors.find(c=>!c.locked)?.hex||state.colors[0].hex;
  els.generate.style.background=buttonColor;
  els.generate.style.color=contrast(buttonColor);
  state.colors.forEach((color,index)=>{
    const ink=contrast(color.hex); const swatch=document.createElement('article');
    swatch.draggable=false; swatch.dataset.index=index;
    swatch.className=`swatch${color.locked?' locked':''}`; swatch.style.background=color.hex; swatch.style.color=ink;
    swatch.innerHTML=`
      <div class="swatch-rail" aria-label="Color actions">
        <button class="rail-button remove-button" type="button" aria-label="Remove color ${index+1}" title="Remove color">×</button>
        <button class="rail-button shades-button" type="button" aria-label="View shades for color ${index+1}" title="View shades"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18m-18 5h18"/></svg></button>
        <button class="rail-button favorite-button${color.favorite?' active':''}" type="button" aria-label="${color.favorite?'Unfavorite':'Favorite'} color ${index+1}" aria-pressed="${!!color.favorite}" title="${color.favorite?'Unfavorite':'Favorite'} color"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.2 5.2 0 0 0-7.4 0L12 6l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21l8.8-9a5.2 5.2 0 0 0 0-7.4Z"/></svg></button>
        <button class="rail-button drag-handle" type="button" aria-label="Drag color ${index+1} to reorder" title="Drag to reorder"><svg viewBox="0 0 24 24"><path d="M3 12h18m-18 0 4-4m-4 4 4 4m14-4-4-4m4 4-4 4"/></svg></button>
        <button class="rail-button copy-button" type="button" aria-label="Copy ${color.hex}" title="Copy HEX"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button>
        <button class="rail-button info-button" type="button" aria-label="Color ${index+1} information" title="Color information"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 10v6m0-9h.01"/></svg></button>
        <button class="rail-button lock-button" type="button" aria-label="${color.locked?'Unlock':'Lock'} color ${index+1}" aria-pressed="${color.locked}" title="${color.locked?'Unlock':'Lock'} color">${lockIcon(color.locked)}</button>
      </div>
      <button class="swatch-code" type="button" aria-label="Edit color ${index+1}, ${color.hex}" title="Change color">${color.hex}</button>`;
    swatch.querySelector('.lock-button').addEventListener('click',()=>{ color.locked=!color.locked; render(); });
    swatch.querySelector('.remove-button').addEventListener('click',()=>removeColor(index));
    swatch.querySelector('.swatch-code').addEventListener('click',e=>openColorEditor(index,e.currentTarget));
    swatch.querySelector('.shades-button').addEventListener('click',()=>{state.variation='luminance';els.variationView.hidden=false;els.palette.hidden=true;els.variations.setAttribute('aria-pressed','true');renderVariations();});
    swatch.querySelector('.favorite-button').addEventListener('click',()=>{color.favorite=!color.favorite;render();showToast(color.favorite?'Marked as favorite':'Favorite removed');});
    swatch.querySelector('.copy-button').addEventListener('click',async()=>{await navigator.clipboard?.writeText(color.hex);showToast(`${color.hex} copied`);});
    swatch.querySelector('.info-button').addEventListener('click',()=>{const rgb=hexToRgb(color.hex),hsl=hexToHsl(color.hex);showToast(`${color.hex} · RGB ${rgb.r}, ${rgb.g}, ${rgb.b} · HSL ${Math.round(hsl.h)}°, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%`);});
    swatch.querySelector('.drag-handle').addEventListener('pointerdown',()=>{swatch.draggable=true;});
    swatch.addEventListener('dragstart',e=>{if(!swatch.draggable){e.preventDefault();return;}draggedIndex=index;swatch.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(index));});
    swatch.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';swatch.classList.add('drop-target');});
    swatch.addEventListener('dragleave',()=>swatch.classList.remove('drop-target'));
    swatch.addEventListener('drop',e=>{e.preventDefault();swatch.classList.remove('drop-target');moveColor(draggedIndex,index);});
    swatch.addEventListener('dragend',()=>{draggedIndex=-1;swatch.draggable=false;swatch.classList.remove('dragging');document.querySelectorAll('.drop-target').forEach(x=>x.classList.remove('drop-target'));});
    let touchStart=null;
    swatch.addEventListener('touchstart',e=>{if(e.target.closest('button, input'))return;const t=e.changedTouches[0];touchStart={x:t.clientX,y:t.clientY};},{passive:true});
    swatch.addEventListener('touchend',e=>{if(!touchStart)return;const t=e.changedTouches[0];const moved=Math.hypot(t.clientX-touchStart.x,t.clientY-touchStart.y);touchStart=null;if(moved<24)return;const target=document.elementFromPoint(t.clientX,t.clientY)?.closest('.swatch');if(target)moveColor(index,Number(target.dataset.index));},{passive:true});
    els.palette.appendChild(swatch);
  });
  const locked=state.colors.filter(c=>c.locked).length;
  els.status.textContent=`${state.colors.length} colors · ${locked} locked`;
  els.add.disabled=state.colors.length>=MAX_COLORS;
  if(!els.variationView.hidden) renderVariations();
}

let draggedIndex=-1;
let editingIndex=-1;
function hexToHsv(hex){const {r,g,b}=hexToRgb(hex),max=Math.max(r,g,b)/255,min=Math.min(r,g,b)/255,d=max-min;let h=0;if(d){if(max===r/255)h=((g-b)/255/d)%6;else if(max===g/255)h=(b-r)/255/d+2;else h=(r-g)/255/d+4;}return {h:wrap(h*60),s:max?d/max:0,v:max};}
function hsvToHex(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;const parts=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return rgbToHex(...parts.map(n=>(n+m)*255));}
function editorText(hex){const rgb=hexToRgb(hex),hsl=hexToHsl(hex);return els.editorFormat.value==='rgb'?`${rgb.r}, ${rgb.g}, ${rgb.b}`:els.editorFormat.value==='hsl'?`${Math.round(hsl.h)}°, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%`:hex.slice(1);}
function positionEditor(anchor){const r=anchor.getBoundingClientRect(),w=326,h=390;els.editor.style.left=`${clamp(r.left,8,innerWidth-w-8)}px`;els.editor.style.top=`${r.top>h+12?r.top-h-8:Math.min(r.bottom+8,innerHeight-h-8)}px`;}
function refreshEditor(syncText=true){if(editingIndex<0)return;const hex=state.colors[editingIndex].hex,hsv=hexToHsv(hex);els.colorPlane.style.setProperty('--hue',hsv.h);document.querySelector('#planeThumb').style.left=`${hsv.s*100}%`;document.querySelector('#planeThumb').style.top=`${(1-hsv.v)*100}%`;els.editorHue.value=Math.round(hsv.h);document.querySelector('#editorPreview').style.background=hex;document.querySelector('#editorPrefix').hidden=els.editorFormat.value!=='hex';if(syncText)els.editorValue.value=editorText(hex);}
function openColorEditor(index,anchor){editingIndex=index;els.editor.hidden=false;els.editorFormat.value=state.format;refreshEditor();positionEditor(anchor);els.editorValue.focus();els.editorValue.select();}
function closeColorEditor(){if(editingIndex<0)return;editingIndex=-1;els.editor.hidden=true;els.editorValue.blur();}
function updateEditedColor(hex){if(editingIndex<0)return;const c=state.colors[editingIndex];c.hex=hex.toUpperCase();state.baseColors=state.colors.map(x=>x.hex);const swatch=els.palette.children[editingIndex];swatch.style.background=c.hex;swatch.style.color=contrast(c.hex);swatch.querySelector('.swatch-code').textContent=c.hex;swatch.querySelector('.swatch-code').setAttribute('aria-label',`Edit color ${editingIndex+1}, ${c.hex}`);const buttonColor=state.colors.find(x=>!x.locked)?.hex||state.colors[0].hex;els.generate.style.background=buttonColor;els.generate.style.color=contrast(buttonColor);refreshEditor();}
function commitEditor(){if(editingIndex<0)return;const raw=els.editorValue.value;const next=parseColor(els.editorFormat.value==='hex'?`#${raw.replace(/^#/, '')}`:raw);if(!next){showToast('Enter a valid color value');els.editorValue.focus();return;}updateEditedColor(next);closeColorEditor();render();}
els.editorValue.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitEditor();}if(e.key==='Escape'){e.preventDefault();closeColorEditor();}});
els.editorFormat.addEventListener('change',e=>{state.format=e.target.value;refreshEditor();els.editorValue.focus();els.editorValue.select();});
document.querySelector('#closeColorEditor').addEventListener('click',closeColorEditor);
document.querySelector('#editorCopy').addEventListener('click',async()=>{if(editingIndex<0)return;await navigator.clipboard?.writeText(state.colors[editingIndex].hex);showToast('Color copied');});
els.editorHue.addEventListener('input',e=>{if(editingIndex<0)return;const hsv=hexToHsv(state.colors[editingIndex].hex);updateEditedColor(hsvToHex(Number(e.target.value),hsv.s,hsv.v));});
function setPlaneColor(e){if(editingIndex<0)return;const r=els.colorPlane.getBoundingClientRect(),s=clamp((e.clientX-r.left)/r.width,0,1),v=1-clamp((e.clientY-r.top)/r.height,0,1);updateEditedColor(hsvToHex(Number(els.editorHue.value),s,v));}
els.colorPlane.addEventListener('pointerdown',e=>{els.colorPlane.setPointerCapture(e.pointerId);setPlaneColor(e);});
els.colorPlane.addEventListener('pointermove',e=>{if(e.buttons)setPlaneColor(e);});
els.colorPlane.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||editingIndex<0)return;e.preventDefault();const hsv=hexToHsv(state.colors[editingIndex].hex);hsv.s=clamp(hsv.s+(e.key==='ArrowRight'?.02:e.key==='ArrowLeft'?-.02:0),0,1);hsv.v=clamp(hsv.v+(e.key==='ArrowUp'?.02:e.key==='ArrowDown'?-.02:0),0,1);updateEditedColor(hsvToHex(hsv.h,hsv.s,hsv.v));});
document.addEventListener('pointerdown',e=>{if(!els.editor.hidden&&!e.target.closest('#colorEditor,.swatch-code'))closeColorEditor();});
function moveColor(from,to){
  if(from<0||from===to)return;
  const [color]=state.colors.splice(from,1);state.colors.splice(to,0,color);
  const [base]=state.baseColors.splice(from,1);state.baseColors.splice(to,0,base);
  render();showToast(`Color moved to position ${to+1}`);
}

function setColor(index, hex) { state.colors[index].hex=hex.toUpperCase(); state.baseColors=state.colors.map(c=>c.hex); resetAdjustmentValues(false); render(); }
function removeColor(index) { if(state.colors.length<=MIN_COLORS){showToast('A palette needs at least two colors');return;} state.colors.splice(index,1); state.baseColors=state.colors.map(c=>c.hex); render(); }
function addColor() {
  if(state.colors.length>=MAX_COLORS)return;
  const last=hexToHsl(state.colors.at(-1).hex); const hex=hslToHex(last.h+35,last.s,clamp(last.l+((state.colors.length%2)?8:-8),22,80));
  state.colors.push({id:crypto.randomUUID?.()||String(Date.now()),hex,locked:false}); state.baseColors=state.colors.map(c=>c.hex); render();
}

function shuffle(values) {
  const result=[...values];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
function hueDistance(a,b){const d=Math.abs(wrap(a)-wrap(b));return Math.min(d,360-d);}
function generatedHues(mode, anchorHue, count) {
  if(mode==='balanced') {
    const step=360/(count+1), phase=(Math.random()-.5)*step*.65;
    return shuffle(Array.from({length:count},(_,i)=>wrap(anchorHue+(i+1)*step+phase+(Math.random()-.5)*step*.6)));
  }
  if(mode==='monochromatic') return Array.from({length:count},()=>wrap(anchorHue+(Math.random()-.5)*12));
  if(mode==='analogous') {
    const direction=Math.random()<.5?-1:1, spread=70+Math.random()*55;
    return shuffle(Array.from({length:count},(_,i)=>wrap(anchorHue+direction*(12+(i+1)/(count+1)*spread)+(Math.random()-.5)*10)));
  }
  const families={complementary:[0,180],triadic:[0,120,240],tetradic:[0,60,180,240],square:[0,90,180,270]}[mode];
  const rotation=Math.floor(Math.random()*families.length);
  return shuffle(Array.from({length:count},(_,i)=>wrap(anchorHue+families[(i+rotation)%families.length]+(Math.random()-.5)*24)));
}

function generatePalette() {
  const locked=state.colors.filter(c=>c.locked), free=state.colors.filter(c=>!c.locked);
  if(!free.length){showToast('Unlock a color to generate a new palette');return;}
  const anchor=locked.length?hexToHsl(locked[Math.floor(Math.random()*locked.length)].hex):{h:Math.random()*360,s:55+Math.random()*25,l:45+Math.random()*20};
  const hues=generatedHues(state.harmony,anchor.h,free.length);
  const lightnessOrder=shuffle(Array.from({length:free.length},(_,i)=>i));
  free.forEach((c,i)=>{
    let hue=hues[i];
    if(state.harmony==='balanced' && hueDistance(hue,hexToHsl(c.hex).h)<22)hue=wrap(hue+30+Math.random()*35);
    const saturation=clamp(anchor.s+(Math.random()-.5)*34,38,88);
    const lightness=state.harmony==='monochromatic'
      ? clamp(23+lightnessOrder[i]*58/Math.max(free.length-1,1)+(Math.random()-.5)*8,20,86)
      : clamp(anchor.l+(Math.random()-.5)*38,27,78);
    c.hex=hslToHex(hue,saturation,lightness);
  });
  state.baseColors=state.colors.map(c=>c.hex); resetAdjustmentValues(false); render(); showToast(locked.length?'Palette generated around locked colors':'New palette generated');
}

function resetAdjustmentValues(shouldRender=true) {
  state.adjustments={hue:0,saturation:0,brightness:0,temperature:0};
  ['hue','saturation','brightness','temperature'].forEach(k=>document.querySelector(`#${k}Slider`).value=0);
  updateOutputs(); if(shouldRender)render();
}
function updateOutputs(){
  document.querySelector('#hueOutput').value=`${state.adjustments.hue}°`;
  document.querySelector('#saturationOutput').value=state.adjustments.saturation>0?`+${state.adjustments.saturation}`:state.adjustments.saturation;
  document.querySelector('#brightnessOutput').value=state.adjustments.brightness>0?`+${state.adjustments.brightness}`:state.adjustments.brightness;
  const t=state.adjustments.temperature; document.querySelector('#temperatureOutput').value=t===0?'Neutral':t>0?`Warm +${t}`:`Cool ${t}`;
}
function applyAdjustments() {
  state.colors.forEach((c,i)=>{
    if(c.locked)return;
    const hsl=hexToHsl(state.baseColors[i]||c.hex), temp=state.adjustments.temperature;
    const target=temp>0?35:215; const blend=Math.abs(temp)/60;
    const delta=((target-hsl.h+540)%360)-180;
    c.hex=hslToHex(hsl.h+state.adjustments.hue+delta*blend*.28, hsl.s+state.adjustments.saturation, hsl.l+state.adjustments.brightness);
  }); updateOutputs(); render();
}

function variationHex(base,row,type){
  const hsl=hexToHsl(base), t=row/10;
  if(type==='saturation')return hslToHex(hsl.h,100-(t*100),hsl.l);
  if(type==='temperature'){const target=t<.5?215:35,amount=Math.abs(t-.5)*1.5,delta=((target-hsl.h+540)%360)-180;return hslToHex(hsl.h+delta*amount,hsl.s,clamp(hsl.l+(0.5-Math.abs(t-.5))*8));}
  return hslToHex(hsl.h,hsl.s,96-t*84);
}
function renderVariations(){
  els.variationGrid.style.setProperty('--columns',state.colors.length); els.variationGrid.innerHTML='';
  state.colors.forEach((c,col)=>{
    const column=document.createElement('div'); column.className='variation-column';
    for(let row=0;row<11;row++){const hex=variationHex(c.hex,row,state.variation);const b=document.createElement('button');b.className='variation-chip';b.style.background=hex;b.style.color=contrast(hex);b.textContent=hex.slice(1);b.title=`Use ${hex}`;b.addEventListener('click',()=>{setColor(col,hex);showToast(`${hex} applied`);});column.appendChild(b);}
    els.variationGrid.appendChild(column);
  });
}

function svgMarkup(){
  const w=1440,h=900,bar=w/state.colors.length;
  const rects=state.colors.map((c,i)=>`<rect x="${i*bar}" width="${bar+1}" height="${h}" fill="${c.hex}"/><text x="${i*bar+bar/2}" y="${h-60}" text-anchor="middle" fill="${contrast(c.hex)}" font-family="Arial,sans-serif" font-size="28" font-weight="700">${c.hex}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>Cooleur palette</title>${rects}</svg>`;
}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
function exportSvg(){download(new Blob([svgMarkup()],{type:'image/svg+xml'}),'cooleur-palette.svg');showToast('SVG exported');}
function exportPng(){
  const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=900;const ctx=canvas.getContext('2d'),bar=canvas.width/state.colors.length;
  state.colors.forEach((c,i)=>{ctx.fillStyle=c.hex;ctx.fillRect(i*bar,0,bar+1,canvas.height);ctx.fillStyle=contrast(c.hex);ctx.font='700 28px Arial';ctx.textAlign='center';ctx.fillText(c.hex,i*bar+bar/2,canvas.height-60);});
  canvas.toBlob(blob=>{download(blob,'cooleur-palette.png');showToast('PNG exported');},'image/png');
}

els.generate.addEventListener('click',generatePalette); els.add.addEventListener('click',addColor);
function closeHarmonyMenu(){els.harmonyMenu.hidden=true;els.harmonyTrigger.setAttribute('aria-expanded','false');}
function setHarmony(mode){
  if(!schemes[mode])return;
  state.harmony=mode;els.harmony.value=mode;
  els.harmonyLabel.textContent=els.harmony.selectedOptions[0].textContent;
  els.harmonyMenu.querySelectorAll('[data-harmony]').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.harmony===mode)));
  closeHarmonyMenu();els.harmonyTrigger.blur();generatePalette();
}
els.harmonyTrigger.addEventListener('click',()=>{
  const opening=els.harmonyMenu.hidden;els.harmonyMenu.hidden=!opening;
  els.harmonyTrigger.setAttribute('aria-expanded',String(opening));
  if(opening)els.harmonyMenu.querySelector('[aria-selected="true"]').focus();
});
els.harmonyMenu.addEventListener('click',e=>{const option=e.target.closest('[data-harmony]');if(option)setHarmony(option.dataset.harmony);});
els.harmonyMenu.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();closeHarmonyMenu();els.harmonyTrigger.focus();return;}
  if(!['ArrowDown','ArrowUp'].includes(e.key))return;
  e.preventDefault();const options=[...els.harmonyMenu.querySelectorAll('[data-harmony]')];
  options[(options.indexOf(document.activeElement)+(e.key==='ArrowDown'?1:options.length-1))%options.length].focus();
});
els.harmony.addEventListener('change',e=>setHarmony(e.target.value));
els.themeToggle.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
['hue','saturation','brightness','temperature'].forEach(k=>document.querySelector(`#${k}Slider`).addEventListener('input',e=>{state.adjustments[k]=Number(e.target.value);applyAdjustments();}));
els.reset.addEventListener('click',()=>{state.colors.forEach((c,i)=>{if(!c.locked)c.hex=state.baseColors[i]||c.hex});resetAdjustmentValues();});
els.variations.addEventListener('click',()=>{els.variationView.hidden=!els.variationView.hidden;els.palette.hidden=!els.variationView.hidden;els.variations.setAttribute('aria-pressed',!els.variationView.hidden);if(!els.variationView.hidden)renderVariations();els.variations.blur();});
els.closeDialog.addEventListener('click',()=>{els.variationView.hidden=true;els.palette.hidden=false;els.variations.setAttribute('aria-pressed','false');els.closeDialog.blur();});
els.adjustmentsButton.addEventListener('click',()=>{els.adjustmentsPanel.hidden=!els.adjustmentsPanel.hidden;document.querySelector('#workspace').classList.toggle('tuning',!els.adjustmentsPanel.hidden);els.adjustmentsButton.setAttribute('aria-pressed',!els.adjustmentsPanel.hidden);els.adjustmentsButton.blur();});
els.closeAdjustments.addEventListener('click',()=>{els.adjustmentsPanel.hidden=true;document.querySelector('#workspace').classList.remove('tuning');els.adjustmentsButton.setAttribute('aria-pressed','false');els.closeAdjustments.blur();});
document.querySelector('.variation-tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;state.variation=b.dataset.variation;document.querySelectorAll('.variation-tabs button').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-selected',x===b)});renderVariations();});
els.exportButton.addEventListener('click',()=>{const open=els.exportMenu.hidden;els.exportMenu.hidden=!open;els.exportButton.setAttribute('aria-expanded',open);});
els.exportMenu.addEventListener('click',e=>{const type=e.target.dataset.export;if(!type)return;type==='svg'?exportSvg():exportPng();els.exportMenu.hidden=true;els.exportButton.setAttribute('aria-expanded','false');});
document.addEventListener('click',e=>{if(!e.target.closest('.export-wrap')){els.exportMenu.hidden=true;els.exportButton.setAttribute('aria-expanded','false');}if(!e.target.closest('.mode-control'))closeHarmonyMenu();});
document.addEventListener('keydown',e=>{
  if(e.code!=='Space'||e.repeat)return;
  const focused=document.activeElement;
  if(focused.matches('input, textarea, [contenteditable="true"]'))return;
  e.preventDefault();closeHarmonyMenu();focused.blur();generatePalette();
},true);

function registerWebMcp(){
  const context=document.modelContext;if(!context?.registerTool)return;
  const register=(tool)=>{try{Promise.resolve(context.registerTool(tool)).catch(()=>{});}catch{}}
  register({name:'generate_color_palette',title:'Generate color palette',description:'Generate a new visible palette using a named harmony while preserving locked colors.',inputSchema:{type:'object',properties:{harmony:{type:'string',enum:Object.keys(schemes)}},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(input?.harmony){state.harmony=input.harmony;els.harmony.value=input.harmony;els.harmonyLabel.textContent=els.harmony.selectedOptions[0].textContent;els.harmonyMenu.querySelectorAll('[data-harmony]').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.harmony===input.harmony)));}generatePalette();return{colors:state.colors.map(c=>c.hex),harmony:state.harmony};}});
  register({name:'set_locked_colors',title:'Set locked colors',description:'Set and lock one or more HEX colors in the visible palette.',inputSchema:{type:'object',properties:{colors:{type:'array',items:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'},minItems:1,maxItems:10}},required:['colors'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!Array.isArray(input.colors)||!input.colors.length)throw new Error('At least one HEX color is required');input.colors.forEach((hex,i)=>{if(i<state.colors.length){state.colors[i].hex=hex.toUpperCase();state.colors[i].locked=true;}else if(state.colors.length<MAX_COLORS)state.colors.push({id:String(Date.now()+i),hex:hex.toUpperCase(),locked:true});});state.baseColors=state.colors.map(c=>c.hex);render();return{colors:state.colors.map(c=>({hex:c.hex,locked:c.locked}))};}});
}

try{setTheme(localStorage.getItem('cooleur-theme')==='dark'?'dark':'light');}catch{setTheme('light');}
render(); registerWebMcp();
