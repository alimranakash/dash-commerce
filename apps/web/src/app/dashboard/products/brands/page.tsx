import { redirect } from "next/navigation";

export default function LegacyBrandsPage() {
  redirect("/dashboard/brands");
}
