import { PublicKey } from "@solana/web3.js";
import { randomBytes, scryptSync } from "crypto";
import { NextApiRequest, NextApiResponse } from "next";
import { sign } from "tweetnacl";
import { EncryptedData, toDecrypted, toEncrypted, toHmac } from "utils/crypto";
import Pusher from "pusher";

export type GetResponse = {
  label: string;
  icon: string;
};

export type PostRequest = {
  account: string;
};

export type PostResponse = {
  data: string;
  state: string;
  message: string;
};

export type PutRequest = {
  account: string;
  data: string;
  state: string;
  signature: string;
};

export type ErrorResponse = {
  message: string;
};

// Data structure that is encrypted as part of state
type EncryptState = {
  hmac: string;
  account: string;
  expirationTimestamp: number;
  nonce: string;
};

// Data structure that is encoded as state
type SerializeState = {
  encryptedData: string;
  salt: string;
  iv: string;
};

// Get signing password from environment variable, return error if not set
function getSigningPassword(): Buffer | undefined {
  const signingPassword = process.env.SERVER_SIGNING_PASSWORD;
  if (!signingPassword) return undefined;
  return Buffer.from(signingPassword);
}

// Get encryption password from environment variable, return error if not set
function getEncryptionPassword(): Buffer | undefined {
  const encryptionPassword = process.env.SERVER_ENCRYPTION_PASSWORD;
  if (!encryptionPassword) return undefined;
  return Buffer.from(encryptionPassword);
}

function getHandler(res: NextApiResponse<GetResponse>) {
  return res.status(200).json({
    label: "Some label",
    icon: "https://solanapay.com/src/img/branding/Solanapay.com/downloads/gradient.svg",
  });
}

function postHandler(
  input: PostRequest,
  res: NextApiResponse<PostResponse | ErrorResponse>
) {
  // validate account
  const { account } = input;
  try {
    new PublicKey(account);
  } catch {
    return res.status(400).json({ message: "Invalid public key" });
  }

  // Check environment variables are set
  const signingPassword = getSigningPassword();
  if (!signingPassword)
    return res.status(500).json({ message: "Server signing password not set" });

  const encryptionPassword = getEncryptionPassword();
  if (!signingPassword)
    return res.status(500).json({ message: "Server signing password not set" });

  // Generate data
  // Loosely based on SIWE example message: https://eips.ethereum.org/EIPS/eip-4361#example-message
  const timestamp = Date.now();
  const expirationTimestamp = timestamp + 60_000; // valid for 1 min
  const nonce = randomBytes(20).toString("base64");

  const message = `example.com wants you to sign in with your Solana account:
  ${account}
  
  Please sign in to connect your account!
  
  URI: https://example.com/login
  Version: 1
  Chain ID: mainnet
  Nonce: ${nonce}
  Issued At: ${new Date(timestamp).toISOString()}
  Expiration Time: ${new Date(expirationTimestamp).toISOString()}`;

  const data = Buffer.from(message);

  // Generate state
  let hmac = toHmac(data, signingPassword);

  // Include account, expiry timestamp and nonce to verify later
  const toEncrypt: EncryptState = {
    hmac: hmac.digest("base64"),
    account,
    expirationTimestamp,
    nonce,
  };

  // encrypt the state before returning
  const salt = randomBytes(32);
  const key = scryptSync(encryptionPassword, salt, 32); // 32-byte key
  console.log({ key: key.toString("base64") });

  const { encryptedData, iv } = toEncrypted(
    Buffer.from(JSON.stringify(toEncrypt)),
    key
  );

  console.log({
    encrypt: true,
    key: key.toString("base64"),
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
  });

  const state: SerializeState = {
    encryptedData: encryptedData.toString("base64"),
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
  };

  return res.status(200).json({
    data: data.toString("base64"),
    state: Buffer.from(JSON.stringify(state)).toString("base64"),
    message: "Please sign to connect your account!",
  });
}

function putHandler(
  input: PutRequest,
  channelId: string,
  res: NextApiResponse<{} | ErrorResponse>
) {
  const { account, data, state, signature } = input;
  const dataBuffer = Buffer.from(data, "base64");
  const stateBuffer = Buffer.from(state, "base64");
  const signatureBuffer = Buffer.from(signature, "base64");

  // validate account
  let publicKeyBuffer: Buffer = null;
  try {
    publicKeyBuffer = new PublicKey(account).toBuffer();
  } catch {
    return res.status(400).json({ message: "Invalid public key" });
  }

  // Check environment variables are set
  const signingPassword = getSigningPassword();
  if (!signingPassword)
    return res.status(500).json({ message: "Server signing password not set" });

  const encryptionPassword = getEncryptionPassword();
  if (!signingPassword)
    return res.status(500).json({ message: "Server signing password not set" });

  // Extract fields from state
  const { encryptedData, salt, iv } = JSON.parse(
    stateBuffer.toString()
  ) as SerializeState;

  const encryptedDataBuffer = Buffer.from(encryptedData, "base64");
  const saltBuffer = Buffer.from(salt, "base64");
  const ivBuffer = Buffer.from(iv, "base64");

  // Decrypt state encrypteData field
  const key = scryptSync(encryptionPassword, saltBuffer, 32);
  const encrypted: EncryptedData = {
    encryptedData: encryptedDataBuffer,
    iv: ivBuffer,
  };
  let decrypted: Buffer = null;

  try {
    decrypted = toDecrypted(encrypted, key);
  } catch (e) {
    console.error(e);
    return res.status(400).json({ message: "Error decrypting state" });
  }

  console.log(decrypted.toString());

  const {
    hmac,
    account: decryptedAccount,
    expirationTimestamp,
    nonce,
  } = JSON.parse(decrypted.toString()) as EncryptState;

  // Check hmac
  const expectedHmac = toHmac(dataBuffer, signingPassword);
  if (hmac !== expectedHmac.digest("base64")) {
    return res.status(400).json({ message: "Data didn't match expected hash" });
  }

  // Check account === decrypted.account
  if (account !== decryptedAccount) {
    return res.status(400).json({ message: "Unexpected account" });
  }

  // Check timestamp, reject if older than 1min
  if (Date.now() > expirationTimestamp) {
    return res.status(400).json({ message: "Data is expired" });
  }

  // Check nonce in message
  if (!dataBuffer.toString().includes(nonce)) {
    return res.status(400).json({ message: "Nonce doesn't match" });
  }

  // Verify signature
  const isVerified = sign.detached.verify(
    dataBuffer,
    signatureBuffer,
    publicKeyBuffer
  );
  if (!isVerified) {
    return res.status(400).json({ message: "Invalid signature" });
  }

  const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
  });

  pusher.trigger(channelId, "account-connected", {
    message: `GM from server! Connected to account ${account}`,
    account,
  });

  return res.status(200).json({});
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetResponse | PostResponse | ErrorResponse>
) {
  if (req.method === "GET") {
    return getHandler(res);
  } else if (req.method === "POST") {
    return postHandler(req.body as PostRequest, res);
  } else if (req.method === "PUT") {
    const channelId = req.query.channelId as string;
    return putHandler(req.body as PutRequest, channelId, res);
  } else {
    res.status(405).json({ message: `Unexpected method ${req.method}` });
  }

  // res.status(200).json({ name: 'John Doe' })
}
