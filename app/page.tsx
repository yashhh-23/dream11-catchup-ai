import { CatchUpFlow } from "@/components/CatchUpFlow";
import { getPublicMatchData } from "@/lib/serverMatchData";

export const dynamic = "force-dynamic";

export default function Home({
  searchParams,
}: {
  searchParams?: { matchId?: string };
}) {
  const requestedMatchId = searchParams?.matchId;
  const matchData = (requestedMatchId ? getPublicMatchData(requestedMatchId) : null) || getPublicMatchData();
  if (!matchData) {
    throw new Error("Default match data not found");
  }
  const { meta, sessionToken } = matchData;

  // Zero-Spoiler Shield: Deliveries are NOT inlined into the initial SSR HTML of the Spoiler Gate.
  // Viewing source or curling "/" reveals zero scorelines, zero commentary, and zero ball statistics.
  return (
    <CatchUpFlow
      initialMeta={meta}
      initialBalls={[]}
      initialSessionToken={sessionToken}
    />
  );
}
