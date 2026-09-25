import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AccessManager from "@/components/admin/AccessManager";

export default async function GestionPage() {
  const user = await getCurrentUser();
  if (user?.role !== "manager") redirect("/taches");
  return <AccessManager />;
}
