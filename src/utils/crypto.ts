import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  Hmac,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-cbc";

export function toHmac(data: Buffer, signingPassword: Buffer): Hmac {
  let hmac = createHmac("sha256", signingPassword);
  return hmac.update(JSON.stringify(data));
}

export type EncryptedData = {
  encryptedData: Buffer;
  iv: Buffer;
};

export function toEncrypted(data: Buffer, key: Buffer): EncryptedData {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return {
    encryptedData: encrypted,
    iv,
  };
}

export function toDecrypted(encrypted: EncryptedData, key: Buffer): Buffer {
  const { encryptedData, iv } = encrypted;
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = decipher.update(encryptedData);
  return Buffer.concat([decrypted, decipher.final()]);
}
