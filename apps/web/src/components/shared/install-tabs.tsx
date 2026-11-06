import { Command } from "@/components/shared/command";
import { PromptBlock } from "@/components/shared/prompt-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** "Command" for terminal users, "Prompt" for the agent for everyone else. */
export function InstallTabs({ command, prompt, className }: { command: string; prompt: string; className?: string }) {
  return (
    <Tabs defaultValue="command" className={className ?? "gap-3"}>
      <TabsList variant="line" className="font-mono">
        <TabsTrigger value="command" className="text-xs">Command</TabsTrigger>
        <TabsTrigger value="prompt" className="text-xs">Prompt</TabsTrigger>
      </TabsList>
      <TabsContent value="command">
        {/* As wide as the command plus its copy button; long commands wrap at the container's edge. */}
        <Command command={command} wrap className="w-fit max-w-full" />
      </TabsContent>
      <TabsContent value="prompt" className="flex flex-col gap-2">
        <PromptBlock text={prompt} />
        <p className="text-xs text-pretty text-muted-foreground">Paste it into your agent (Claude Code, Cursor or Codex) and it does the rest.</p>
      </TabsContent>
    </Tabs>
  );
}
