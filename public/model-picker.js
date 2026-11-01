/* Model selector. Every choice is validated by executing a real AI probe before saving. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
let catalog=[],selected='',ready=false,loading=false;
const feedback=(id,msg)=>{const e=$(id);if(e)e.textContent=String(msg||'');};
const chooseCost=(id)=>{
 const model=catalog.find(m=>m.id===id);
 const paid=!!model?.paidOnly;
 const wrap=$('cf-paid-ack-wrap');if(wrap)wrap.hidden=!paid;
 if($('cf-paid-ack'))$('cf-paid-ack').checked=false;
 feedback('cf-model-pricing',paid?'Atenção: este modelo exige faturamento ou créditos no AI Gateway. O teste poderá gerar cobrança.':model?'Modelo Cloudflare hospedado. Sujeito ao limite de 10.000 neurons gratuitos por dia; a demanda varia por modelo.':'Modelo personalizado: disponibilidade e exigência de pagamento serão verificadas ao testar.');
};
function fill(response){
 const models=response?.cloudflare?.models||[];
 catalog=models;
 const options=$('cf-model-options');if(!options)return;
 options.replaceChildren();
 for(const m of models){
  const option=document.createElement('option');option.value=m.id;
  option.textContent=m.name+' · '+m.use+(m.paidOnly?' · PAGO':'');
  options.append(option);
 }
 const extra=document.createElement('option');extra.value='__custom__';extra.textContent='Outro modelo… (digitar ID)';options.append(extra);
 selected=response.cloudflare?.selected||'@cf/zai-org/glm-4.7-flash';
 options.value=models.some(x=>x.id===selected)?selected:'__custom__';
 $('cf-custom-model').value=selected;
 $('nv-custom-model').value=response.nvidia?.selected||'';
 chooseCost(selected);
 feedback('cf-model-feedback','Modelo atual: '+selected);
 feedback('nv-model-feedback','NVIDIA: '+(response.nvidia?.selected||'não configurado'));
}
async function read(){
 if(loading||typeof authValidated==='undefined'||!authValidated)return;
 loading=true;
 try{fill(await api('/models'));ready=true;}
 catch(e){feedback('cf-model-feedback','Não foi possível consultar modelos: '+e.message);}
 finally{loading=false;}
}
async function save(provider){
 if(typeof authValidated==='undefined'||!authValidated)return;
 const isCF=provider==='cloudflare';
 const model=$(isCF?'cf-custom-model':'nv-custom-model')?.value.trim();
 const button=$(isCF?'cf-model-save':'nv-model-save'),target=isCF?'cf-model-feedback':'nv-model-feedback';
 if(!model){feedback(target,'Digite ou selecione um modelo.');return;}
 const selectedItem=catalog.find(x=>x.id===model);
 const billable=!!selectedItem?.paidOnly;
 if(billable&&!$('cf-paid-ack')?.checked){feedback(target,'Marque a confirmação de modelo que exige faturamento antes de testar.');return;}
 if(!isCF&&!state?.hasNvidia){feedback(target,'Conecte primeiro a chave da NVIDIA na seção abaixo.');return;}
 button.disabled=true;
 feedback(target,'Testando '+model+' com uma chamada real…');
 try{
  const answer=await api('/models/select',{method:'POST',body:{provider,model,allowPaid:billable}});
  feedback(target,'Modelo ativo: '+answer.model+' · teste bem-sucedido. Próximas respostas usarão este provedor.');
  if(isCF){selected=model;chooseCost(model);$('cf-paid-ack-wrap').hidden=true;}
  await refresh(); // Updates the active provider in dashboard and chat.
 }catch(e){feedback(target,'Não ativado. '+e.message+' O modelo anterior continua ativo.');}
 finally{button.disabled=false;}
}
$('cf-model-options')?.addEventListener('change',e=>{
 const value=e.target.value;
 if(value==='__custom__'){$('cf-custom-model').value='';$('cf-custom-model').focus();}
 else $('cf-custom-model').value=value;
 chooseCost(value);
});
$('cf-custom-model')?.addEventListener('input',e=>{
 const value=e.target.value.trim();
 $('cf-model-options').value=catalog.some(m=>m.id===value)?value:'__custom__';
 chooseCost(value);
});
$('cf-model-save')?.addEventListener('click',()=>{void save('cloudflare')});
$('nv-model-save')?.addEventListener('click',()=>{void save('nvidia')});
document.querySelectorAll('.nav[data-section="settings"]').forEach(e=>e.addEventListener('click',()=>{void read()}));
$('model-quick-open')?.addEventListener('click',()=>{
 document.querySelector('.nav[data-section="settings"]')?.click();
 $('vini-model-picker')?.scrollIntoView({behavior:'smooth',block:'start'});
 void read();
});
const ticker=setInterval(()=>{if(!ready&&typeof authValidated!=='undefined'&&authValidated)void read();},4000);
window.addEventListener('pagehide',()=>clearInterval(ticker));
window.viniModelPicker={open:()=>{$('model-quick-open')?.click();},refresh:read};
})();