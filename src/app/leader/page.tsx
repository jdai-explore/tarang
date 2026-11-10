import Link from "next/link";
import { getAuth } from "@/lib/auth";
import { currentLeader } from "@/lib/leaders";
import LeaderSignIn, { LeaderSignOut } from "@/components/LeaderSignIn";
import OwnerSetup from "@/components/OwnerSetup";
import LeaderWorkspace from "@/components/LeaderWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tarang leader", robots: { index: false, follow: false } };

export default async function LeaderPage() {
  const leader = await currentLeader();
  if (!leader) {
    const { data } = await getAuth().getSession();
    return <main className="shell"><h1>Leader access</h1>
      {data?.user ? <><p>This Google account is not an approved leader. Ask the owner to approve it.</p><LeaderSignOut /></> : <LeaderSignIn />}
      <p><Link href="/">Back to Tarang</Link></p>
    </main>;
  }
  return <main className="shell"><h1>Leader workspace</h1>
    <p>Signed in as {leader.email}{leader.owner ? " (owner)" : ""}.</p>
    {leader.owner && <OwnerSetup />}
    <LeaderWorkspace owner={leader.owner} userId={leader.id} />
  </main>;
}
