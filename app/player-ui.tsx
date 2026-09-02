"use client";

import Image from "next/image";
import { useState } from "react";
import type { Player } from "../db/site-data";
import type { PlayerPosition } from "../lib/player-positions";

export function PlayerAvatar({ player, large = false }: { player: Pick<Player, "nickname" | "thumbnailKey">; large?: boolean }) {
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const encodedPath = player.thumbnailKey?.split("/").map(encodeURIComponent).join("/");
  const thumbnailUrl = projectUrl && encodedPath ? `${projectUrl}/storage/v1/object/public/player-thumbnails/${encodedPath}` : null;
  const visibleThumbnail = thumbnailUrl && failedThumbnail !== thumbnailUrl ? thumbnailUrl : null;
  const size = large ? 112 : 64;
  return <span className={`avatar${large ? " avatar-large" : ""}`}>{visibleThumbnail ? <Image src={visibleThumbnail} alt="" height={size} onError={() => setFailedThumbnail(visibleThumbnail)} sizes={`${size}px`} width={size} /> : player.nickname.slice(0, 1)}</span>;
}

export function PlayerPositions({ positions }: { positions: readonly PlayerPosition[] }) {
  return positions.length ? <span className="position-list">{positions.map((position, index) => <span className="position-chip" key={position}>{index + 1}순위 · {position}</span>)}</span> : null;
}
