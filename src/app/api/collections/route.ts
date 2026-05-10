import { NextRequest, NextResponse } from "next/server";
import { QdrantClient } from "@qdrant/js-client-rest";

/**
 * DELETE /api/collections
 *
 * Removes a Qdrant collection when a user deletes a document.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { collectionName } = await request.json();

    if (!collectionName) {
      return NextResponse.json(
        { error: "collectionName is required" },
        { status: 400 }
      );
    }

    const client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    await client.deleteCollection(collectionName);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Delete collection error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete collection: ${message}` },
      { status: 500 }
    );
  }
}
