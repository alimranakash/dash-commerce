import { redirect } from "next/navigation";

export default async function CreateBrandPage() {
  redirect("/dashboard/brands");
}
