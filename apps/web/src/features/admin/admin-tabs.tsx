"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface AdminTab {
  id: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

/** The admin sections, one tab each. The open tab lives in ?tab= so it survives reloads and can be linked. */
export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = tabs.some((t) => t.id === params.get("tab")) ? params.get("tab")! : tabs[0]!.id;

  return (
    <Tabs
      value={current}
      onValueChange={(value) => {
        const next = new URLSearchParams(params);
        if (value === tabs[0]!.id) next.delete("tab");
        else next.set("tab", String(value));
        router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
      }}
      className="gap-8"
    >
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList variant="line" className="w-max">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
              {tab.label}
              {tab.count !== undefined && <span className="font-mono text-xs text-muted-foreground tabular-nums">{tab.count}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
