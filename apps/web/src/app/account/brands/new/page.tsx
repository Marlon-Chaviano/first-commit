import { redirect } from "next/navigation";

/** Brand profiles live at /brands now. */
export default function LegacyNewBrandPage() {
  redirect("/brands/new");
}
