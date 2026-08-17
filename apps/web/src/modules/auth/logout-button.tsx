"use client";

import { Button } from "@dash/ui";
import { signOut } from "next-auth/react";

export function LogoutButton({
  callbackUrl = "/login",
  label = "Sign out"
}: {
  callbackUrl?: string;
  label?: string;
} = {}) {
  return (
    <Button className="secondary action-button" onClick={() => signOut({ callbackUrl })}>
      {label}
    </Button>
  );
}
