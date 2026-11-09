import { publishedSongs } from "@/lib/songs";
import SongList from "@/components/SongList";

export default function Home() {
  return <SongList songs={publishedSongs} />;
}
