"use client";

import { useState } from "react";
import { playerPositions, type PlayerPosition } from "../../lib/player-positions";

export function PositionPicker({ initialPositions }: { initialPositions: PlayerPosition[] }) {
  const [selected, setSelected] = useState(initialPositions);

  function toggle(position: PlayerPosition) {
    setSelected((current) => {
      if (position === "올라운더") return current.includes(position) ? [] : [position];
      const positions = current.filter((item) => item !== "올라운더");
      if (positions.includes(position)) return positions.filter((item) => item !== position);
      return positions.length < 3 ? [...positions, position] : positions;
    });
  }

  return <form action="/api/profile/positions" className="position-form" method="post">
    <div><strong>선호 포지션</strong><span>{selected.length}/3 선택</span></div>
    <div className="position-options" role="group" aria-label="선호 포지션">
      {playerPositions.map((position) => <button aria-pressed={selected.includes(position)} className="position-option" disabled={selected.includes("올라운더") && position !== "올라운더"} key={position} onClick={() => toggle(position)} type="button">{position}</button>)}
    </div>
    {selected.map((position) => <input key={position} name="positions" type="hidden" value={position} />)}
    <p>최대 3개까지 선택할 수 있으며, 올라운더는 단독으로만 선택됩니다.</p>
    <button className="button primary" type="submit">포지션 저장</button>
  </form>;
}
