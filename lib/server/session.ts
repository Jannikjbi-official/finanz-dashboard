import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/** Fuer Seiten: ohne gueltige Sitzung zur Anmeldung. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/anmelden");
  return user;
}
