import type { NextPage } from "next";
import Head from "next/head";
import { HomeView } from "../views";

const Home: NextPage = (props) => {
  return (
    <div>
      <Head>
        <title>Message Signing Test</title>
        <meta
          name="description"
          content="Message Signing Test"
        />
      </Head>
      <HomeView />
    </div>
  );
};

export default Home;
