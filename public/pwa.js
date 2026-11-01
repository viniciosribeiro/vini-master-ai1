// Installable Android app, never caches API credentials or private responses.
(function(){
 const button=document.getElementById('install-vini');
 let deferred=null;
 function installed(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
 function update(){button.hidden=installed();}
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;update();});
 window.addEventListener('appinstalled',()=>{deferred=null;update();});
 update();
 button.addEventListener('click',async()=>{
  if(deferred){const prompt=deferred;deferred=null;await prompt.prompt();try{await prompt.userChoice;}catch{}return;}
  alert('Para instalar no Android: abra este endereço no Chrome, toque no menu ⋮ e escolha Instalar aplicativo ou Adicionar à tela inicial. A IA precisa de internet.');
 });
 if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
 const banner=document.createElement('div');banner.id='jarvis-network-status';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.hidden=true;banner.textContent='Sem internet: chat, IA e projetos precisam de conexão.';document.body.append(banner);
 function updateNetwork(){banner.hidden=navigator.onLine!==false;}
 window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);updateNetwork();
 // Open shortcuts only after the application scripts have loaded.
 if(location.search.includes('tab=projects'))window.addEventListener('load',()=>document.querySelector('.nav[data-section="projects"]')?.click());
 if(location.search.includes('tab=chat'))window.addEventListener('load',()=>document.querySelector('.nav[data-section="chat"]')?.click());
})();