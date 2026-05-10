"use client";

import { useCallback, useState } from "react";
import Header from "@/components/Header";
import FileUpload from "@/components/FileUpload";
import DocumentSidebar from "@/components/DocumentSidebar";
import ChatInterface from "@/components/ChatInterface";

export interface DocumentInfo {
  fileName: string;
  collectionName: string;
  chunkCount: number;
  pageCount: number;
  uploadedAt: number;
}

export default function Home() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = useCallback(
    (doc: {
      fileName: string;
      collectionName: string;
      chunkCount: number;
      pageCount: number;
    }) => {
      const newDoc: DocumentInfo = {
        ...doc,
        uploadedAt: Date.now(),
      };
      setDocuments((prev) => [newDoc, ...prev]);
      setActiveDocument(doc.collectionName);
    },
    []
  );

  const handleDeleteDocument = useCallback(
    async (collectionName: string) => {
      try {
        await fetch("/api/collections", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collectionName }),
        });

        setDocuments((prev) =>
          prev.filter((d) => d.collectionName !== collectionName)
        );

        if (activeDocument === collectionName) {
          setActiveDocument(null);
        }
      } catch {
        setError("Failed to delete document");
      }
    },
    [activeDocument]
  );

  const handleError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  const activeDoc = documents.find((d) => d.collectionName === activeDocument);

  return (
    <div className="app-container" id="app-container">
      <Header />
      <div className="main-content">
        <aside className="sidebar" id="sidebar">
          <FileUpload
            onUploadComplete={handleUploadComplete}
            onError={handleError}
          />
          <DocumentSidebar
            documents={documents}
            activeDocument={activeDocument}
            onSelectDocument={setActiveDocument}
            onDeleteDocument={handleDeleteDocument}
          />
        </aside>
        <ChatInterface
          collectionName={activeDocument}
          documentName={activeDoc?.fileName || null}
        />
      </div>

      {error && (
        <div className="error-toast" id="error-toast" role="alert">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
