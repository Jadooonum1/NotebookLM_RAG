"use client";

export default function Header() {
  return (
    <header className="header" id="app-header">
      <div className="header-brand">
        <div className="header-logo" aria-hidden="true">N</div>
        <div>
          <h1 className="header-title">NotebookLM</h1>
          <p className="header-subtitle">Chat with your documents using AI</p>
        </div>
      </div>
      <div className="header-badge">
        <span className="header-badge-dot" />
        All Free APIs
      </div>
    </header>
  );
}
