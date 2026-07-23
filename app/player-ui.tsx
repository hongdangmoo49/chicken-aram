import Image from "next/image";
import type { Player } from "../db/site-data";
import type { PlayerPosition } from "../lib/player-positions";

export function PlayerAvatar({ player, large = false }: { player: Pick<Player, "nickname" | "thumbnailKey">; large?: boolean }) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const encodedPath = player.thumbnailKey?.split("/").map(encodeURIComponent).join("/");
  const thumbnailUrl = projectUrl && encodedPath ? `${projectUrl}/storage/v1/object/public/player-thumbnails/${encodedPath}` : null;
  const size = large ? 112 : 64;
  return <span className={`avatar${large ? " avatar-large" : ""}`}>{thumbnailUrl ? <Image src={thumbnailUrl} alt="" height={size} sizes={`${size}px`} width={size} /> : player.nickname.slice(0, 1)}</span>;
}

export function PlayerPositions({ positions }: { positions: readonly PlayerPosition[] }) {
  return positions.length ? <span className="position-list">{positions.map((position) => <span className="position-chip" key={position}>{position}</span>)}</span> : null;
}
