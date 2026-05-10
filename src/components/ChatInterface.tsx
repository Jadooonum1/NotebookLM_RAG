"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Source {
  index: number;
  page: number | string;
  preview: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

interface ChatInterfaceProps {
  collectionName: string | null;
  documentName: string | null;
}

const SUGGESTIONS = [
  "Summarize the key points of this document",
  "What are the main topics covered?",
  "Explain the most important concepts",
  "What conclusions does the document draw?",
];

export default function ChatInterface({
  collectionName,
  documentName,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clear messages when document changes
  useEffect(() => {
    setMessages([]);
  }, [collectionName]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  };

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || !collectionName || isStreaming) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: query.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsStreaming(true);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // Create placeholder assistant message
      const assistantId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim(), collectionName }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Chat request failed");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("No response stream");

        let accumulatedContent = "";
        let sources: Source[] | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "sources") {
                sources = data.sources;
              } else if (data.type === "content") {
                accumulatedContent += data.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: accumulatedContent, sources }
                      : msg
                  )
                );
              } else if (data.type === "done") {
                // Final update with sources
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: accumulatedContent, sources }
                      : msg
                  )
                );
              }
            } catch {
              // Skip malformed SSE chunks
            }
          }
        }
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : "Something went wrong";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: `⚠️ Error: ${errorMsg}` }
              : msg
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [collectionName, isStreaming]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Simple markdown rendering
  const renderMarkdown = (text: string) => {
    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const code = part.replace(/```\w*\n?/, "").replace(/\n?```$/, "");
        return (
          <pre key={i}>
            <code>{code}</code>
          </pre>
        );
      }

      // Process inline formatting
      const lines = part.split("\n");
      return lines.map((line, j) => {
        // Headers
        if (line.startsWith("### "))
          return (
            <p key={`${i}-${j}`}>
              <strong>{line.slice(4)}</strong>
            </p>
          );
        if (line.startsWith("## "))
          return (
            <p key={`${i}-${j}`}>
              <strong>{line.slice(3)}</strong>
            </p>
          );
        if (line.startsWith("# "))
          return (
            <p key={`${i}-${j}`}>
              <strong>{line.slice(2)}</strong>
            </p>
          );

        // List items
        if (line.match(/^[-*]\s/))
          return <li key={`${i}-${j}`}>{formatInline(line.slice(2))}</li>;
        if (line.match(/^\d+\.\s/))
          return (
            <li key={`${i}-${j}`}>
              {formatInline(line.replace(/^\d+\.\s/, ""))}
            </li>
          );

        // Empty lines
        if (line.trim() === "") return null;

        // Regular paragraph
        return <p key={`${i}-${j}`}>{formatInline(line)}</p>;
      });
    });
  };

  const formatInline = (text: string) => {
    // Bold
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      // Inline code
      const codeParts = part.split(/(`[^`]+`)/g);
      return codeParts.map((cp, j) => {
        if (cp.startsWith("`") && cp.endsWith("`")) {
          return <code key={`${i}-${j}`}>{cp.slice(1, -1)}</code>;
        }
        return cp;
      });
    });
  };

  if (!collectionName) {
    return (
      <div className="chat-area">
        <div className="no-document-selected">
          <div className="no-document-icon">📄</div>
          <h2 className="no-document-title">No Document Selected</h2>
          <p className="no-document-text">
            Upload a document using the sidebar, then select it to start a
            conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area" id="chat-area">
      <div className="chat-messages" id="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <h2 className="empty-state-title">
              Chat with {documentName || "your document"}
            </h2>
            <p className="empty-state-text">
              Ask any question about this document. Answers are grounded in the
              document&apos;s content — not from the AI&apos;s general knowledge.
            </p>
            <div className="suggestion-chips">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  className="suggestion-chip"
                  onClick={() => sendMessage(suggestion)}
                  id={`suggestion-${suggestion.slice(0, 20).replace(/\s/g, "-")}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="message" id={`msg-${msg.id}`}>
              <div className={`message-avatar ${msg.role}`}>
                {msg.role === "user" ? "👤" : "✨"}
              </div>
              <div className="message-content">
                <div className="message-role">
                  {msg.role === "user" ? "You" : "NotebookLM"}
                </div>
                <div className="message-text">
                  {msg.content ? (
                    renderMarkdown(msg.content)
                  ) : (
                    <div className="typing-indicator">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  )}
                </div>
                {msg.sources && msg.sources.length > 0 && msg.content && (
                  <div className="message-sources">
                    <div className="sources-title">📎 Sources</div>
                    {msg.sources.map((source) => (
                      <div key={source.index} className="source-item">
                        <span className="source-badge">P{source.page}</span>
                        <span className="source-text">{source.preview}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder={
              isStreaming
                ? "Waiting for response..."
                : "Ask a question about your document..."
            }
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            rows={1}
            id="chat-input"
          />
          <button
            className="chat-send-btn"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            title="Send message"
            aria-label="Send message"
            id="send-button"
          >
            ↑
          </button>
        </div>
        <p className="chat-disclaimer">
          Answers are generated from your document only. Powered by Groq &
          Gemini embeddings.
        </p>
      </div>
    </div>
  );
}
