import { redirect } from "next/navigation";

/** Creating an organization lives in the account area now. */
export default function LegacyNewOrgPage() {
  redirect("/account/orgs/new");
}
