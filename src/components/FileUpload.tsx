"use client";

import { useCallback, useRef, useState } from "react";

interface FileUploadProps {
  onUploadComplete: (doc: {
    fileName: string;
    collectionName: string;
    chunkCount: number;
    pageCount: number;
  }) => void;
  onError: (message: string) => void;
}

type UploadStep = "idle" | "parsing" | "chunking" | "embedding" | "storing" | "done";

const STEPS: { key: UploadStep; label: string }[] = [
  { key: "parsing", label: "Parsing document" },
  { key: "chunking", label: "Splitting into chunks" },
  { key: "embedding", label: "Generating embeddings" },
  { key: "storing", label: "Storing in vector DB" },
];

export default function FileUpload({ onUploadComplete, onError }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState<UploadStep>("idle");
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const validTypes = [
        "application/pdf",
        "text/plain",
      ];
      const validExtensions = [".pdf", ".txt"];

      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
        onError("Please upload a PDF or TXT file.");
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        onError("File is too large. Maximum size is 20MB.");
        return;
      }

      setUploading(true);
      setCurrentStep("parsing");
      setProgress(10);

      // Simulate step progression since upload is a single request
      const stepTimer = setTimeout(() => {
        setCurrentStep("chunking");
        setProgress(30);
      }, 800);

      const stepTimer2 = setTimeout(() => {
        setCurrentStep("embedding");
        setProgress(60);
      }, 2000);

      const stepTimer3 = setTimeout(() => {
        setCurrentStep("storing");
        setProgress(80);
      }, 4000);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        clearTimeout(stepTimer);
        clearTimeout(stepTimer2);
        clearTimeout(stepTimer3);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload failed");
        }

        const data = await response.json();

        setCurrentStep("done");
        setProgress(100);

        setTimeout(() => {
          setUploading(false);
          setCurrentStep("idle");
          setProgress(0);
          onUploadComplete(data);
        }, 1000);
      } catch (err: unknown) {
        clearTimeout(stepTimer);
        clearTimeout(stepTimer2);
        clearTimeout(stepTimer3);
        setUploading(false);
        setCurrentStep("idle");
        setProgress(0);
        onError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [onUploadComplete, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so same file can be uploaded again
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile]
  );

  const getStepStatus = (stepKey: UploadStep) => {
    const stepOrder: UploadStep[] = ["parsing", "chunking", "embedding", "storing", "done"];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(stepKey);

    if (currentStep === "idle") return "";
    if (stepIndex < currentIndex) return "complete";
    if (stepIndex === currentIndex) return "active";
    return "";
  };

  return (
    <div className="sidebar-header">
      <h2 className="sidebar-title">Upload Document</h2>
      <label
        className={`upload-zone ${dragging ? "dragging" : ""} ${uploading ? "uploading" : ""}`}
        id="upload-zone"
        htmlFor="file-input"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload a document"
        style={{ display: "block", cursor: uploading ? "default" : "pointer" }}
      >
        <input
          ref={inputRef}
          type="file"
          className="upload-input"
          accept=".pdf,.txt"
          onChange={handleChange}
          id="file-input"
          disabled={uploading}
        />

        {!uploading ? (
          <>
            <span className="upload-icon">📄</span>
            <p className="upload-text">Drop a file here or click to browse</p>
            <p className="upload-subtext">Supports PDF and TXT files (max 20MB)</p>
          </>
        ) : (
          <div className="upload-progress">
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="progress-steps">
              {STEPS.map(({ key, label }) => {
                const status = getStepStatus(key);
                return (
                  <div key={key} className={`progress-step ${status}`}>
                    <span className={`step-indicator ${status}`}>
                      {status === "complete" ? "✓" : status === "active" ? "◌" : "○"}
                    </span>
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
