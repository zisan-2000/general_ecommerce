import Image from "next/image";
import Link from "next/link";
import { BookOpen } from "lucide-react";

type BookParty = {
  id: number;
  name: string;
  image: string | null;
  bookCount: number;
};

export default function BookPartyGrid({
  parties,
  basePath,
  emptyLabel,
}: {
  parties: BookParty[];
  basePath: "/ecommerce/authors" | "/ecommerce/publishers";
  emptyLabel: string;
}) {
  if (parties.length === 0) {
    return <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">{emptyLabel}</div>;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {parties.map((party) => (
        <li key={party.id}>
          <Link href={`${basePath}/${party.id}`} className="group flex h-full items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
              {party.image ? <Image src={party.image} alt="" fill sizes="64px" className="object-cover" /> : <BookOpen className="absolute inset-0 m-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold group-hover:text-primary">{party.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{party.bookCount} book(s)</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
