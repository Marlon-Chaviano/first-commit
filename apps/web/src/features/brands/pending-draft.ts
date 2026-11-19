import type { BrandProfile } from "@kits/schema";
import { toast } from "sonner";

export const draftStorageKey = (id: string) => "brand-draft:" + id;

/** Keep the draft in this tab across OAuth. Only its random lookup key goes into the return URL. */
export function logInWithDraft(profile: BrandProfile, navigate: (url: string) => void) {
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(draftStorageKey(id), JSON.stringify(profile));
  } catch {
    toast.error("Your browser could not keep this draft. Allow session storage or reduce the uploaded image size and try again.");
    return;
  }
  navigate("/login?next=" + encodeURIComponent("/brands/new?draft=" + id));
}
