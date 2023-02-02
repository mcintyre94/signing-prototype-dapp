// Next, React
import { FC, useEffect, useState } from 'react';
import Link from 'next/link';

// Wallet
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

// Components
import { RequestAirdrop } from '../../components/RequestAirdrop';
import pkg from '../../../package.json';

// Store
import useUserSOLBalanceStore from '../../stores/useUserSOLBalanceStore';
import { ErrorResponse, GetResponse, PostRequest, PostResponse, PutRequest } from 'pages/api/signing';
import { notify } from 'utils/notifications';

export const HomeView: FC = ({ }) => {
  const wallet = useWallet();
  const { connection } = useConnection();

  const balance = useUserSOLBalanceStore((s) => s.balance)
  const { getUserSOLBalance } = useUserSOLBalanceStore()

  useEffect(() => {
    if (wallet.publicKey) {
      console.log(wallet.publicKey.toBase58())
      getUserSOLBalance(wallet.publicKey, connection)
    }
  }, [wallet.publicKey, connection, getUserSOLBalance])

  const signingApiUrl = "/api/signing"

  // get request
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState('')

  // post request
  const [data, setData] = useState('')
  const [state, setState] = useState('')
  const [message, setMessage] = useState('')

  // signature
  const [signature, setSignature] = useState('')

  // Make requests
  async function getRequest() {
    const res = await fetch(signingApiUrl, { method: 'GET' })
    const json = await res.json() as GetResponse
    setLabel(json.label)
    setIcon(json.icon)
  }

  async function postRequest() {
    const input: PostRequest = {
      account: wallet.publicKey.toBase58()
    }
    const res = await fetch(
      signingApiUrl,
      {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      }
    )
    const json = await res.json() as PostResponse
    setData(json.data)
    setState(json.state)
    setMessage(json.message)
  }

  async function signData() {

    const dataUint8Array = Buffer.from(data, 'base64') // new TextEncoder().encode(data)
    const sig = await wallet.signMessage(dataUint8Array)
    const sigBase64 = Buffer.from(sig).toString('base64')
    setSignature(sigBase64)
  }

  async function putRequest() {
    const input: PutRequest = {
      account: wallet.publicKey.toBase58(),
      data,
      state,
      signature
    }
    const res = await fetch(
      signingApiUrl,
      {
        method: 'PUT',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      }
    )
    if (res.status >= 400) {
      const json = await res.json() as ErrorResponse
      notify({ type: 'error', message: json.message })
    } else {
      notify({ type: 'success', message: "Signature validated!" })
    }
  }

  return (
    <div className="md:hero mx-auto p-4">
      <div className="flex flex-col max-w-6xl items-start p-4 mx-auto">
        <div className='mt-6 self-center'>
          <h1 className="text-center text-5xl md:pl-12 font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-fuchsia-500 mb-4">
            Message Signing Test
          </h1>
        </div>

        <hr className='divider' />

        <section className='flex flex-col gap-4 items-start'>
          <h4 className="md:w-full text-3xl text-slate-300 my-2">
            <p>Step 1: GET Request</p>
          </h4>
          <button className='btn max-w-fit' onClick={getRequest}>Request</button>
          <p className='left-0'>Label: {label}</p>
          <p>Icon: {icon}</p>
        </section>

        <hr className='divider' />

        <section className='flex flex-col gap-4 items-start'>
          <h4 className="md:w-full text-3xl text-slate-300 my-2">
            <p>Step 2: POST Request</p>
          </h4>
          <button className='btn max-w-fit' onClick={postRequest} disabled={!wallet.connected}>Request</button>
          {!wallet.connected && <p className='text-sm'>Requires connected wallet</p>}
          <p>Account (input): {wallet.publicKey?.toBase58()}</p>
          <p>Data: {data}</p>
          <p>State: {state}</p>
          <p>Message: {message}</p>
        </section>

        <hr className='divider' />

        <section className='flex flex-col gap-4 items-start'>
          <h4 className="md:w-full text-3xl text-slate-300 my-2">
            <p>Step 3: Sign the data</p>
          </h4>
          <button className='btn max-w-fit' onClick={signData} disabled={!wallet.connected || !data}>Request</button>
          {!wallet.connected && <p className='text-sm'>Requires connected wallet + data</p>}
          <p>Signature: {signature}</p>
        </section>

        <hr className='divider' />

        <section className='flex flex-col gap-4 items-start'>
          <h4 className="md:w-full text-3xl text-slate-300 my-2">
            <p>Step 4: PUT Request</p>
          </h4>
          <button className='btn max-w-fit' onClick={putRequest} disabled={!signature}>Request</button>
          {!signature && <p className='text-sm'>Requires signature</p>}
        </section>
      </div>
    </div>
  );
};
