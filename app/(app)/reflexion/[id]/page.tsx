import { notFound } from "next/navigation";
import ThreadView from "@/components/forum/ThreadView";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <ThreadView id={id} />;
}
