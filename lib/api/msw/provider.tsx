"use client";

import { useEffect } from "react";
import { mockingEnabled } from "./enabled";

export function MswProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!mockingEnabled) return;
    void import("./browser").then(({ worker }) =>
      worker.start({ onUnhandledRequest: "bypass" }),
    );
  }, []);

  return <>{children}</>;
}
