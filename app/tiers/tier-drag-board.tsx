"use client";

import { useMemo, useState, type DragEvent } from "react";
import type { Player } from "../../db/site-data";
import { PlayerAvatar, PlayerPositions } from "../player-ui";

const tiers = [1, 2, 3, 4] as const;
type Arrangement = Record<number, number[]>;

function arrange(players: Player[]): Arrangement {
  return Object.fromEntries(tiers.map((tier) => [tier, players.filter((player) => player.tier === tier).map((player) => player.id)]));
}

function placement(arrangement: Arrangement, playerId: number) {
  for (const tier of tiers) {
    const order = arrangement[tier].indexOf(playerId);
    if (order >= 0) return { tier, order };
  }
  return null;
}

export function TierDragBoard({ players, admin }: { players: Player[]; admin: boolean }) {
  const baseline = useMemo(() => arrange(players), [players]);
  const [arrangement, setArrangement] = useState<Arrangement>(() => baseline);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overTier, setOverTier] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ playerId: number; after: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const rate = (player: Player) => player.wins + player.losses === 0 ? 0 : Math.round((player.wins / (player.wins + player.losses)) * 100);
  const changes = tiers.flatMap((tier) => arrangement[tier].map((playerId, order) => ({ playerId, tier, order })));
  const pendingCount = changes.filter((change) => {
    const original = placement(baseline, change.playerId);
    return !original || original.tier !== change.tier || original.order !== change.order;
  }).length;

  function clearDrag() {
    setDraggingId(null);
    setOverTier(null);
    setDropTarget(null);
  }

  function movePlayer(playerId: number, tier: number, targetId?: number, after = false) {
    if (playerId === targetId) return clearDrag();
    setArrangement((current) => {
      const next = Object.fromEntries(tiers.map((value) => [value, current[value].filter((id) => id !== playerId)])) as Arrangement;
      const target = next[tier];
      const targetIndex = targetId ? target.indexOf(targetId) : -1;
      target.splice(targetIndex < 0 ? target.length : targetIndex + (after ? 1 : 0), 0, playerId);
      return next;
    });
    const player = players.find((item) => item.id === playerId);
    setMessage(`${player?.nickname ?? "선수"}의 T${tier} 내 위치를 임시 변경했습니다.`);
    clearDrag();
  }

  function handleDragStart(event: DragEvent<HTMLElement>, player: Player) {
    if (saving || (event.target as HTMLElement).closest(".tier-admin-form")) return event.preventDefault();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(player.id));
    setDraggingId(player.id);
    setMessage(`${player.nickname} 선수를 원하는 위치에 놓아주세요.`);
  }

  function handleDragOver(event: DragEvent<HTMLElement>, tier: number) {
    if (!admin || saving) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOverTier(tier);
    const card = (event.target as HTMLElement).closest<HTMLElement>("[data-player-id]");
    const playerId = Number(card?.dataset.playerId);
    if (!card || playerId === draggingId) return setDropTarget(null);
    const rect = card.getBoundingClientRect();
    const y = event.clientY - (rect.top + rect.height / 2);
    const after = Math.abs(y) > rect.height / 4 ? y > 0 : event.clientX > rect.left + rect.width / 2;
    setDropTarget((current) => current?.playerId === playerId && current.after === after ? current : { playerId, after });
  }

  function handleDrop(event: DragEvent<HTMLElement>, tier: number) {
    event.preventDefault();
    const playerId = Number(event.dataTransfer.getData("text/plain"));
    if (!Number.isInteger(playerId)) return clearDrag();
    movePlayer(playerId, tier, dropTarget?.playerId, dropTarget?.after);
  }

  async function saveChanges() {
    if (!pendingCount) return;
    setSaving(true);
    setMessage(`${pendingCount}명의 티어 순서를 저장하는 중입니다.`);
    try {
      const response = await fetch("/api/admin/player-tier", { method: "POST", body: new URLSearchParams({ changes: JSON.stringify(changes) }) });
      window.location.assign(response.url);
    } catch {
      setSaving(false);
      setMessage("티어 순서를 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  return <div className="tier-drag-board" data-over-tier={overTier ?? undefined}>
    {admin && <div className="tier-save-bar"><span><strong>{pendingCount}</strong>명 순서 변경 대기</span><div><button className="button ghost" disabled={!pendingCount || saving} onClick={() => { setArrangement(baseline); setMessage("변경사항을 초기화했습니다."); }} type="button">초기화</button><button className="button primary" disabled={!pendingCount || saving} onClick={saveChanges} type="button">{saving ? "저장 중..." : "변경사항 저장"}</button></div></div>}
    <div className="tier-board">
      {tiers.map((tier) => {
        const tierPlayers = arrangement[tier].map((id) => players.find((player) => player.id === id)).filter((player): player is Player => Boolean(player));
        return <section className={`tier-section tier-${tier}`} data-tier={tier} key={tier} onDragOver={(event) => handleDragOver(event, tier)} onDrop={(event) => handleDrop(event, tier)}><div className="tier-label"><div><strong>T{tier}</strong><span>{tierPlayers.length} PLAYERS</span></div></div><div className="tier-players">{tierPlayers.map((player) => <article className={`tier-player-card${draggingId === player.id ? " dragging" : ""}${dropTarget?.playerId === player.id ? dropTarget.after ? " drop-after" : " drop-before" : ""}`} data-player-id={player.id} draggable={admin} key={player.id} onDragEnd={clearDrag} onDragStart={(event) => handleDragStart(event, player)} title={admin ? "원하는 티어와 순서로 드래그" : undefined}>
          <PlayerAvatar player={player} />
          <div className="tier-player-info"><strong>{player.nickname}</strong><span>{player.wins}승 {player.losses}패</span><PlayerPositions positions={player.positions} /></div>
          <div className="tier-player-rate"><strong>{rate(player)}%</strong><span>승률</span></div>
          {admin && <div className="tier-admin-form"><label htmlFor={`tier-${player.id}`}>티어 조정</label><select disabled={saving} id={`tier-${player.id}`} value={tier} onChange={(event) => movePlayer(player.id, Number(event.target.value))}>{tiers.map((value) => <option value={value} key={value}>T{value}</option>)}</select></div>}
        </article>)}</div></section>;
      })}
    </div>
    <p className="sr-status" aria-live="polite" role="status">{message}</p>
  </div>;
}
