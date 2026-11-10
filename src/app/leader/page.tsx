import Link from "next/link";
import { getAuth } from "@/lib/auth";
import { currentLeader } from "@/lib/leaders";
import LeaderSignIn from "@/components/LeaderSignIn";

export const dynamic = "force-dynamic";

export default async function LeaderPage() {
  const leader = await currentLeader();
  if (!leader) {
    const { data } = await getAuth().getSession();
    return <main className="shell"><h1>Leader access</h1>
      {data?.user ? <p>This Google account is not an approved leader. Ask the owner to approve it.</p> : <LeaderSignIn />}
      <p><Link href="/">Back to Tarang</Link></p>
    </main>;
  }
  return <main className="shell"><h1>Leader workspace</h1>
    <p>Signed in as {leader.email}{leader.owner ? " (owner)" : ""}.</p>
    <p>The private library and leader handoff are being built. Public sessions remain on the existing system until migration is verified.</p>
  </main>;
}
