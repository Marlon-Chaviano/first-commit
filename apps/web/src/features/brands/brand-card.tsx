import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

import { BrandPreview } from "./brand-preview";

type Props = {
  href: string;
  label: string;
  profile: ComponentProps<typeof BrandPreview>["profile"];
};

/** The same linked preview for a public template and a saved profile. */
export function BrandCard({ href, label, profile }: Props) {
  return (
    <Link href={href} prefetch={false} aria-label={label}
      className="group block h-full rounded-xl hover:ring-1 hover:ring-foreground/40 focus-visible:outline-2 focus-visible:outline-ring">
      <BrandPreview profile={profile} showAssets={false}
        action={<ArrowUpRightIcon aria-hidden="true" className="size-4 text-muted-foreground group-hover:text-foreground" />} />
    </Link>
  );
}
