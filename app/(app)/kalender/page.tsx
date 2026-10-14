import { CalendarView } from "@/components/views/calendar-view";
import { addDays, isMonthKey, monthEnd, monthStart } from "@/lib/domain/calendar";
import { monthCalendar } from "@/lib/domain/month-calendar";
import { getFinanceData } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Kalender" };

type Params = Record<string, string | string[] | undefined>;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const [data, params] = await Promise.all([getFinanceData(user.id), searchParams]);
  const month = isMonthKey(params.monat) ? params.monat : data.today.slice(0, 7);
  const calendar = monthCalendar(data.transactions, data.recurring, month, data.today);
  // Nur Buchungen im sichtbaren Raster (plus Rand) an den Browser geben
  const from = addDays(monthStart(month), -7);
  const to = addDays(monthEnd(month), 7);
  return (
    <CalendarView
      calendar={calendar}
      today={data.today}
      transactions={data.transactions.filter((tx) => tx.date >= from && tx.date <= to)}
      recurring={data.recurring}
    />
  );
}
