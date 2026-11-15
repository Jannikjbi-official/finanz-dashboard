"use client";

import { Drawer, Modal, useMediaQuery } from "@heroui/react";
import type { ReactNode } from "react";

/** Formular-Overlay: Drawer von unten am Handy, Modal am PC. */
export function ResponsiveSheet({
  isOpen,
  onOpenChange,
  title,
  icon,
  children,
  size = "md",
  tone = "accent",
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg";
  /** Farbe des Icons: Einnahmen grün, Rest Akzent */
  tone?: "accent" | "success";
}) {
  const toneClass = tone === "success" ? "bg-success/15 text-success" : "bg-accent/15 text-accent";
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  if (isDesktop) {
    return (
      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
          <Modal.Container placement="center" scroll="inside">
            <Modal.Dialog className={size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"}>
              <Modal.CloseTrigger />
              <Modal.Header>
                {icon && <Modal.Icon className={toneClass}>{icon}</Modal.Icon>}
                <Modal.Heading>{title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="pb-2">{children}</Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }
  return (
    <Drawer>
      <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Drawer.Content placement="bottom">
          <Drawer.Dialog className="max-h-[92dvh] rounded-t-[2rem]">
            <Drawer.Handle />
            <Drawer.Header className="flex-row items-center gap-3">
                {icon && (
                  <span className={`flex size-9 items-center justify-center rounded-xl ${toneClass}`} aria-hidden="true">
                    {icon}
                  </span>
                )}
                <Drawer.Heading>{title}</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="pb-safe overflow-y-auto">
              <div className="pb-4">{children}</div>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
