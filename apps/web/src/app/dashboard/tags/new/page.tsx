import { redirect } from "next/navigation";

export default async function CreateTagPage() {
  redirect("/dashboard/tags");
}
