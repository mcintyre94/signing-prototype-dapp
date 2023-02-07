# Signing Prototype Dapp

This repo includes a dapp displaying the proposed data flow for [Solana Pay message signing](https://github.com/solana-labs/solana-pay/blob/master/message-signing-spec.md). 

## Features

- Simple implementation of all required API routes
- Webhook integration to notify frontend when the PUT API is called successfully
- Home page allowing stepping through the message signing steps + displaying responses. This uses a connected wallet
- Mobile page displaying a Solana Pay QR code. This can be scanned with [the message signing app](https://github.com/mcintyre94/message-signing-app).

## Demo

Mobile page:

https://user-images.githubusercontent.com/1711350/217333010-ec95774e-cb86-4b92-ada5-b01b3dd0b87c.mp4

## Cryptography

The cryptography used in this repo **has not been audited** and is included for illustrative purposes only.

## Webhooks

As part of the PUT API call, a webhook message is sent. This is done using [pusher](https://pusher.com). You'll need to set up a project in Pusher and configure the environment variables.

## Environment variables

You need to copy `.env.local.example`, rename to `.env.local` and fill in values. All environment variables are required. Make sure this file is not checked in!

## Getting Started

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

The responsive version for wallets and wallet adapter may not function or work as expected for mobile based on plugin and wallet compatibility. For more code examples and implementations please visit the [Solana Cookbook](https://solanacookbook.com/)

## Installation

```bash
npm install
# or
yarn install
```

## Build and Run

Next, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/signing](http://localhost:3000/api/signing). This endpoint can be edited in `pages/api/signing.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

