import "server-only";
import * as z from "zod";
import { requireSession } from "@/lib/auth/session";

/** EZB-Referenzkurse über frankfurter.dev (kostenlos, ohne API-Key). */
const FX_URL = "https://api.frankfurter.dev/v1/latest?base=EUR";

const fxSchema = z.object({
  date: z.string(),
  rates: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().positive()),
});

export interface FxRates {
  /** Stand der Kurse (JJJJ-MM-TT, EZB-Veröffentlichung) */
  date: string;
  /** 1 EUR = x Währung; EUR selbst = 1 */
  rates: Record<string, number>;
}

/**
 * Kurse werden 6 Stunden im Next-Datencache gehalten – nichts landet in der
 * Datenbank. Bei Fehlern `null` (der Client nutzt dann seinen letzten Stand).
 */
export async function getFxRates(): Promise<FxRates | null> {
  await requireSession();
  try {
    const res = await fetch(FX_URL, { next: { revalidate: 6 * 60 * 60 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = fxSchema.parse(await res.json());
    return { date: data.date, rates: { EUR: 1, ...data.rates } };
  } catch {
    return null;
  }
}
