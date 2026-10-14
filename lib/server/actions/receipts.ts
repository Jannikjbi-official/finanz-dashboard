"use server";

import { addReceipt, deleteReceipt, listReceipts, MAX_RECEIPT_BYTES, type ReceiptInfo } from "../receipts";
import { getCurrentUser } from "../session";
import { authorize, fail, ok, refresh, type ActionResult } from "./shared";

/** Beleg hochladen: FormData mit "transactionId" und "file". */
export async function uploadReceipt(form: FormData): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const transactionId = form.get("transactionId");
  const file = form.get("file");
  if (typeof transactionId !== "string" || !(file instanceof File)) return fail("Bitte eine Datei wählen.");
  if (file.size > MAX_RECEIPT_BYTES) return fail("Die Datei ist zu groß (höchstens 2 MB).");
  const result = await addReceipt(auth.userId, transactionId, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  if (!result.ok) return fail(result.error);
  refresh();
  return ok("Beleg angehängt");
}

/** Belege einer Buchung (nur Angaben, ohne Inhalt). */
export async function getReceipts(transactionId: string): Promise<ReceiptInfo[]> {
  const user = await getCurrentUser();
  if (!user || typeof transactionId !== "string") return [];
  return listReceipts(user.id, transactionId);
}

export async function removeReceipt(id: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  if (typeof id !== "string" || !(await deleteReceipt(auth.userId, id))) return fail("Beleg nicht gefunden");
  refresh();
  return ok("Beleg entfernt");
}
