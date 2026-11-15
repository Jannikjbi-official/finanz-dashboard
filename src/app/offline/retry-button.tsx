"use client";

import { Button } from "@heroui/react";
import { RefreshCw } from "lucide-react";

export function RetryButton() {
  return (
    <Button onPress={() => window.location.reload()}>
      <RefreshCw className="size-4" aria-hidden="true" />
      Erneut versuchen
    </Button>
  );
}
