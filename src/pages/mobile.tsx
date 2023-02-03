import type { NextPage } from "next";
import Head from "next/head";
import { MobileView } from "../views";

const Mobile: NextPage = (props) => {
  return (
    <div>
      <Head>
        <title>Scan Me!</title>
        <meta
          name="description"
          content="Scan page"
        />
      </Head>
      <MobileView />
    </div>
  );
};

export default Mobile;
