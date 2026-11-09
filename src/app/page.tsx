import { publishedSongs } from "@/lib/songs";
import SongList from "@/components/SongList";
import LiveControls from "@/components/LiveControls";

export default function Home() {
  return <><SongList songs={publishedSongs} /><div className="shell"><LiveControls /></div></>;
}
