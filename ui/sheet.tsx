"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react/dist/ssr";
import { cx } from "./cx";

/**
 * Bearbeitungsflaeche: am Desktop ein Panel von rechts, auf dem Handy ein
 * Blatt von unten. So bleibt der Kontext (Liste, Kalender) sichtbar.
 */
export function Sheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(0_0_0/0.6)] backdrop-blur-[2px] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <Dialog.Content
          className={cx(
            "fixed z-50 flex flex-col bg-surface shadow-float focus:outline-none",
            // Handy: Blatt von unten
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[26px] border-t border-line",
            "data-[state=open]:animate-[sheet-up_220ms_cubic-bezier(.2,.8,.2,1)]",
            // Desktop: Panel rechts
            "sm:inset-y-3 sm:left-auto sm:right-3 sm:max-h-none sm:rounded-[26px] sm:border",
            "sm:data-[state=open]:animate-[sheet-left_220ms_cubic-bezier(.2,.8,.2,1)]",
            wide ? "sm:w-[560px]" : "sm:w-[440px]",
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
            <div className="min-w-0">
              <Dialog.Title className="text-[20px] font-bold tracking-[-0.03em]">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-[13px] text-ink-3">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="-mr-1 rounded-full bg-sunken p-2 text-ink-2 hover:text-ink" aria-label="Schließen">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <div className="border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Kurze Rueckfrage vor unumkehrbaren Aktionen. */
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(0_0_0/0.6)] backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-line bg-surface p-6 shadow-float focus:outline-none">
          <Dialog.Title className="text-[16px] font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{description}</Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const SheetClose = Dialog.Close;
