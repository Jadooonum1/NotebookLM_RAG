"use client";

import { DocumentInfo } from "@/app/page";

interface DocumentSidebarProps {
  documents: DocumentInfo[];
  activeDocument: string | null;
  onSelectDocument: (collectionName: string) => void;
  onDeleteDocument: (collectionName: string) => void;
}

export default function DocumentSidebar({
  documents,
  activeDocument,
  onSelectDocument,
  onDeleteDocument,
}: DocumentSidebarProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="document-list" id="document-list">
      {documents.length === 0 ? (
        <div className="no-documents">
          <div className="no-documents-icon">📁</div>
          <p>No documents uploaded yet</p>
        </div>
      ) : (
        <>
          <h3 className="sidebar-title" style={{ padding: "0 0 8px 4px" }}>
            Your Documents
          </h3>
          {documents.map((doc) => (
            <div
              key={doc.collectionName}
              className={`document-item ${activeDocument === doc.collectionName ? "active" : ""}`}
              onClick={() => onSelectDocument(doc.collectionName)}
              id={`doc-${doc.collectionName}`}
              role="button"
              tabIndex={0}
            >
              <div className="document-icon">
                {doc.fileName.endsWith(".pdf") ? "📕" : "📝"}
              </div>
              <div className="document-info">
                <div className="document-name" title={doc.fileName}>
                  {doc.fileName}
                </div>
                <div className="document-meta">
                  {doc.chunkCount} chunks · {formatTime(doc.uploadedAt)}
                </div>
              </div>
              <button
                className="document-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDocument(doc.collectionName);
                }}
                title="Delete document"
                aria-label={`Delete ${doc.fileName}`}
                id={`delete-${doc.collectionName}`}
              >
                ✕
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
