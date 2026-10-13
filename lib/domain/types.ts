import type { ISODate } from "./calendar";
import type { Interval } from "./schedule";

/**
 * Fachliche Typen ohne Datenbankbezug. Alle Betraege sind ganzzahlige Cent,
 * alle Daten ISO-Strings ("2026-10-12") ohne Uhrzeit.
 */

export type Cents = number;
export type { ISODate, Interval };

export type AccountKind = "giro" | "savings" | "cash" | "paypal" | "other";

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  /** Saldo vor der ersten erfassten Buchung. */
  startBalanceCents: Cents;
  /** Zaehlt zum verfuegbaren Geld. Sparkonten standardmaessig nicht. */
  liquid: boolean;
  archived: boolean;
};

export type TxType = "income" | "expense";

/**
 * booked  = Geld ist tatsaechlich geflossen (Einnahme eingegangen / Ausgabe bezahlt)
 * pending = erwartet bzw. geplant, veraendert noch keinen Kontostand
 */
export type TxStatus = "booked" | "pending";

export type Transaction = {
  id: string;
  type: TxType;
  status: TxStatus;
  amountCents: Cents;
  date: ISODate;
  title: string;
  note: string | null;
  categoryId: string | null;
  accountId: string | null;
  /** Beide Haelften eines Transfers tragen dieselbe ID. */
  transferGroupId: string | null;
  /** Herkunft aus einer regelmaessigen Zahlung ... */
  recurringId: string | null;
  /** ... und der Termin, den diese Buchung beglichen hat. */
  recurringDue: ISODate | null;
  /**
   * Von der Bank vorgemerkt (status "pending"): Der Umsatz ist schon
   * unterwegs, aber noch nicht gebucht. Wird beim naechsten Kontoimport
   * durch den neuen Stand ersetzt.
   */
  bankPending?: boolean;
};

export type RecurringStatus = "active" | "paused" | "cancelled" | "archived";

export type CostType =
  | "rent"
  | "energy"
  | "internet"
  | "phone"
  | "insurance"
  | "subscription"
  | "loan"
  | "other";

export type NoticePeriod = { value: number; unit: "days" | "weeks" | "months" };

/**
 * Regelmaessige Zahlung: Abo, feste Kosten oder regelmaessige Einnahme.
 *
 * Invariante gegen Doppelzaehlung: Jeder Termin VOR `nextDue` ist bereits
 * erledigt (als Buchung erfasst oder bewusst uebersprungen). Offen sind nur
 * Termine ab `nextDue`.
 */
export type Recurring = {
  id: string;
  type: TxType;
  title: string;
  provider: string | null;
  amountCents: Cents;
  interval: Interval;
  /** Erster Termin; bestimmt den Ankertag (31. bleibt 31., Februar wird gekappt). */
  startDate: ISODate;
  /** Naechster offener Termin. */
  nextDue: ISODate;
  status: RecurringStatus;
  costType: CostType;
  categoryId: string | null;
  accountId: string | null;
  /**
   * Vertragsende. Bei gekuendigten Zahlungen der letzte Tag, bis zu dem noch
   * abgebucht wird; ohne Angabe laeuft nach der Kuendigung nichts mehr.
   */
  endDate: ISODate | null;
  /** Datum, an dem gekuendigt wurde. */
  cancelledOn: ISODate | null;
  noticePeriod: NoticePeriod | null;
  note: string | null;
};

export type Category = {
  id: string;
  name: string;
  kind: TxType;
  color: string;
};

/**
 * Wunsch: etwas, das gekauft werden soll. Zaehlt nirgends mit, solange es
 * nur ein Wunsch ist. Erst "eingeplant" entsteht eine geplante Zahlung
 * (Buchung mit status "pending"), die in "Aktuell verfuegbar" eingeht.
 */
export type WishStatus = "idea" | "planned" | "bought" | "dropped";
export type WishPriority = "high" | "normal" | "low";

export type Wish = {
  id: string;
  title: string;
  amountCents: Cents;
  targetDate: ISODate | null;
  status: WishStatus;
  priority: WishPriority;
  group: string | null;
  link: string | null;
  note: string | null;
  categoryId: string | null;
  transactionId: string | null;
  importId: string | null;
};

/** Ein CSV-Import, zur Anzeige und zum Rueckgaengigmachen. */
export type ImportInfo = {
  id: string;
  kind: "transactions" | "wishes";
  fileName: string | null;
  rowCount: number;
  dateFrom: ISODate | null;
  dateTo: ISODate | null;
  /** Zeitpunkt als ISO-String (mit Uhrzeit). */
  createdAt: string;
  undoneAt: string | null;
  undoneCount: number | null;
};
