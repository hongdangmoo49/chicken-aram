"use client";

import { useMemo, useState, type DragEvent } from "react";
import type { Player } from "../../db/site-data";
import { adjustRankPointsForTierChange, needsSuperAdminRankReview, playerTierLabel, playerTiers } from "../../lib/player-tiers";
import { PlayerAvatar, PlayerPositions } from "../player-ui";
import { useSession } from "../session-ui";

type Arrangement = Record<number, number[]>;

function arrange(players: Player[]): Arrangement {
  return Object.fromEntries(playerTiers.map((tier) => [tier, players.filter((player) => player.tier === tier).sort((a, b) => b.points - a.points).map((player) => player.id)]));
}

function placement(arrangement: Arrangement, playerId: number) {
  for (const tier of playerTiers) {
    const order = arrangement[tier].indexOf(playerId);
    if (order >= 0) return { tier, order };
  }
  return null;
}

export function TierDragBoard({ players }: { players: Player[] }) {
  const { user } = useSession();
  const admin = Boolean(user && user.role !== "user");
  const superAdmin = user?.role === "super_admin";
  const baseline = useMemo(() => arrange(players), [players]);
  const [arrangement, setArrangement] = useState<Arrangement>(() => baseline);
  const [pointEdits, setPointEdits] = useState<Record<number, number>>({});
  const [editingPointsId, setEditingPointsId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overTier, setOverTier] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const changes = playerTiers.flatMap((tier) => arrangement[tier].map((playerId, order) => ({ playerId, tier, order, ...(pointEdits[playerId] === undefined ? {} : { points: pointEdits[playerId] }) })));
  const pendingCount = changes.filter((change) => {
    const original = placement(baseline, change.playerId);
    return !original || original.tier !== change.tier || original.order !== change.order || change.points !== undefined;
  }).length;

  function displayedPoints(player: Player, tier: number) {
    if (superAdmin && pointEdits[player.id] !== undefined) return pointEdits[player.id];
    return admin && !superAdmin ? adjustRankPointsForTierChange(player.points, player.tier, tier) : player.points;
  }

  function clearDrag() {
    setDraggingId(null);
    setOverTier(null);
  }

  function movePlayer(playerId: number, tier: number) {
    setArrangement((current) => {
      const next = Object.fromEntries(playerTiers.map((value) => [value, current[value].filter((id) => id !== playerId)])) as Arrangement;
      next[tier].push(playerId);
      next[tier].sort((a, b) => {
        const playerA = players.find((player) => player.id === a);
        const playerB = players.find((player) => player.id === b);
        return (playerB ? displayedPoints(playerB, tier) : 0) - (playerA ? displayedPoints(playerA, tier) : 0);
      });
      return next;
    });
    const player = players.find((item) => item.id === playerId);
    setMessage(`${player?.nickname ?? "선수"}의 티어를 ${playerTierLabel(tier)}로 임시 변경했습니다.`);
    clearDrag();
  }

  function editPoints(player: Player, points: number) {
    setPointEdits((current) => {
      const next = { ...current };
      if (points === player.points) delete next[player.id];
      else next[player.id] = points;
      return next;
    });
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
  }

  function handleDrop(event: DragEvent<HTMLElement>, tier: number) {
    event.preventDefault();
    const playerId = Number(event.dataTransfer.getData("text/plain"));
    if (!Number.isInteger(playerId)) return clearDrag();
    movePlayer(playerId, tier);
  }

  async function saveChanges() {
    if (!pendingCount) return;
    setSaving(true);
    setMessage(`${pendingCount}명의 티어/RP 변경을 저장하는 중입니다.`);
    try {
      const response = await fetch("/api/admin/player-tier", { method: "POST", body: new URLSearchParams({ changes: JSON.stringify(changes) }) });
      window.location.assign(response.url);
    } catch {
      setSaving(false);
      setMessage("티어/RP 변경을 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  return <div className="tier-drag-board" data-over-tier={overTier ?? undefined}>
    {admin && <div className="tier-save-bar"><span><strong>{pendingCount}</strong>명 변경 대기</span><div><button className="button ghost" disabled={!pendingCount || saving} onClick={() => { setArrangement(baseline); setPointEdits({}); setEditingPointsId(null); setMessage("변경사항을 초기화했습니다."); }} type="button">초기화</button><button className="button primary" disabled={!pendingCount || saving} onClick={saveChanges} type="button">{saving ? "저장 중..." : "변경사항 저장"}</button></div></div>}
    <div className="tier-board">
      {playerTiers.map((tier) => {
        const tierPlayers = arrangement[tier].map((id) => players.find((player) => player.id === id)).filter((player): player is Player => Boolean(player)).sort((a, b) => displayedPoints(b, tier) - displayedPoints(a, tier));
        return <section className={`tier-section tier-${tier}`} data-tier={tier} key={tier} onDragOver={(event) => handleDragOver(event, tier)} onDrop={(event) => handleDrop(event, tier)}><div className="tier-label"><div><strong>{playerTierLabel(tier)}</strong><span>{tierPlayers.length} PLAYERS</span></div></div><div className="tier-players">{tierPlayers.map((player) => <article className={`tier-player-card${draggingId === player.id ? " dragging" : ""}`} data-player-id={player.id} draggable={admin} key={player.id} onDragEnd={clearDrag} onDragStart={(event) => handleDragStart(event, player)} title={admin ? "원하는 티어로 드래그" : undefined}>
          <PlayerAvatar player={player} />
          <div className="tier-player-info"><strong>{player.nickname}</strong><span>{player.wins}승 {player.losses}패</span><PlayerPositions positions={player.positions} /></div>
          <div className="tier-player-rate"><strong>{displayedPoints(player, tier)}점</strong><span>티어 점수 {admin && needsSuperAdminRankReview(tier, displayedPoints(player, tier)) && <span aria-label="슈퍼관리자 확인 필요" className="rank-review-warning" title="슈퍼관리자 확인 필요.">!</span>}</span></div>
          {admin && <div className="tier-admin-form"><label htmlFor={`tier-${player.id}`}>티어 조정</label><select disabled={saving} id={`tier-${player.id}`} value={tier} onChange={(event) => movePlayer(player.id, Number(event.target.value))}>{playerTiers.map((value) => <option value={value} key={value}>{playerTierLabel(value)}</option>)}</select>{superAdmin && <><button className="button ghost rank-points-edit" disabled={saving} onClick={() => setEditingPointsId((current) => current === player.id ? null : player.id)} type="button">RP 수정</button>{editingPointsId === player.id && <label className="rank-points-field" htmlFor={`points-${player.id}`}><span>RP</span><input defaultValue={pointEdits[player.id] ?? player.points} id={`points-${player.id}`} max={1_000_000} min={-1_000_000} onChange={(event) => { if (event.target.value) editPoints(player, Number(event.target.value)); }} step="1" type="number" /></label>}</>}</div>}
        </article>)}</div></section>;
      })}
    </div>
    <p className="sr-status" aria-live="polite" role="status">{message}</p>
  </div>;
}
