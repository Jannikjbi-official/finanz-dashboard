"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Divider,
  Input,
  Tab,
  Tabs,
} from "@heroui/react";
import { authClient } from "@/lib/auth-client";

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M20.317 4.369A19.79 19.79 0 0 0 15.885 3c-.2.36-.43.842-.59 1.226a18.27 18.27 0 0 0-5.487 0A12.6 12.6 0 0 0 9.21 3a19.74 19.74 0 0 0-4.435 1.372C1.96 8.58 1.194 12.68 1.577 16.72a19.9 19.9 0 0 0 6.04 3.06c.49-.67.925-1.38 1.3-2.126a12.9 12.9 0 0 1-2.047-.985c.172-.127.34-.26.502-.396a14.2 14.2 0 0 0 12.056 0c.164.14.332.272.502.396-.653.386-1.34.716-2.05.986.375.745.81 1.456 1.3 2.125a19.87 19.87 0 0 0 6.044-3.06c.45-4.68-.769-8.745-3.207-12.351ZM8.52 14.27c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.156 2.42 0 1.335-.955 2.42-2.156 2.42Zm6.962 0c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.156 2.42 0 1.335-.946 2.42-2.156 2.42Z" />
    </svg>
  );
}

export function LoginForm({ discordEnabled }: { discordEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result =
      mode === "signin"
        ? await authClient.signIn.email({ email, password, callbackURL: next })
        : await authClient.signUp.email({
            name: name || email.split("@")[0],
            email,
            password,
            callbackURL: next,
          });

    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Anmeldung fehlgeschlagen");
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function onDiscord() {
    setError(null);
    await authClient.signIn.social({ provider: "discord", callbackURL: next });
  }

  return (
    <Card className="border border-default-100 bg-content1/70 backdrop-blur">
      <CardBody className="gap-5 p-6">
        <Tabs
          aria-label="Modus"
          fullWidth
          selectedKey={mode}
          onSelectionChange={(key) => {
            setMode(key as "signin" | "signup");
            setError(null);
          }}
        >
          <Tab key="signin" title="Anmelden" />
          <Tab key="signup" title="Registrieren" />
        </Tabs>

        {error ? (
          <Alert color="danger" variant="flat" title={error} />
        ) : null}

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <Input
              label="Name"
              value={name}
              onValueChange={setName}
              variant="bordered"
              autoComplete="name"
            />
          ) : null}

          <Input
            isRequired
            type="email"
            label="E-Mail"
            value={email}
            onValueChange={setEmail}
            variant="bordered"
            autoComplete="email"
          />

          <Input
            isRequired
            type="password"
            label="Passwort"
            value={password}
            onValueChange={setPassword}
            variant="bordered"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            description={mode === "signup" ? "Mindestens 8 Zeichen" : undefined}
          />

          <Button color="primary" type="submit" isLoading={loading} fullWidth>
            {mode === "signin" ? "Anmelden" : "Konto anlegen"}
          </Button>
        </form>

        {discordEnabled ? (
          <>
            <div className="flex items-center gap-3">
              <Divider className="flex-1" />
              <span className="text-tiny text-default-400">oder</span>
              <Divider className="flex-1" />
            </div>

            <Button
              variant="bordered"
              startContent={<DiscordIcon />}
              onPress={onDiscord}
              fullWidth
            >
              Mit Discord anmelden
            </Button>
          </>
        ) : (
          <p className="text-center text-tiny text-default-400">
            Discord-Login ist nicht konfiguriert.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
