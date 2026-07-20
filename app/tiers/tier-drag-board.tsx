"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";

export function TierDragBoard({ children }: { children: ReactNode }) {
  const draggedCard = useRef<HTMLElement | null>(null);
  const [overTier, setOverTier] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function clearDrag() {
    draggedCard.current?.classList.remove("dragging");
    draggedCard.current = null;
    setOverTier(null);
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>) {
    if (saving || (event.target as HTMLElement).closest("form")) return event.preventDefault();
    const card = (event.target as HTMLElement).closest<HTMLElement>("[data-player-id]");
    if (!card) return event.preventDefault();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify({ playerId: card.dataset.playerId, tier: card.dataset.playerTier }));
    card.classList.add("dragging");
    draggedCard.current = card;
    setMessage(`${card.dataset.playerName} 선수를 이동할 티어에 놓아주세요.`);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    const section = (event.target as HTMLElement).closest<HTMLElement>("[data-tier]");
    if (!section || saving) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const tier = Number(section.dataset.tier);
    setOverTier((current) => current === tier ? current : tier);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const section = (event.target as HTMLElement).closest<HTMLElement>("[data-tier]");
    let payload: { playerId?: string; tier?: string } = {};
    try { payload = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { /* invalid drag */ }
    const playerId = Number(payload.playerId);
    const currentTier = Number(payload.tier);
    const tier = Number(section?.dataset.tier);
    clearDrag();
    if (!Number.isInteger(playerId) || !Number.isInteger(tier) || tier < 1 || tier > 4) return setMessage("선수 이동 정보를 확인하지 못했습니다.");
    if (currentTier === tier) return setMessage(`이미 T${tier}에 있는 선수입니다.`);

    setSaving(true);
    setMessage(`T${tier}로 변경하는 중입니다.`);
    try {
      const response = await fetch("/api/admin/player-tier", { method: "POST", body: new URLSearchParams({ playerId: String(playerId), tier: String(tier) }) });
      window.location.assign(response.url);
    } catch {
      setSaving(false);
      setMessage("티어를 변경하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  return <div className="tier-drag-board" data-over-tier={overTier ?? undefined} onDragEnd={clearDrag} onDragOver={handleDragOver} onDragStart={handleDragStart} onDrop={handleDrop}>
    {children}
    <p className="sr-status" aria-live="polite" role="status">{message}</p>
  </div>;
}
