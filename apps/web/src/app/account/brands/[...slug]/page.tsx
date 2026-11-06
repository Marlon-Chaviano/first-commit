import { redirect } from "next/navigation";
import { Suspense } from "react";

/** Brand profiles live at /brands now. */
export default function LegacyBrandPage({ params }: PageProps<"/account/brands/[...slug]">) {
  return (
    <Suspense>
      <Redirect slug={params.then((p) => p.slug.join("/"))} />
    </Suspense>
  );
}

async function Redirect({ slug }: { slug: Promise<string> }) {
  redirect(`/brands/${await slug}`);
}
