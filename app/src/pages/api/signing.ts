import { PublicKey } from "@solana/web3.js";
import { createHmac, getRandomValues, randomBytes } from "crypto";
import { NextApiRequest, NextApiResponse } from "next";
import { sign } from "tweetnacl";

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

function getHandler(res: NextApiResponse<GetResponse>) {
  return res.status(200).json({
    label: "Some label",
    icon: "https://solanapay.com/src/img/branding/Solanapay.com/downloads/gradient.svg",
  });
}

function postHandler(res: NextApiResponse<PostResponse>) {
  const bytes = randomBytes(100);
  const data = bytes.toString("base64");

  const hmac = createHmac("sha256", data);
  const state = hmac.digest("base64");

  return res.status(200).json({
    data,
    state,
    message: "Please sign to connect your account!",
  });
}

function putHandler(
  input: PutRequest,
  res: NextApiResponse<{} | ErrorResponse>
) {
  const { account, data, state, signature } = input;

  // check state is hmac of data
  const hmac = createHmac("sha-256", data);
  const expectedState = hmac.digest("base64");
  if (state !== expectedState) {
    return res.status(400).json({ message: "Incorrect state" });
  }

  // validate account
  let publicKey: Buffer = null;
  try {
    publicKey = new PublicKey(account).toBuffer();
  } catch {
    return res.status(400).json({ message: "Invalid public key" });
  }

  // verify signature
  const msg = Buffer.from(data);
  const sig = Buffer.from(signature, "base64");
  const isVerified = sign.detached.verify(msg, sig, publicKey);
  if (!isVerified) {
    return res.status(400).json({ message: "Invalid signature" });
  }

  return res.status(200).json({});
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetResponse | PostResponse | ErrorResponse>
) {
  if (req.method === "GET") {
    return getHandler(res);
  } else if (req.method === "POST") {
    // NOTE: Why does this receive the { account } as input? Doesn't seem to be used
    return postHandler(res);
  } else if (req.method === "PUT") {
    return putHandler(req.body as PutRequest, res);
  } else {
    res.status(405).json({ message: `Unexpected method ${req.method}` });
  }

  // res.status(200).json({ name: 'John Doe' })
}
