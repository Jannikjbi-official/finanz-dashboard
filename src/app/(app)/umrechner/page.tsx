import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { CurrencyConverter } from "@/components/converter/currency-converter";
import { getFxRates } from "@/server/fx";

export const metadata: Metadata = { title: "Umrechner" };

export default async function ConverterPage() {
  const rates = await getFxRates();
  return (
    <>
      <PageHeader title="Umrechner" description="Währungen umrechnen – EZB-Referenzkurse" />
      <CurrencyConverter serverRates={rates} />
    </>
  );
}
