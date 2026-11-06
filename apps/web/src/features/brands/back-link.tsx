import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

export function BackLink() {
  return (
    <Link href="/brands" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="size-3.5" />
      Brand profiles
    </Link>
  );
}
