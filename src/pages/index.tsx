import Head from "next/head";
import PromptDJ from "@/components/PromptDJ";

export default function Home() {
  return (
    <>
      <Head>
        <title>Prompt DJ - AI Music Curator</title>
        <meta
          name="description"
          content="AI-powered music recommendation chatbot"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <PromptDJ />
    </>
  );
}
