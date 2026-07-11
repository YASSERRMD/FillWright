import type { EncryptedData } from '../types/profile';

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

function generateIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(data: string, passphrase: string): Promise<EncryptedData> {
  const salt = generateSalt();
  const iv = generateIv();
  const key = await deriveKey(passphrase, salt);

  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );

  return { ciphertext, iv, salt };
}

export async function decrypt(encrypted: EncryptedData, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, encrypted.salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: encrypted.iv },
    key,
    encrypted.ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

export function encryptedDataToBase64(data: EncryptedData): string {
  return JSON.stringify({
    ciphertext: arrayBufferToBase64(data.ciphertext),
    iv: arrayBufferToBase64(data.iv.buffer),
    salt: arrayBufferToBase64(data.salt.buffer),
  });
}

export function base64ToEncryptedData(base64: string): EncryptedData {
  const parsed = JSON.parse(base64) as { ciphertext: string; iv: string; salt: string };
  return {
    ciphertext: base64ToArrayBuffer(parsed.ciphertext),
    iv: new Uint8Array(base64ToArrayBuffer(parsed.iv)),
    salt: new Uint8Array(base64ToArrayBuffer(parsed.salt)),
  };
}

export { arrayBufferToBase64, base64ToArrayBuffer };
