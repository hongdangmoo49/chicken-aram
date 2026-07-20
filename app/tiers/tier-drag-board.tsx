"use client";

import { useState, type DragEvent } from "react";
import type { Player } from "../../db/site-data";
import { PlayerAvatar, PlayerPositions } from "../player-ui";

export function TierDragBoard({ players, admin }: { players: Player[]; admin: boolean }) {
  const [pending, setPending] = useState<Record<number, number>>({});
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overTier, setOverTier] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const pendingCount = Object.keys(pending).length;
  const rate = (player: Player) => player.wins + player.losses === 0 ? 0 : Math.round((player.wins / (player.wins + player.losses)) * 100);
  const currentTier = (player: Player) => pending[player.id] ?? player.tier;

  function stageTier(player: Player, tier: number) {
    setPending((current) => {
      const next = { ...current };
      if (tier === player.tier) delete next[player.id];
      else next[player.id] = tier;
      return next;
    });
    setMessage(`${player.nickname} 선수를 T${tier}에 임시 배치했습니다.`);
  }

  function handleDragStart(event: DragEvent<HTMLElement>, player: Player) {
    if (saving || (event.target as HTMLElement).closest(".tier-admin-form")) return event.preventDefault();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(player.id));
    setDraggingId(player.id);
    setMessage(`${player.nickname} 선수를 이동할 티어에 놓아주세요.`);
  }

  function handleDragOver(event: DragEvent<HTMLElement>, tier: number) {
    if (!admin || saving) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOverTier((current) => current === tier ? current : tier);
  }

  function handleDrop(event: DragEvent<HTMLElement>, tier: number) {
    event.preventDefault();
    const player = players.find((item) => item.id === Number(event.dataTransfer.getData("text/plain")));
    setDraggingId(null);
    setOverTier(null);
    if (!player) return setMessage("선수 이동 정보를 확인하지 못했습니다.");
    if (currentTier(player) === tier) return setMessage(`이미 T${tier}에 배치된 선수입니다.`);
    stageTier(player, tier);
  }

  async function saveChanges() {
    if (!pendingCount) return;
    setSaving(true);
    setMessage(`${pendingCount}명의 티어를 저장하는 중입니다.`);
    const changes = Object.entries(pending).map(([playerId, tier]) => ({ playerId: Number(playerId), tier }));
    try {
      const response = await fetch("/api/admin/player-tier", { method: "POST", body: new URLSearchParams({ changes: JSON.stringify(changes) }) });
      window.location.assign(response.url);
    } catch {
      setSaving(false);
      setMessage("티어를 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  return <div className="tier-drag-board" data-over-tier={overTier ?? undefined}>
    {admin && <div className="tier-save-bar"><span><strong>{pendingCount}</strong>명 변경 대기</span><div><button className="button ghost" disabled={!pendingCount || saving} onClick={() => { setPending({}); setMessage("변경사항을 초기화했습니다."); }} type="button">초기화</button><button className="button primary" disabled={!pendingCount || saving} onClick={saveChanges} type="button">{saving ? "저장 중..." : "변경사항 저장"}</button></div></div>}
    <div className="tier-board">
      {[1,2,3,4].map((tier) => {
        const tierPlayers = players.filter((player) => currentTier(player) === tier).sort((a, b) => rate(b) - rate(a) || b.wins - a.wins);
        return <section className={`tier-section tier-${tier}`} data-tier={tier} key={tier} onDragOver={(event) => handleDragOver(event, tier)} onDrop={(event) => handleDrop(event, tier)}><div className="tier-label"><div><strong>T{tier}</strong><span>{tierPlayers.length} PLAYERS</span></div></div><div className="tier-players">{tierPlayers.map((player) => <article className={`tier-player-card${draggingId === player.id ? " dragging" : ""}`} draggable={admin} key={player.id} onDragEnd={() => { setDraggingId(null); setOverTier(null); }} onDragStart={(event) => handleDragStart(event, player)} title={admin ? "원하는 티어 영역으로 드래그" : undefined}>
          <PlayerAvatar player={player} />
          <div className="tier-player-info"><strong>{player.nickname}</strong><span>{player.wins}승 {player.losses}패</span><PlayerPositions positions={player.positions} /></div>
          <div className="tier-player-rate"><strong>{rate(player)}%</strong><span>승률</span></div>
          {admin && <div className="tier-admin-form"><label htmlFor={`tier-${player.id}`}>티어 조정</label><select disabled={saving} id={`tier-${player.id}`} value={currentTier(player)} onChange={(event) => stageTier(player, Number(event.target.value))}>{[1,2,3,4].map((value) => <option value={value} key={value}>T{value}</option>)}</select></div>}
        </article>)}</div></section>;
      })}
    </div>
    <p className="sr-status" aria-live="polite" role="status">{message}</p>
  </div>;
}
