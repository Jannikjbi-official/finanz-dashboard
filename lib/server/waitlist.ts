import "server-only";
import { db } from "../mongo";

export type WaitlistDoc = {
  _id: string; // E-Mail in Kleinbuchstaben
  name: string | null;
  consentAt: Date;
  createdAt: Date;
};

export const waitlist = db.collection<WaitlistDoc>("waitlist");
