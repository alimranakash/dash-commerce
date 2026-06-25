"use client";

import { LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export function UserAvatarMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userName = session?.user?.name ?? "Account";
  const userEmail = session?.user?.email ?? "";
  const image = session?.user?.image;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open account menu"
        className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-[#dedcf0] bg-[#f7f5ff] text-[#4c2bb7]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {image ? (
          <img alt={userName} className="h-full w-full object-cover" src={image} />
        ) : (
          <UserRound className="h-4 w-4" />
        )}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-[#ececf5] bg-white p-2 text-sm shadow-[0_20px_50px_rgba(62,54,114,0.14)]" role="menu">
          <div className="border-b border-[#efeff5] px-3 py-3">
            <p className="m-0 truncate font-semibold text-[#20212c]">{userName}</p>
            {userEmail ? <p className="m-0 mt-1 truncate text-xs text-[#74758a]">{userEmail}</p> : null}
          </div>
          <Link className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[#30313d] hover:bg-[#f7f5ff] hover:text-[#6d3cf5]" href="/dashboard/profile" onClick={() => setOpen(false)} role="menuitem">
            <UserRound className="h-4 w-4" /> Profile
          </Link>
          <Link className="flex items-center gap-2 rounded-lg px-3 py-2 text-[#30313d] hover:bg-[#f7f5ff] hover:text-[#6d3cf5]" href="/dashboard/profile#security" onClick={() => setOpen(false)} role="menuitem">
            <Settings className="h-4 w-4" /> Account Settings
          </Link>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-red-600 hover:bg-red-50"
            onClick={() => signOut({ callbackUrl: "/login" })}
            role="menuitem"
            type="button"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
