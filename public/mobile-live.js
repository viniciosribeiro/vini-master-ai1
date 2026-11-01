// Mobile view for the already deployed Cloudflare dashboard. The authoritative statuses remain in D1.
const locations={supervisor:'380 100 355 265',programador:'70 172 330 215',designer:'740 173 310 215',qa:'60 350 340 215',infra:'397 348 325 225',pesquisa:'752 347 325 230'};
for(const station of document.querySelectorAll('.station[data-agent]')){
 const crop=locations[station.dataset.agent];if(!crop)continue;
 const art=document.createElement('div');art.className='station-art';
 art.innerHTML=`<svg viewBox="${crop}" role="img" aria-label="Escritório do agente"><image href="/office.svg" width="1120" height="590"/></svg>`;
 station.append(art);
 station.addEventListener('click',event=>{
  if(window.innerWidth>780)return;
  event.stopImmediatePropagation();event.preventDefault();
  if(typeof detailAgent==='function')detailAgent(station.dataset.agent);
  const detail=document.getElementById('agent-detail')?.textContent||'Sem dados deste agente.';
  if(typeof show==='function')show('office');
  const sheet=document.getElementById('mobile-agent-sheet');if(!sheet)return;
  sheet.querySelector('.sheet-name').textContent=station.querySelector('.station-label b')?.textContent||'Agente';
  sheet.querySelector('.actual-detail').textContent=detail;
  const visual=sheet.querySelector('.agent-preview');visual.innerHTML=art.innerHTML;
  sheet.showModal();
 },true);
}
const sheet=document.createElement('dialog');sheet.id='mobile-agent-sheet';sheet.className='agent-sheet';sheet.innerHTML='<div class="sheet-head"><h2 class="sheet-name">Agente</h2><button type="button" class="close" aria-label="Fechar detalhes">×</button></div><div class="agent-preview"></div><div class="actual-detail"></div>';
document.body.append(sheet);sheet.querySelector('.close').addEventListener('click',()=>sheet.close());sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});
const gear=document.createElement('button');gear.type='button';gear.className='mobile-settings';gear.setAttribute('aria-label','Configurações');gear.textContent='⚙';document.querySelector('.top-actions')?.append(gear);
const engines=document.querySelector('.engines');const settings=document.querySelector('#section-settings .padded');
function adapt(){if(window.innerWidth<=780){if(engines&&settings&&!settings.contains(engines))settings.append(engines);}else{const bottom=document.querySelector('#section-office .bottom');if(engines&&bottom&&!bottom.contains(engines))bottom.append(engines);}}
adapt();window.addEventListener('resize',adapt);
gear.addEventListener('click',()=>document.querySelector('.nav[data-section="settings"]')?.click());
const mission=document.createElement('button');mission.type='button';mission.className='mobile-new-mission';mission.textContent='+ Nova missão';document.body.append(mission);
mission.addEventListener('click',()=>{document.querySelector('.nav[data-section="missions"]')?.click();setTimeout(()=>document.getElementById('mission-description')?.focus({preventScroll:true}),50)});
const navObserver=new MutationObserver(()=>{mission.hidden=!!document.querySelector('.nav.active:not([data-section="office"])');});navObserver.observe(document.querySelector('.sidebar nav'),{attributes:true,subtree:true,attributeFilter:['class']});
