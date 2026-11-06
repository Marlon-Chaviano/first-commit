import { redirect } from "next/navigation";

/** "Profile" in the user menu lands on the first tab. */
export default function AccountPage() {
  redirect("/account/kits");
}
