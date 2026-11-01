import { CatchUpFlow } from "@/components/CatchUpFlow";
import { getPublicMatchData } from "@/lib/serverMatchData";

export const dynamic = "force-dynamic";

export default function Home() {
  const matchData = getPublicMatchData();
  if (!matchData) {
    throw new Error("Default match data not found");
  }
  const { meta, balls, sessionToken } = matchData;

  return (
    <CatchUpFlow
      initialMeta={meta}
      initialBalls={balls}
      initialSessionToken={sessionToken}
    />
  );
}
