"use client";

import { BRAND, type Selections } from "@kits/schema";
import { CheckIcon, LinkIcon, LoaderCircleIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { TechIcon } from "@/components/shared/tech-icon";
import { Button } from "@/components/ui/button";

type Config = { kit: string; selections: Selections; name?: string };

/**
 * "Share" copies the short link (/k/<id>) and "Post on X" opens a post with the command. On a kit
 * page the link is created on the first click from `config`; on /k/<id> it's already `url`.
 */
export function ShareButtons({ url, config, title, command }: { url?: string; config?: Config; title: string; command: string }) {
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  // The same configuration always gets the same link: remember it until the configuration changes.
  const cache = useRef<{ key: string; url: string } | null>(null);

  const link = async (): Promise<string> => {
    if (url) return new URL(url, BRAND.siteUrl).toString();
    const key = JSON.stringify(config);
    if (cache.current?.key === key) return cache.current.url;
    const res = await fetch("/api/v1/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(config) });
    const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !body.url) throw new Error(body.error ?? "Couldn't create the link");
    cache.current = { key, url: body.url };
    return body.url;
  };

  const copy = async () => {
    setPending(true);
    try {
      await navigator.clipboard.writeText(await link());
      setCopied(true);
      toast.success("Link copied", { description: "It opens this kit with these exact options." });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  };

  const post = async () => {
    // Opened right away so the browser treats it as the click's popup, then pointed at the post.
    const tab = window.open("about:blank", "_blank");
    try {
      const target = await link();
      const text = `${title}, set up for my coding agent in one command with ${BRAND.name}:\n\n${command}`;
      const intent = `https://x.com/intent/post?${new URLSearchParams({ text, url: target })}`;
      if (tab) tab.location.href = intent;
      else window.location.href = intent;
    } catch (error) {
      tab?.close();
      toast.error((error as Error).message);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={copy} disabled={pending}>
        {pending ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : copied ? <CheckIcon data-icon="inline-start" /> : <LinkIcon data-icon="inline-start" />}
        {copied ? "Copied" : "Share"}
      </Button>
      <Button variant="outline" onClick={post} aria-label="Post on X">
        <TechIcon id="x" label="" className="size-3.5" />
        Post
      </Button>
    </>
  );
}
