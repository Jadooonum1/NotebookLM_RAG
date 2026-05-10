import { NextRequest, NextResponse } from "next/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { TaskType } from "@google/generative-ai";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { Document } from "@langchain/core/documents";

/**
 * POST /api/upload
 *
 * Ingestion pipeline:
 * 1. Accept PDF or TXT file via multipart/form-data
 * 2. Parse the document
 * 3. Chunk using RecursiveCharacterTextSplitter
 * 4. Embed using Google Gemini (gemini-embedding-001)
 * 5. Store in Qdrant Cloud
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const fileType = fileName.toLowerCase().endsWith(".pdf") ? "pdf" : "txt";

    // Validate file type
    if (!fileName.toLowerCase().endsWith(".pdf") && !fileName.toLowerCase().endsWith(".txt")) {
      return NextResponse.json(
        { error: "Only PDF and TXT files are supported" },
        { status: 400 }
      );
    }

    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let docs: Document[];

    if (fileType === "pdf") {
      // Write to temp file for PDFLoader
      const tempDir = join(tmpdir(), "notebooklm-uploads");
      await mkdir(tempDir, { recursive: true });
      const tempPath = join(tempDir, `${Date.now()}-${fileName}`);
      await writeFile(tempPath, buffer);

      try {
        const loader = new PDFLoader(tempPath);
        docs = await loader.load();
      } finally {
        // Clean up temp file
        await unlink(tempPath).catch(() => {});
      }
    } else {
      // Plain text file
      const text = buffer.toString("utf-8");
      docs = [
        new Document({
          pageContent: text,
          metadata: { source: fileName, loc: { pageNumber: 1 } },
        }),
      ];
    }

    if (docs.length === 0 || docs.every((d) => d.pageContent.trim() === "")) {
      return NextResponse.json(
        { error: "The document appears to be empty or unreadable" },
        { status: 400 }
      );
    }

    /**
     * CHUNKING STRATEGY: Recursive Character Text Splitting
     *
     * - chunkSize: 800 characters — balances retrieval precision with context completeness
     * - chunkOverlap: 100 characters (~12.5%) — preserves information at chunk boundaries
     * - separators: ["\n\n", "\n", " ", ""] — prioritizes paragraph, then sentence,
     *   then word boundaries for maximum semantic coherence
     *
     * The splitter recursively tries each separator in order, preferring natural
     * text boundaries over arbitrary character cuts.
     */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
      separators: ["\n\n", "\n", " ", ""],
    });

    const splitDocs = await textSplitter.splitDocuments(docs);

    // Add source metadata to each chunk
    splitDocs.forEach((doc, index) => {
      doc.metadata = {
        ...doc.metadata,
        source: fileName,
        chunkIndex: index,
      };
    });

    // Generate a unique collection name (Qdrant-safe)
    const sanitizedName = fileName
      .replace(/\.[^.]+$/, "") // Remove extension
      .replace(/[^a-zA-Z0-9]/g, "_") // Replace non-alphanumeric
      .replace(/_+/g, "_") // Collapse underscores
      .toLowerCase()
      .slice(0, 40); // Limit length
    const collectionName = `${sanitizedName}_${Date.now()}`;

    // Embed and store in Qdrant
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-001",
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      apiKey: process.env.GOOGLE_API_KEY,
    });

    await QdrantVectorStore.fromDocuments(splitDocs, embeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName,
    });

    return NextResponse.json({
      success: true,
      fileName,
      collectionName,
      chunkCount: splitDocs.length,
      pageCount: docs.length,
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `Failed to process document: ${message}` },
      { status: 500 }
    );
  }
}
