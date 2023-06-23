import { PublicKey } from "@solana/web3.js";
import { randomBytes, scryptSync } from "crypto";
import { NextApiRequest, NextApiResponse } from "next";
import { EncryptedData, toDecrypted, toEncrypted, toHmac } from "utils/crypto";
import Pusher from "pusher";
import { createSignInMessageText, parseSignInMessage, verifyMessageSignature } from "@solana/wallet-standard-util";

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

// Data structure that is encoded as state
type SerializeState = {
  encryptedData: string;
  salt: string;
  iv: string;
};

const DOMAIN = "example.com";
const CHAIN_ID = "devnet";

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

  // Generate the sign-in message
  const timestamp = Date.now();
  const expirationTimestamp = timestamp + 60_000; // valid for 1 min

  const messageText = createSignInMessageText({
    domain: DOMAIN,
    address: account,
    statement: "Please sign in to connect your account!",
    uri: "https://example.com/login",
    version: "1",
    chainId: CHAIN_ID,
    nonce: randomBytes(20).toString("base64"),
    issuedAt: new Date(timestamp).toISOString(),
    expirationTime: new Date(expirationTimestamp).toISOString()
  });

  const message = Buffer.from(messageText);

  // Generate hmac of the data
  let hmac = toHmac(message, signingPassword);

  // encrypt the hmac before returning as state
  const salt = randomBytes(32);
  const key = scryptSync(encryptionPassword, salt, 32); // 32-byte key

  const { encryptedData, iv } = toEncrypted(
    Buffer.from(hmac.digest("base64")),
    key
  );

  const state: SerializeState = {
    encryptedData: encryptedData.toString("base64"),
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
  };

  // Return the message as data + state
  return res.status(200).json({
    data: message.toString("base64"),
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

  // validate account is a public key
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
  if (!encryptionPassword)
    return res.status(500).json({ message: "Server encryption password not set" });

  // Extract fields from state
  const { encryptedData, salt, iv } = JSON.parse(
    stateBuffer.toString()
  ) as SerializeState;

  const encryptedDataBuffer = Buffer.from(encryptedData, "base64");
  const saltBuffer = Buffer.from(salt, "base64");
  const ivBuffer = Buffer.from(iv, "base64");

  // Decrypt state encryptedData field
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

  // Check hmac
  const hmac = decrypted.toString();
  const expectedHmac = toHmac(dataBuffer, signingPassword).digest("base64");
  if (hmac !== expectedHmac) {
    return res.status(400).json({ message: "Data didn't match expected hash" });
  }

  // Parse fields from the sign in message
  const signInMessage = parseSignInMessage(dataBuffer);

  // Check domain is correct
  if (signInMessage.domain !== DOMAIN) {
    return res.status(400).json({ message: "Unexpected domain" });
  }

  // Check account passed in request === sign in message address
  if (signInMessage.address !== account) {
    return res.status(400).json({ message: "Unexpected account" });
  }

  // Check chainId is devnet
  if (signInMessage.chainId !== CHAIN_ID) {
    return res.status(400).json({ message: "Unexpected chainId" })
  }

  // Check timestamp, reject if expired
  const expirationTimestamp = new Date(signInMessage.expirationTime).getTime()
  if (Date.now() > expirationTimestamp) {
    return res.status(400).json({ message: "Data is expired" });
  }

  // Verify message is signed by the expected public key
  const isVerified = verifyMessageSignature({
    // we use the dataBuffer for both message and signedMessage
    // the hmac checks guarantee that the signed message 
    // is the same as the message we asked the user to sign 
    message: dataBuffer,
    signedMessage: dataBuffer,
    signature: signatureBuffer,
    publicKey: publicKeyBuffer,
  });
  if (!isVerified) {
    return res.status(400).json({ message: "Invalid signature" });
  }

  // All checks complete, trigger a websocket message
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
}
