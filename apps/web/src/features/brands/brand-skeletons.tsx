import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function BrandSkeletons({ count }: { count: number }) {
  return Array.from({ length: count }, (_, index) => (
    <li key={index} aria-hidden="true" className="motion-reduce:[&_[data-slot=skeleton]]:animate-none">
      <Card size="sm" className="h-full">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-10" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <div className="grid grid-cols-[2fr_1fr] gap-1.5">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <div className="border-t pt-2"><Skeleton className="h-4 w-1/2" /></div>
        </CardContent>
      </Card>
    </li>
  ));
}
