import type { Metadata } from "next";
import { Suspense } from "react";
import SimulatorView from "@/components/SimulatorView";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: { absolute: "Simulator · CloudPulse" } };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SimulatorView />
    </Suspense>
  );
}
