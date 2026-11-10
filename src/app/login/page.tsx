import LeaderSignIn from "@/components/LeaderSignIn";

export const metadata = { title: "Tarang leader sign-in", robots: { index: false, follow: false } };

export default function LoginPage() {
  return <main className="shell"><h1>Leader sign-in</h1><p>Only owner-approved Gmail accounts can lead a Tarang session.</p><LeaderSignIn /></main>;
}
