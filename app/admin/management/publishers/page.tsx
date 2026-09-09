import { notFound } from "next/navigation";
import BookPartyManager from "@/components/management/BookPartyManager";
import { isFeatureEnabled } from "@/lib/store-features-server";

export default async function PublishersAdminPage() {
  if (!(await isFeatureEnabled("BOOKS"))) notFound();
  return <BookPartyManager kind="publishers" />;
}
