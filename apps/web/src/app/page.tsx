import { redirect } from "next/navigation";
import { getSetupStatus } from "@/lib/server/setup";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const status = await getSetupStatus();
  if (status.needsSetup) {
    redirect("/setup");
  }
  redirect("/dashboard");
}
