import { cx } from "@/ui/cx";

/** Textseiten (Rechtliches, FAQ): ruhige Lesespalte mit klaren Ueberschriften. */
export function Prose({ title, intro, children, className }: { title: string; intro?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <article className={cx("mx-auto max-w-[720px] px-5 py-14 sm:px-8 sm:py-20", className)}>
      <h1 className="font-serif text-[36px] leading-tight tracking-[-0.01em] sm:text-[44px]">{title}</h1>
      {intro ? <div className="mt-4 text-[17px] leading-relaxed text-ink-2">{intro}</div> : null}
      <div className="mt-10 flex flex-col gap-8 text-[15px] leading-relaxed text-ink-2 [&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline [&_h2]:mb-2 [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-medium [&_strong]:text-ink [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </article>
  );
}

export function DraftNotice({ children }: { children: React.ReactNode }) {
  return <p className="border-l-2 border-warn bg-warn-soft px-4 py-3 text-[14px] text-ink">{children}</p>;
}
