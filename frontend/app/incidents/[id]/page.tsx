import type { Metadata } from "next";
import { notFound } from "next/navigation";
import IncidentView from "@/components/IncidentView";
import { isScenario, SCENARIO_NAMES } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/incidents/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: isScenario(id) ? `Incident: ${SCENARIO_NAMES[id]}` : "Incident" };
}

export default async function Page(props: PageProps<"/incidents/[id]">) {
  const { id } = await props.params;
  if (!isScenario(id)) notFound();
  return <IncidentView scenario={id} />;
}
