"use client";

import { ArrowLeftIcon, LoaderCircleIcon, MailIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

import { createOrgAction, sendOrgCodeAction } from "./actions";

const toSlug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 39);
const RESEND_SECONDS = 60;

/** Two steps: the org and a work email, then the 6-digit code sent to that email. */
export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const sendCode = () =>
    start(async () => {
      const r = await sendOrgCodeAction(slug, email);
      if (!r.ok) return void toast.error(r.error);
      setSentTo(r.data.email);
      setCode("");
      setWait(RESEND_SECONDS);
    });

  const verify = (value: string) =>
    start(async () => {
      const r = await createOrgAction(slug, name, value);
      if (!r.ok) {
        setCode("");
        return void toast.error(r.error);
      }
      toast.success("Organization created");
      router.push(`/orgs/${r.data}`);
    });

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6 rounded-xl border p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <MailIcon className="size-5" />
          <h3 className="font-medium">Check your inbox</h3>
          <p className="text-sm text-pretty text-muted-foreground">
            We sent a 6-digit code to <span className="font-mono text-foreground">{sentTo}</span>. It expires in 10 minutes.
          </p>
        </div>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) verify(code);
          }}
        >
          <Field>
            <FieldLabel htmlFor="org-code">Verification code</FieldLabel>
            <InputOTP
              id="org-code"
              maxLength={6}
              value={code}
              onChange={setCode}
              onComplete={verify}
              disabled={pending}
              inputMode="numeric"
              pattern="^[0-9]*$"
              autoFocus
              containerClassName="w-fit"
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-11 font-mono text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending || code.length !== 6}>
              {pending && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
              Verify and create {slug}
            </Button>
            <Button type="button" variant="ghost" disabled={pending || wait > 0} onClick={sendCode}>
              {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
            </Button>
          </div>
        </form>
        <button type="button" onClick={() => setSentTo(null)} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          Change the details
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-6 rounded-xl border p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        sendCode();
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="org-name">Name</FieldLabel>
          <Input
            id="org-name"
            value={name}
            required
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(toSlug(e.target.value));
            }}
            placeholder="Acme Inc."
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="org-slug">Identifier</FieldLabel>
          <Input
            id="org-slug"
            value={slug}
            required
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase());
            }}
            placeholder="acme"
            className="font-mono"
          />
          <FieldDescription>The namespace of its kits: {slug || "acme"}/backend. Use your GitHub organization&apos;s if you have one.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="org-email">Work email</FieldLabel>
          <Input id="org-email" type="email" value={email} required autoComplete="email" onChange={(e) => setEmail(e.target.value)} placeholder="you@acme.com" />
          <FieldDescription>We send a code to verify your company&apos;s domain. Personal addresses (Gmail, Outlook…) aren&apos;t accepted.</FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending || !slug || !email} className="sm:w-fit">
        {pending && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
        Send verification code
      </Button>
    </form>
  );
}
