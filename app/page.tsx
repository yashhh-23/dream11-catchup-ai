import { CatchUpFlow } from "@/components/CatchUpFlow";
import { getPublicMatchData } from "@/lib/serverMatchData";

export default function Home() {
  const { meta, balls, sessionToken } = getPublicMatchData();

  return (
    <CatchUpFlow
      initialMeta={meta}
      initialBalls={balls}
      initialSessionToken={sessionToken}
    />
  );
}
