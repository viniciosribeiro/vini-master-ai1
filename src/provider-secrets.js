// Chave NVIDIA cifrada com AES-GCM usando uma chave derivada do MASTER_TOKEN.
 // Nunca retornar segredo ou texto cifrado à interface.
const encoder=new TextEncoder();
const as64=bytes=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
const un64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function keyFor(master,salt){
 const root=await crypto.subtle.importKey('raw',encoder.encode(master),'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt,info:encoder.encode('vini-master-nvidia-v1')},root,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function hasStoredNvidia(db){
 if(!db)return false;
 return !!(await db.prepare("SELECT name FROM provider_credentials WHERE name='nvidia'").first());
}
export async function storeNvidia(env,secret){
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await keyFor(env.MASTER_TOKEN,salt);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(secret));
 await env.DB.prepare("INSERT INTO provider_credentials(name,salt,iv,ciphertext) VALUES('nvidia',?,?,?) ON CONFLICT(name) DO UPDATE SET salt=excluded.salt,iv=excluded.iv,ciphertext=excluded.ciphertext,created_at=CURRENT_TIMESTAMP")
  .bind(as64(salt),as64(iv),as64(new Uint8Array(encrypted))).run();
}
export async function loadNvidia(env){
 if(env.NVIDIA_API_KEY)return env.NVIDIA_API_KEY;
 if(!env.DB||!env.MASTER_TOKEN)return null;
 const record=await env.DB.prepare("SELECT salt,iv,ciphertext FROM provider_credentials WHERE name='nvidia'").first();
 if(!record)return null;
 try{
  const key=await keyFor(env.MASTER_TOKEN,un64(record.salt));
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(record.iv)},key,un64(record.ciphertext));
  return new TextDecoder().decode(plain);
 }catch{throw Error('Chave NVIDIA protegida não pode ser aberta. Refaça a conexão na tela de Configurações.');}
}
export async function removeNvidia(env){
 await env.DB.prepare("DELETE FROM provider_credentials WHERE name='nvidia'").run();
}
