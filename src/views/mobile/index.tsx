
import { createQR, encodeURL } from "@solana/pay";
import Pusher from "pusher-js";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid"

export const MobileView: FC = ({ }) => {
  const [account, setAccount] = useState<string | undefined>(undefined);

  const qrRef = useRef<HTMLDivElement>(null)
  const channelId = useMemo(() => uuid(), []);
  const apiUrl = useMemo(() => {
    return `${location.protocol}//${location.host}/api/signing?channelId=${channelId}`
  }, [channelId]);

  useEffect(() => {
    const solanaUrl = encodeURL({
      link: new URL(apiUrl)
    })

    const qr = createQR(solanaUrl, 512, 'white')
    if (qrRef.current) {
      qrRef.current.innerHTML = ''
      qr.append(qrRef.current)
    }
  }, [apiUrl])

  useEffect(() => {
    Pusher.logToConsole = true;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    });

    const channel = pusher.subscribe(channelId);
    channel.bind('account-connected', function ({ account }) {
      console.log({ account })
      setAccount(account)
    });
  }, [channelId]);

  return (
    <div className="md:hero mx-auto p-4">
      <div className="md:hero-content flex flex-col">
        <h1 className="text-center text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-fuchsia-500 mt-10 mb-8">
          Scan Me!
        </h1>

        {
          account ?
            <h2 className="text-4xl font-bold animate-bounce">GM {account}!</h2> :
            <div ref={qrRef} />
        }
      </div>
    </div>
  );
};
