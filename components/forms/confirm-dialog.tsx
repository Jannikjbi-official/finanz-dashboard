"use client";

import { AlertDialog, Button, Spinner } from "@heroui/react";
import type { ReactNode } from "react";

/** Bestaetigung fuer kritische Aktionen (Loeschen, Kuendigen, Archivieren). */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  children,
  confirmLabel,
  tone = "danger",
  pending,
  onConfirm,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
  pending?: boolean;
  onConfirm: () => Promise<boolean>;
}) {
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} isDismissable isKeyboardDismissDisabled={false}>
      <AlertDialog.Container size="sm" placement="center">
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status={tone === "danger" ? "danger" : "accent"} />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3 text-muted">{children}</AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Abbrechen
            </Button>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              isPending={pending}
              onPress={async () => {
                if (await onConfirm()) onOpenChange(false);
              }}
            >
              {({ isPending }) => (
                <>
                  {isPending && <Spinner color="current" size="sm" />}
                  {confirmLabel}
                </>
              )}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
