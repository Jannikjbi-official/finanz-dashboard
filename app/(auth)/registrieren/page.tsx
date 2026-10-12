import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/server/session";

export const metadata = { title: "Registrieren" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/");
  return <AuthForm mode="sign-up" next="/" discord={false} />;
}
