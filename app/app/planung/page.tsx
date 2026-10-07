import { requireUser } from "@/lib/session";
import { loadFinancialPicture } from "@/lib/server/finance";
import { listTransactions } from "@/lib/server/ledger";
import { addDays, daysBetween, isMonthKey, monthEnd, monthStart } from "@/lib/domain/calendar";
import { formatMoney } from "@/lib/format";
import { CalendarView, type CalendarDay, type CalendarItem } from "@/features/planung/calendar-view";

export const metadata = { title: "Kalender" };

const SOURCE_NOTE = { recurring: "fix", planned: "geplant", goal: "Sparrate", scenario: "" } as const;
const MAX_HORIZON = 400;

export default async function KalenderPage({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;

  // Erst "heute" kennen, dann die Prognose so weit rechnen, dass der Monat abgedeckt ist
  const base = await loadFinancialPicture(user.id, { horizonDays: 1 });
  const today = base.today;
  const month = isMonthKey(params.monat) ? params.monat : today.slice(0, 7);
  const start = monthStart(month);
  const end = monthEnd(month);
  const horizon = Math.min(MAX_HORIZON, Math.max(90, daysBetween(today, end)));

  const [picture, booked] = await Promise.all([
    end >= today ? loadFinancialPicture(user.id, { horizonDays: horizon }) : Promise.resolve(base),
    start <= today ? listTransactions(user.id, { month, query: "", type: null, categoryId: null, accountId: null }) : Promise.resolve({ rows: [], truncated: false }),
  ]);

  const items = new Map<string, CalendarItem[]>();
  const push = (date: string, item: CalendarItem) => items.set(date, [...(items.get(date) ?? []), item]);

  for (const row of booked.rows) {
    if (row.date > today) continue;
    push(row.date, {
      label: row.title,
      amountCents: row.transferGroupId ? null : row.type === "income" ? row.amountCents : -row.amountCents,
      kind: "booked",
      note: row.transferGroupId ? "Umbuchung" : undefined,
    });
  }

  for (const event of picture.forecast.events) {
    if (event.date < start || event.date > end) continue;
    // Heutiges Gebuchtes steht schon drin, Erwartetes fuer heute kommt dazu
    push(event.date, { label: event.label, amountCents: event.amountCents, kind: "expected", note: event.overdue ? "überfällig" : SOURCE_NOTE[event.source] });
  }

  for (const goal of picture.goalDocs) {
    if (goal.deadline && goal.deadline >= start && goal.deadline <= end && goal.savedCents < goal.targetCents) {
      push(goal.deadline, { label: `Frist: ${goal.title}`, amountCents: null, kind: "deadline", note: `noch ${formatMoney(goal.targetCents - goal.savedCents, { whole: true })}` });
    }
  }

  const balanceByDate = new Map(picture.forecast.days.map((d) => [d.date, d.balanceCents]));
  const days: CalendarDay[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    days.push({ date, items: items.get(date) ?? [], balanceCents: balanceByDate.get(date) ?? null });
  }

  return (
    <CalendarView
      month={month}
      today={today}
      days={days}
      reserveCents={picture.safety.reserveCents}
      horizonEnd={picture.forecast.days[picture.forecast.days.length - 1].date}
    />
  );
}

