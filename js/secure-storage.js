/* KerjaDesa Secure Offline Vault V34
 * Encrypts the main offline work dataset before persistent browser storage.
 * AES-256-GCM + non-extractable Web Crypto key stored in IndexedDB.
 * This is defense-in-depth; XSS in the same origin can still access live data.
 */
(function(){
  'use strict';

  const DB_NAME='KerjaDesaSecureVault';
  const DB_VERSION=1;
  const KEY_STORE='keys';
  const DATA_STORE='payloads';
  const KEY_ID='app-data-v1';
  const DATA_ID='app-data-v1';
  const encoder=new TextEncoder();
  const decoder=new TextDecoder();
  let writeQueue=Promise.resolve();

  function openDb(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB) return reject(new Error('IndexedDB tidak tersedia pada browser ini.'));
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(KEY_STORE))db.createObjectStore(KEY_STORE,{keyPath:'id'});
        if(!db.objectStoreNames.contains(DATA_STORE))db.createObjectStore(DATA_STORE,{keyPath:'id'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Gagal membuka penyimpanan aman.'));
    });
  }

  function tx(store,mode,action){
    return openDb().then(db=>new Promise((resolve,reject)=>{
      const t=db.transaction(store,mode),s=t.objectStore(store);
      let req;
      try{req=action(s)}catch(e){db.close();reject(e);return}
      req.onsuccess=()=>{const v=req.result;db.close();resolve(v)};
      req.onerror=()=>{const e=req.error||new Error('Operasi penyimpanan gagal.');db.close();reject(e)};
    }));
  }

  async function getKey(){
    let row=await tx(KEY_STORE,'readonly',s=>s.get(KEY_ID));
    if(row?.key)return row.key;
    const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    await tx(KEY_STORE,'readwrite',s=>s.put({id:KEY_ID,key}));
    return key;
  }

  function bytesToB64(bytes){
    let bin='';for(const b of bytes)bin+=String.fromCharCode(b);
    return btoa(bin);
  }
  function b64ToBytes(value){
    const bin=atob(value),out=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
    return out;
  }

  async function encryptObject(value){
    const key=await getKey();
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const plain=encoder.encode(JSON.stringify(value));
    const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);
    return {v:1,alg:'AES-256-GCM',iv:bytesToB64(iv),ciphertext:bytesToB64(new Uint8Array(cipher)),updatedAt:new Date().toISOString()};
  }

  async function decryptObject(record){
    if(!record?.ciphertext||!record?.iv)throw new Error('Payload penyimpanan aman tidak valid.');
    const key=await getKey();
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(record.iv)},key,b64ToBytes(record.ciphertext));
    return JSON.parse(decoder.decode(plain));
  }

  async function readPayload(){
    return tx(DATA_STORE,'readonly',s=>s.get(DATA_ID));
  }

  async function load(fallback){
    const payload=await readPayload();
    if(payload)return decryptObject(payload);
    const legacy=localStorage.getItem('kerjadesa');
    if(legacy){
      let parsed;
      try{parsed=JSON.parse(legacy)}catch(e){throw new Error('Data lokal lama tidak dapat dibaca.')}
      await save(parsed);
      try{localStorage.removeItem('kerjadesa')}catch(e){}
      return parsed;
    }
    return fallback;
  }

  function save(value){
    writeQueue=writeQueue.then(async()=>{
      const payload=await encryptObject(value);
      await tx(DATA_STORE,'readwrite',s=>s.put({id:DATA_ID,...payload}));
      try{localStorage.removeItem('kerjadesa')}catch(e){}
      return true;
    });
    return writeQueue;
  }

  async function status(){
    try{
      const payload=await readPayload();
      const legacy=!!localStorage.getItem('kerjadesa');
      return {available:true,encrypted:!!payload,legacy,algorithm:payload?.alg||'AES-256-GCM',updatedAt:payload?.updatedAt||null};
    }catch(e){
      return {available:false,encrypted:false,legacy:!!localStorage.getItem('kerjadesa'),error:e.message};
    }
  }

  async function clearData(){
    await tx(DATA_STORE,'readwrite',s=>s.delete(DATA_ID));
    try{localStorage.removeItem('kerjadesa')}catch(e){}
    return true;
  }

  window.KerjaDesaSecureStorage={version:'V34',load,save,status,clearData};
})();
