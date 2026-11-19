import { Skeleton } from "@/components/ui/skeleton";
import { BrandSkeletons } from "@/features/brands/brand-skeletons";

export default function LoadingBrands() {
  return (
    <div role="status" className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <span className="sr-only">Loading brands…</span>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-10 w-56 motion-reduce:animate-none" />
        <Skeleton className="h-5 w-full max-w-xl motion-reduce:animate-none" />
      </div>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-8 w-40 motion-reduce:animate-none" />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><BrandSkeletons count={6} /></ul>
      </div>
    </div>
  );
}
