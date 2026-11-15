"use client";

import {
  Accordion,
  AlertDialog,
  Avatar,
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast,
} from "@heroui/react";
import {
  ChevronDown,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  LogOut,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FileTrigger } from "react-aria-components";
import { DiscordIcon } from "@/components/brand/logo";
import { ColorInput } from "@/components/forms/color-input";
import { MoneyField } from "@/components/forms/fields";
import { type ThemeChoice, useAppTheme } from "@/components/providers/theme-provider";
import { LOCK_KEY, useInstallPrompt } from "@/components/shell/background-services";
import { signOut } from "@/lib/client/sign-out";
import { eurosToCents, formatCents } from "@/lib/money";
import { deleteAllData, importBackup, saveSettings } from "@/server/actions";

const DEFAULT_ACCENT = "#5b5cf0";

export function SettingsView({
  user,
  settings,
  version,
}: {
  user: { name: string; image: string | null; discordId: string | null; emergency: boolean };
  settings: { accentColor: string | null; startBalanceCents: number };
  version: string;
}) {
  return (
    <Accordion
      allowsMultipleExpanded
      defaultExpandedKeys={["darstellung"]}
      className="flex flex-col gap-3"
      variant="surface"
    >
      <Section id="darstellung" title="Darstellung" icon={<Palette className="size-5" />}>
        <Appearance accent={settings.accentColor} />
      </Section>
      <Section id="daten" title="Daten" icon={<Database className="size-5" />}>
        <DataSection startBalanceCents={settings.startBalanceCents} />
      </Section>
      <Section id="konto" title="Konto" icon={<UserRound className="size-5" />}>
        <AccountSection user={user} />
      </Section>
      <Section id="app" title="App" icon={<Smartphone className="size-5" />}>
        <AppSection version={version} />
      </Section>
    </Accordion>
  );
}

function Section({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Accordion.Item id={id} className="rounded-3xl">
      <Accordion.Heading>
        <Accordion.Trigger className="min-h-16 px-5">
          <span className="me-3 flex size-9 items-center justify-center rounded-xl bg-accent/12 text-accent">{icon}</span>
          <span className="text-base font-semibold">{title}</span>
          <Accordion.Indicator>
            <ChevronDown />
          </Accordion.Indicator>
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body className="flex flex-col gap-6 px-5 pb-6">{children}</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/* ── Darstellung ─────────────────────────────────────────────────────────── */

function Appearance({ accent }: { accent: string | null }) {
  const { theme, setTheme } = useAppTheme();
  const router = useRouter();
  const [color, setColor] = useState(accent ?? DEFAULT_ACCENT);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = (hex: string | null) => {
    if (hex) {
      document.documentElement.style.setProperty("--accent", hex);
      localStorage.setItem("finanzen-accent", hex);
    } else {
      document.documentElement.style.removeProperty("--accent");
      localStorage.removeItem("finanzen-accent");
    }
  };

  const change = (hex: string) => {
    setColor(hex);
    apply(hex);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await saveSettings({ accentColor: hex });
      if (!res.ok) toast.danger(res.error);
      else router.refresh();
    }, 500);
  };

  return (
    <>
      <Row title="Farbschema" description="Dunkel ist Standard.">
        <ToggleButtonGroup
          aria-label="Farbschema"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([theme])}
          onSelectionChange={(keys) => {
            const k = [...keys][0];
            if (k) setTheme(k as ThemeChoice);
          }}
        >
          <ToggleButton id="light" className="min-h-11">
            <Sun className="size-4" /> Hell
          </ToggleButton>
          <ToggleButton id="dark" className="min-h-11">
            <ToggleButtonGroup.Separator />
            <Moon className="size-4" /> Dunkel
          </ToggleButton>
          <ToggleButton id="system" className="min-h-11">
            <ToggleButtonGroup.Separator />
            <Monitor className="size-4" /> System
          </ToggleButton>
        </ToggleButtonGroup>
      </Row>
      <Row title="Akzentfarbe" description="Buttons, Links und Hervorhebungen – auf allen Geräten.">
        <ColorInput label="Akzent" value={color} onChange={change} />
        <Button
          variant="ghost"
          onPress={async () => {
            setColor(DEFAULT_ACCENT);
            apply(null);
            await saveSettings({ accentColor: null });
            router.refresh();
          }}
        >
          Zurücksetzen
        </Button>
      </Row>
    </>
  );
}

/* ── Daten ───────────────────────────────────────────────────────────────── */

function DataSection({ startBalanceCents }: { startBalanceCents: number }) {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(startBalanceCents / 100);
  const [pending, start] = useTransition();
  const [importing, setImporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const download = (format: "csv" | "json") => {
    window.location.href = `/api/export?format=${format}`;
  };

  return (
    <>
      <Row title="Startguthaben" description="Kontostand vor deiner ersten Buchung – Basis für den Kontostand-Verlauf.">
        <div className="flex items-end gap-2">
          <MoneyField label="Startguthaben" name="startBalance" value={balance} onChange={setBalance} minValue={-1_000_000} className="w-44" />
          <Button
            variant="secondary"
            isPending={pending}
            className="mb-0.5"
            onPress={() =>
              start(async () => {
                const res = await saveSettings({ startBalanceCents: eurosToCents(balance ?? 0) });
                if (res.ok) {
                  toast.success(`Startguthaben: ${formatCents(eurosToCents(balance ?? 0))}`);
                  router.refresh();
                } else toast.danger(res.error);
              })
            }
          >
            Speichern
          </Button>
        </div>
      </Row>
      <Row title="Export" description="Alle Daten als Tabelle (CSV, für Excel) oder als Backup (JSON).">
        <Button variant="secondary" onPress={() => download("csv")}>
          <FileSpreadsheet className="size-4" /> CSV
        </Button>
        <Button variant="secondary" onPress={() => download("json")}>
          <FileJson className="size-4" /> JSON-Backup
        </Button>
      </Row>
      <Row title="Backup importieren" description="Ersetzt alle aktuellen Daten durch das Backup (JSON).">
        <FileTrigger
          acceptedFileTypes={["application/json", ".json"]}
          onSelect={async (files) => {
            const file = files?.[0];
            if (!file) return;
            setImporting(true);
            try {
              const text = await file.text();
              const json = JSON.parse(text) as unknown;
              const res = await importBackup(json);
              if (res.ok) {
                toast.success("Backup importiert", {
                  description: `${res.data.expenses} Ausgaben, ${res.data.incomes} Einnahmen, ${res.data.subscriptions} Abos, ${res.data.wishes} Wünsche`,
                });
                router.refresh();
              } else toast.danger(res.fieldErrors?.file ?? res.error);
            } catch {
              toast.danger("Die Datei konnte nicht gelesen werden.");
            } finally {
              setImporting(false);
            }
          }}
        >
          <Button variant="secondary" isPending={importing}>
            <Upload className="size-4" /> JSON importieren
          </Button>
        </FileTrigger>
      </Row>
      <Row title="Alles löschen" description="Löscht alle Ausgaben, Einnahmen, Abos, Wünsche und Kategorien unwiderruflich.">
        <Button variant="danger-soft" onPress={() => setDeleteOpen(true)}>
          <Trash2 className="size-4" /> Alles löschen
        </Button>
      </Row>

      <AlertDialog>
        <AlertDialog.Backdrop
          isOpen={deleteOpen}
          onOpenChange={(o) => {
            setDeleteOpen(o);
            if (!o) {
              setConfirm("");
              setDeleteError(null);
            }
          }}
        >
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[440px]">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>Wirklich alles löschen?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="flex flex-col gap-4">
                <p>
                  Das kann nicht rückgängig gemacht werden. Lade vorher am besten ein <strong>JSON-Backup</strong> herunter.
                </p>
                <TextField value={confirm} onChange={setConfirm} isInvalid={!!deleteError} autoFocus>
                  <Label>Zur Bestätigung „LÖSCHEN“ eintippen</Label>
                  <Input placeholder="LÖSCHEN" autoComplete="off" />
                  <FieldError>{deleteError}</FieldError>
                </TextField>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  Abbrechen
                </Button>
                <Button
                  variant="danger"
                  isDisabled={confirm !== "LÖSCHEN"}
                  isPending={pending}
                  onPress={() =>
                    start(async () => {
                      const res = await deleteAllData(confirm);
                      if (res.ok) {
                        toast.success("Alle Daten gelöscht");
                        setDeleteOpen(false);
                        setConfirm("");
                        router.refresh();
                      } else setDeleteError(res.fieldErrors?.confirmation ?? res.error);
                    })
                  }
                >
                  Endgültig löschen
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  );
}

/* ── Konto ───────────────────────────────────────────────────────────────── */

function AccountSection({ user }: { user: { name: string; image: string | null; discordId: string | null; emergency: boolean } }) {
  const [pending, setPending] = useState<"one" | "all" | null>(null);
  return (
    <>
      <div className="flex items-center gap-4 rounded-2xl bg-surface-secondary p-4">
        <Avatar size="lg">
          {user.image && <Avatar.Image src={user.image} alt="" />}
          <Avatar.Fallback>{user.name.slice(0, 2).toUpperCase()}</Avatar.Fallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <DiscordIcon className="size-4 text-[#5865F2]" /> Discord verbunden
            {user.discordId && <span className="tabular hidden sm:inline">· ID {user.discordId}</span>}
          </p>
        </div>
        <Chip size="sm" variant="soft" color="success">
          <ShieldCheck className="size-3" />
          <Chip.Label>Freigeschaltet</Chip.Label>
        </Chip>
      </div>
      {user.emergency && (
        <p className="text-sm text-warning">
          Dieses Konto wurde per Notfall-Login angelegt. Melde dich einmal mit Discord an, um Name und Avatar zu übernehmen.
        </p>
      )}
      <Row title="Abmelden" description="Session auf diesem Gerät beenden.">
        <Button
          variant="secondary"
          isPending={pending === "one"}
          onPress={async () => {
            setPending("one");
            await signOut(false);
          }}
        >
          <LogOut className="size-4" /> Abmelden
        </Button>
      </Row>
      <Row title="Auf allen Geräten abmelden" description="Beendet alle Sessions – Handy, PC und installierte App.">
        <Button
          variant="danger-soft"
          isPending={pending === "all"}
          onPress={async () => {
            setPending("all");
            await signOut(true);
          }}
        >
          <LogOut className="size-4" /> Überall abmelden
        </Button>
      </Row>
    </>
  );
}

/* ── App ─────────────────────────────────────────────────────────────────── */

const LOCK_OPTIONS = [
  { id: "0", label: "Aus" },
  { id: "5", label: "Nach 5 Minuten" },
  { id: "15", label: "Nach 15 Minuten" },
  { id: "30", label: "Nach 30 Minuten" },
  { id: "60", label: "Nach 1 Stunde" },
];

function AppSection({ version }: { version: string }) {
  const { canPrompt, installed, ios, install } = useInstallPrompt();
  const [lock, setLock] = useState("0");
  useEffect(() => setLock(localStorage.getItem(LOCK_KEY) ?? "0"), []);

  return (
    <>
      <Row
        title="App installieren"
        description={
          installed
            ? "Läuft bereits als installierte App."
            : ios
              ? "Safari: Teilen → „Zum Home-Bildschirm“."
              : "Als eigenständige App auf Handy oder PC installieren."
        }
      >
        <Button isDisabled={installed || !canPrompt} onPress={() => void install()}>
          <Download className="size-4" /> {installed ? "Installiert" : "Installieren"}
        </Button>
      </Row>
      <Row title="App-Sperre" description="Automatisch abmelden nach Inaktivität (gilt für dieses Gerät).">
        <Select
          aria-label="App-Sperre"
          value={lock}
          onChange={(k) => {
            const v = String(k ?? "0");
            setLock(v);
            localStorage.setItem(LOCK_KEY, v);
            localStorage.setItem("finanzen-last-activity", String(Date.now()));
            toast.success(v === "0" ? "App-Sperre aus" : `App-Sperre: ${LOCK_OPTIONS.find((o) => o.id === v)?.label}`);
          }}
          className="w-52"
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {LOCK_OPTIONS.map((o) => (
                <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                  {o.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </Row>
      <Row title="Version" description="Finanzen – private Finanz-App">
        <Chip variant="soft">v{version}</Chip>
      </Row>
    </>
  );
}
