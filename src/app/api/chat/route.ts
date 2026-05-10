import { NextRequest } from "next/server";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { TaskType } from "@google/generative-ai";
import Groq from "groq-sdk";

/**
 * POST /api/chat
 *
 * Retrieval + Generation pipeline:
 * 1. Accept user query and collection name
 * 2. Retrieve top-5 relevant chunks from Qdrant
 * 3. Construct grounded system prompt
 * 4. Stream response from Groq (llama-3.3-70b-versatile)
 */
export async function POST(request: NextRequest) {
  try {
    const { query, collectionName } = await request.json();

    if (!query || !collectionName) {
      return new Response(
        JSON.stringify({ error: "Query and collectionName are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Connect to existing Qdrant collection with Google embeddings
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-001",
      taskType: TaskType.RETRIEVAL_QUERY,
      apiKey: process.env.GOOGLE_API_KEY,
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName,
      }
    );

    // Retrieve top-5 most relevant chunks
    const retriever = vectorStore.asRetriever({ k: 5 });
    const relevantChunks = await retriever.invoke(query);

    // Format context with page numbers
    const context = relevantChunks
      .map((chunk, i) => {
        const page = chunk.metadata?.loc?.pageNumber || chunk.metadata?.pageNumber || "N/A";
        return `[Source ${i + 1} — Page ${page}]\n${chunk.pageContent}`;
      })
      .join("\n\n---\n\n");

    // Build the grounded system prompt
    const systemPrompt = `You are an AI assistant that answers questions based ONLY on the provided document context. You must follow these rules strictly:

RULES:
1. ONLY use information from the provided context to answer the question.
2. If the context does not contain enough information to answer the question, say: "I don't have enough information in the document to answer this question."
3. Do NOT use your general knowledge or training data to supplement answers.
4. When referencing information, mention the source page number (e.g., "According to page X...").
5. Be concise, accurate, and helpful.
6. Format your response with markdown for readability when appropriate.

DOCUMENT CONTEXT:
${context}`;

    // Stream response from Groq
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      stream: true,
      temperature: 0.3, // Low temperature for factual, grounded answers
      max_tokens: 2048,
    });

    // Build sources array for citation
    const sources = relevantChunks.map((chunk, i) => ({
      index: i + 1,
      page: chunk.metadata?.loc?.pageNumber || chunk.metadata?.pageNumber || "N/A",
      preview: chunk.pageContent.slice(0, 150) + "...",
    }));

    // Create a ReadableStream for streaming the response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        // First, send sources as a special message
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "sources", sources })}\n\n`
          )
        );

        // Then stream the LLM response
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "content", content })}\n\n`
              )
            );
          }
        }

        // Signal completion
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error("Chat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: `Failed to generate response: ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
