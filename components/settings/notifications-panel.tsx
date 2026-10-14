"use client";

import { Button, Switch } from "@heroui/react";
import { useState } from "react";
import { TextInput } from "@/components/forms/fields";
import { Panel } from "@/components/ui/panel";
import { useAction } from "@/lib/client/use-action";
import { saveNotificationSettings, sendTestNotification } from "@/lib/server/actions/notify";

/** Discord-Benachrichtigungen: eigener Webhook, was gemeldet wird, Probe. */
export function NotificationsPanel({ webhook, due, monthly }: { webhook: string | null; due: boolean; monthly: boolean }) {
  const { run, pending } = useAction();
  const [url, setUrl] = useState("");
  const [notifyDue, setNotifyDue] = useState(due);
  const [notifyMonthly, setNotifyMonthly] = useState(monthly);

  const toggle = (label: string, value: boolean, onChange: (value: boolean) => void) => (
    <Switch isSelected={value} onChange={onChange} size="sm">
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        {label}
      </Switch.Content>
    </Switch>
  );

  return (
    <Panel
      title="Benachrichtigungen"
      description="Einmal täglich per Discord: fällige und überfällige Abos und feste Kosten, am Monatsanfang ein Rückblick. Jede Meldung kommt nur einmal."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (await run(() => saveNotificationSettings({ webhookUrl: url.trim() || undefined, due: notifyDue, monthly: notifyMonthly }))) setUrl("");
        }}
      >
        {webhook ? (
          <p className="text-[13px] text-muted">
            Webhook gespeichert: <span className="text-foreground">{webhook}</span>
          </p>
        ) : null}
        <TextInput
          label={webhook ? "Neue Webhook-Adresse (optional)" : "Discord-Webhook-Adresse"}
          value={url}
          onChange={setUrl}
          placeholder="https://discord.com/api/webhooks/…"
          description="In Discord: Kanal bearbeiten → Integrationen → Webhooks → Webhook-URL kopieren. Die Adresse wird nur hier gespeichert."
        />
        {toggle("Fällige und überfällige Zahlungen", notifyDue, setNotifyDue)}
        {toggle("Monatsrückblick am Monatsanfang", notifyMonthly, setNotifyMonthly)}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" isPending={pending}>
            Speichern
          </Button>
          {webhook && (
            <>
              <Button size="sm" variant="secondary" isPending={pending} onPress={() => run(() => sendTestNotification())}>
                Testnachricht senden
              </Button>
              <Button size="sm" variant="ghost" onPress={() => run(() => saveNotificationSettings({ webhookUrl: "", due: notifyDue, monthly: notifyMonthly }))}>
                Webhook entfernen
              </Button>
            </>
          )}
        </div>
      </form>
    </Panel>
  );
}
