import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardView from "@/components/DashboardView";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: { absolute: "Overview · CloudPulse" } };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <DashboardView />
    </Suspense>
  );
}
