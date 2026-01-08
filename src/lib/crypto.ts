
const DB_NAME = 'enterprise_chat_crypto';
const STORE_NAME = 'keys';

async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function generateUserKeyPair(): Promise<string> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['wrapKey', 'unwrapKey']
  );

  const publicKeyJWK = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(keyPair.privateKey, 'privateKey');
  
  return JSON.stringify(publicKeyJWK);
}

export async function getPrivateKey(): Promise<CryptoKey | null> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  return new Promise((resolve) => {
    const request = tx.objectStore(STORE_NAME).get('privateKey');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

export async function importPublicKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['wrapKey']
  );
}

export async function generateChannelKey(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function wrapChannelKey(channelKey: CryptoKey, publicKey: CryptoKey): Promise<string> {
  const wrapped = await window.crypto.subtle.wrapKey(
    'raw',
    channelKey,
    publicKey,
    { name: 'RSA-OAEP' }
  );
  return btoa(String.fromCharCode(...new Uint8Array(wrapped)));
}

export async function unwrapChannelKey(wrappedKeyBase64: string, privateKey: CryptoKey): Promise<CryptoKey> {
  const wrappedBuffer = Uint8Array.from(atob(wrappedKeyBase64), c => c.charCodeAt(0));
  return window.crypto.subtle.unwrapKey(
    'raw',
    wrappedBuffer,
    privateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(text: string, aesKey: CryptoKey): Promise<{ content: string; iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    encoded
  );
  
  return {
    content: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...new Uint8Array(iv))),
  };
}

export async function decryptMessage(encryptedBase64: string, ivBase64: string, aesKey: CryptoKey): Promise<string> {
  const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
}
