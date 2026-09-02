"use client";

import { useState } from "react";
import { playerPositions, type PlayerPosition } from "../../lib/player-positions";

export function PositionPicker({ initialPositions }: { initialPositions: PlayerPosition[] }) {
  const [primary, setPrimary] = useState<PlayerPosition | "">(initialPositions[0] ?? "");
  const [secondary, setSecondary] = useState<PlayerPosition | "">(initialPositions[0] === "올라운더" ? "" : initialPositions[1] ?? "");

  function changePrimary(value: PlayerPosition | "") {
    setPrimary(value);
    if (!value || value === "올라운더" || value === secondary) setSecondary("");
  }

  return <form action="/api/profile/positions" className="position-form" method="post">
    <div><strong>선호 포지션 우선순위</strong><span>1순위 필수 · 2순위 선택</span></div>
    <div className="position-priority-grid">
      <label htmlFor="primaryPosition"><span>1순위</span><select id="primaryPosition" name="primaryPosition" onChange={(event) => changePrimary(event.target.value as PlayerPosition | "")} required value={primary}><option value="">포지션 선택</option>{playerPositions.map((position) => <option key={position} value={position}>{position}</option>)}</select></label>
      <label htmlFor="secondaryPosition"><span>2순위</span><select disabled={!primary || primary === "올라운더"} id="secondaryPosition" name="secondaryPosition" onChange={(event) => setSecondary(event.target.value as PlayerPosition | "")} value={secondary}><option value="">선택 안 함</option>{playerPositions.filter((position) => position !== "올라운더" && position !== primary).map((position) => <option key={position} value={position}>{position}</option>)}</select></label>
    </div>
    <p>올라운더는 1순위에만 선택할 수 있으며, 선택하면 2순위가 비활성화됩니다.</p>
    <button className="button primary" type="submit">포지션 저장</button>
  </form>;
}
