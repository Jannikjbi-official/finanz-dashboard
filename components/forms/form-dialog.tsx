"use client";

import { Button, Form, Modal, Spinner } from "@heroui/react";
import type { ReactNode } from "react";

/**
 * Dialog fuer Erfassen und Bearbeiten. Speichern schickt das Formular ab;
 * `onSubmit` liefert true, wenn der Dialog sich schliessen soll.
 */
export function FormDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  submitLabel = "Speichern",
  pending,
  onSubmit,
  children,
  size = "md",
  extraActions,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  submitLabel?: string;
  pending?: boolean;
  onSubmit: () => Promise<boolean>;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  extraActions?: ReactNode;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size={size} placement="center" scroll="inside">
        <Modal.Dialog>
          <Form
            className="contents"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await onSubmit()) onOpenChange(false);
            }}
          >
            <Modal.CloseTrigger aria-label="Schließen" />
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              {description && <p className="label font-normal">{description}</p>}
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">{children}</Modal.Body>
            <Modal.Footer className="flex items-center justify-between gap-2">
              <div>{extraActions}</div>
              <div className="flex gap-2">
                <Button slot="close" variant="tertiary">
                  Abbrechen
                </Button>
                <Button type="submit" isPending={pending}>
                  {({ isPending }) => (
                    <>
                      {isPending && <Spinner color="current" size="sm" />}
                      {submitLabel}
                    </>
                  )}
                </Button>
              </div>
            </Modal.Footer>
          </Form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
