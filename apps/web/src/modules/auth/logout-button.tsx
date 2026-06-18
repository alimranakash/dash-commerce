"use client";

import { Button } from "@dash/ui";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <Button className="secondary action-button" onClick={() => signOut({ callbackUrl: "/login" })}>
      Sign out
    </Button>
  );
}
