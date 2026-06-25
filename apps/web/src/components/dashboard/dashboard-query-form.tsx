"use client";

import { useRouter } from "next/navigation";
import type { FormHTMLAttributes, ReactNode } from "react";

type DashboardQueryFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "method" | "onSubmit"> & {
  actionPath: string;
  children: ReactNode;
};

export function DashboardQueryForm({ actionPath, children, ...props }: DashboardQueryFormProps) {
  const router = useRouter();

  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const params = new URLSearchParams();

        for (const [key, value] of formData.entries()) {
          const stringValue = String(value).trim();

          if (stringValue) {
            params.set(key, stringValue);
          }
        }

        router.push(params.size ? `${actionPath}?${params.toString()}` : actionPath);
      }}
    >
      {children}
    </form>
  );
}
