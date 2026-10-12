import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { registrationOpen } from "@/lib/server/access";
import { getCurrentUser } from "@/lib/server/session";

export const metadata = { title: "Zugang einrichten" };
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/");
  // Sobald alle freigegebenen Adressen ein Konto haben, ist die Registrierung zu
  if (!(await registrationOpen())) redirect("/anmelden");
  return <AuthForm mode="sign-up" next="/" discord={false} canRegister locked={false} />;
}
