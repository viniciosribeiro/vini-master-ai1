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
  alert('No Chrome do Android, abra o menu ⋮ e escolha Instalar aplicativo ou Adicionar à tela inicial.');
 });
 if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
 // Open shortcuts only after the application scripts have loaded.
 if(location.search.includes('tab=projects'))window.addEventListener('load',()=>document.querySelector('.nav[data-section="projects"]')?.click());
 if(location.search.includes('tab=chat'))window.addEventListener('load',()=>document.querySelector('.nav[data-section="chat"]')?.click());
})();