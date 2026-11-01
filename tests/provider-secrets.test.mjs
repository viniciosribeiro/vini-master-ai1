import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {hasStoredNvidia,storeNvidia,loadNvidia,removeNvidia} from '../src/provider-secrets.js';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
function mockDB(){
 let data;
 return {
   prepare(sql){
     return {
       bind(...args){
         return {
           async run(){
             if(sql.includes('INSERT INTO provider_credentials'))data={salt:args[0],iv:args[1],ciphertext:args[2]};
             if(sql.includes('DELETE FROM provider_credentials'))data=undefined;
             return {success:true};
           }
         };
       },
       async first(){return data?sql.includes('SELECT name')?{name:'nvidia'}:data:null;},
       async run(){data=undefined;return {success:true};}
     };
   },
   get() {return data;}
 };
}
test('NVIDIA key is encrypted in D1, survives reload, and can be removed',async()=>{
 const DB=mockDB();
 const env={MASTER_TOKEN:'c'.repeat(48),DB};
 assert.equal(await hasStoredNvidia(DB),false);
 await storeNvidia(env,'nvapi-test-example-secret-0123456789');
 assert.equal(await hasStoredNvidia(DB),true);
 assert.ok(!JSON.stringify(DB.get()).includes('nvapi-test'));
 assert.equal(await loadNvidia(env),'nvapi-test-example-secret-0123456789');
 await removeNvidia(env);
 assert.equal(await loadNvidia(env),null);
});
test('Wrong master key cannot decrypt NVIDIA credential',async()=>{
 const DB=mockDB();
 await storeNvidia({DB,MASTER_TOKEN:'x'.repeat(40)},'nvapi-test-example-secret-0123456789');
 await assert.rejects(loadNvidia({DB,MASTER_TOKEN:'y'.repeat(40)}),/Refaça a conexão/);
});
