export default function Loading() {
  return (
    <div aria-live="polite" className="loading-screen" role="status">
      <span className="sr-status">페이지를 불러오는 중입니다.</span>
      <div className="loading-header">
        <span className="loading-brand skeleton" />
        <span className="loading-nav skeleton" />
        <span className="loading-account skeleton" />
      </div>
      <main className="loading-page">
        <div className="loading-title skeleton" />
        <div className="loading-subtitle skeleton" />
        <div className="loading-grid">
          <div className="loading-card skeleton" />
          <div className="loading-card skeleton" />
          <div className="loading-card skeleton" />
        </div>
      </main>
    </div>
  );
}
