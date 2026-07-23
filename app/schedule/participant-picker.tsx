"use client";

import { useId, useState } from "react";
import type { Player } from "../../db/site-data";
import { participantSelectionDisabled } from "../../lib/participant-selection";
import { playerTierLabel } from "../../lib/player-tiers";
import { PlayerAvatar } from "../player-ui";

export function ParticipantPicker({ players, initialSelectedIds = [], initialGroups = {} }: { players: Player[]; initialSelectedIds?: number[]; initialGroups?: Record<number, number> }) {
  const pickerId = useId();
  const [selected, setSelected] = useState<number[]>(() => [...new Set(initialSelectedIds)].slice(0, 10));

  return <>
    <div className="picker-heading"><strong>참가 선수</strong><span aria-live="polite">선택 {selected.length}/10 · 분리 그룹은 같은 숫자끼리 다른 팀으로 배치</span></div>
    <div className="participant-picker">
      {players.map((player) => {
        const checked = selected.includes(player.id);
        const coach = player.tier === 5;
        const disabled = coach ? !checked : participantSelectionDisabled(selected.length, checked);
        return <div className={`participant-option${disabled ? " disabled" : ""}`} key={player.id}>
          <label htmlFor={`${pickerId}-player-${player.id}`}><input checked={checked} disabled={disabled} id={`${pickerId}-player-${player.id}`} name="players" onChange={(event) => setSelected((current) => event.target.checked ? [...current, player.id] : current.filter((id) => id !== player.id))} type="checkbox" value={player.id} /><PlayerAvatar player={player} /><span><strong>{player.nickname}</strong><small>{coach ? "코치 · 대전 참가 제외" : `${playerTierLabel(player.tier)} · ${player.wins}승 ${player.losses}패`}</small></span></label>
          <select aria-label={`${player.nickname} 분리 그룹`} defaultValue={initialGroups[player.id] ?? ""} disabled={disabled} name={`group_${player.id}`}><option value="">분리 없음</option>{[1,2,3,4,5].map((group) => <option value={group} key={group}>그룹 {group}</option>)}</select>
        </div>;
      })}
    </div>
  </>;
}
