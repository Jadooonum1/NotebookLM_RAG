# 📓 NotebookLM — Chat with Your Documents

A full-stack **RAG (Retrieval-Augmented Generation)** application inspired by Google NotebookLM. Upload any PDF or text document and have an intelligent, grounded conversation with it.

> **All APIs used are 100% free** — no credit card required.

![Tech Stack](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Groq](https://img.shields.io/badge/LLM-Groq-orange)
![Google](https://img.shields.io/badge/Embeddings-Gemini-blue)
![Qdrant](https://img.shields.io/badge/VectorDB-Qdrant-red)

---

## 🏗️ Architecture

```
User → Upload PDF/TXT → Parse → Chunk → Embed → Store in Qdrant
User → Ask Question → Embed Query → Search Qdrant → Top-K Chunks → Groq LLM → Streamed Answer
```

### Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Framework | Next.js 16 (App Router, TypeScript) | Free |
| Embeddings | Google Gemini (`gemini-embedding-001`) via Google AI Studio | **Free** |
| LLM | Groq (`llama-3.3-70b-versatile`) | **Free** |
| Vector Database | Qdrant Cloud | **Free** (free tier) |
| Deployment | Vercel | **Free** (Hobby tier) |

---

## 📦 RAG Pipeline

### 1. Document Ingestion (`/api/upload`)
- Accepts PDF (via `PDFLoader`) and plain text files
- Files are parsed and text is extracted

### 2. Chunking Strategy — Recursive Character Text Splitting
The document is split into chunks using `RecursiveCharacterTextSplitter` from LangChain:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `chunkSize` | 800 characters | Balances retrieval precision with contextual completeness |
| `chunkOverlap` | 100 characters (~12.5%) | Preserves information at chunk boundaries |
| Separators | `\n\n` → `\n` → ` ` → `""` | Prioritizes paragraph → sentence → word boundaries |

**How it works:** The splitter recursively tries each separator in priority order. It first attempts to split on paragraph breaks (`\n\n`), ensuring paragraphs stay together. If a paragraph exceeds `chunkSize`, it falls back to sentence breaks (`\n`), then word boundaries (` `), and finally individual characters. This preserves semantic coherence far better than fixed-size splitting.

### 3. Embedding
Chunks are embedded using Google's `gemini-embedding-001` model with `RETRIEVAL_DOCUMENT` task type for optimal RAG performance.

### 4. Vector Storage
Embeddings are stored in **Qdrant Cloud** with metadata (page numbers, source filename, chunk index). Each document gets its own collection for context isolation.

### 5. Retrieval
When a user asks a question, the query is embedded with `RETRIEVAL_QUERY` task type and the top-5 most similar chunks are retrieved via cosine similarity search.

### 6. Generation
Retrieved chunks are injected into a grounded system prompt. The LLM (Groq's `llama-3.3-70b-versatile`) is instructed to:
- Answer **only** from the provided document context
- Cite page numbers when referencing information
- Refuse to answer if context is insufficient (no hallucination)

Responses are **streamed** in real-time using Server-Sent Events (SSE).

---

## 🚀 Getting Started

### Prerequisites
1. **Node.js** 18+ installed
2. Free API keys from:
   - [Google AI Studio](https://ai.google.dev/) → `GOOGLE_API_KEY`
   - [Groq Console](https://console.groq.com/) → `GROQ_API_KEY`
   - [Qdrant Cloud](https://cloud.qdrant.io/) → `QDRANT_URL` + `QDRANT_API_KEY`

### Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd app

# Install dependencies
npm install --legacy-peer-deps

# Copy environment variables
cp .env.example .env.local

# Fill in your API keys in .env.local
# GOOGLE_API_KEY=...
# GROQ_API_KEY=...
# QDRANT_URL=...
# QDRANT_API_KEY=...

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Usage
1. **Upload** a PDF or TXT file using the sidebar
2. **Wait** for processing (parse → chunk → embed → store)
3. **Ask questions** about your document in the chat
4. **View sources** — each answer includes page-level citations

---

## 🌐 Deployment (Vercel)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import your repo
3. Add environment variables in Vercel project settings:
   - `GOOGLE_API_KEY`
   - `GROQ_API_KEY`
   - `QDRANT_URL`
   - `QDRANT_API_KEY`
4. Deploy!

---

## 📁 Project Structure

```
app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── upload/route.ts    # Ingestion pipeline
│   │   │   ├── chat/route.ts      # Retrieval + generation
│   │   │   └── collections/route.ts # Collection management
│   │   ├── globals.css            # Design system
│   │   ├── layout.tsx             # Root layout + SEO
│   │   └── page.tsx               # Main page
│   └── components/
│       ├── Header.tsx             # App branding
│       ├── FileUpload.tsx         # Drag-and-drop upload
│       ├── ChatInterface.tsx      # Streaming chat UI
│       └── DocumentSidebar.tsx    # Document list
├── .env.example                   # Environment template
├── next.config.ts                 # Next.js configuration
└── package.json
```

---

## 🔑 Key Features

- ✅ **Full RAG pipeline**: ingestion → chunking → embedding → storage → retrieval → generation
- ✅ **Grounded answers**: LLM answers only from document context, with source citations
- ✅ **Streaming responses**: Real-time token streaming via SSE
- ✅ **Multi-document support**: Upload multiple documents, each in isolated collections
- ✅ **PDF + TXT support**: Handles both file formats
- ✅ **Modern UI**: Dark glassmorphic design with smooth animations
- ✅ **100% free**: All APIs are free tier, no credit card needed
