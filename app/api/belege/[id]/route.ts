import { getReceipt } from "@/lib/server/receipts";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/**
 * Beleg ausliefern - nur an den Eigentuemer. Bilder werden angezeigt,
 * PDFs heruntergeladen (der PDF-Betrachter des Browsers vertraegt sich
 * nicht mit der strengen Content Security Policy).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  const doc = await getReceipt(user.id, id);
  if (!doc) return new Response("Nicht gefunden", { status: 404, headers: { "Cache-Control": "no-store" } });

  const inline = doc.contentType !== "application/pdf";
  const name = encodeURIComponent(doc.fileName);
  return new Response(new Uint8Array(doc.data.buffer), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Length": String(doc.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // Ein Beleg ist nie ein Dokument mit eigenen Skripten
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
