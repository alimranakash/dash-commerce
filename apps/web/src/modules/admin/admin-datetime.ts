import { prisma } from "@dash/db";

/**
 * Timezone admin timestamps fall back to.
 *
 * The platform is Bangladesh-oriented and `User.timezone` defaults to the same
 * value, so this is the floor rather than the server's own clock — which is UTC
 * on the deployed box and would render every date six hours behind the day the
 * admin reading it is actually having.
 */
export const DEFAULT_ADMIN_TIME_ZONE = "Asia/Dhaka";

/**
 * The timezone one admin's view should be rendered in: their own profile
 * setting, the one `/dashboard/settings/profile` writes.
 *
 * Admin pages are server components, so `Intl` formats against the *server's*
 * timezone unless it is told otherwise. The session carries no timezone — only
 * id, role, name, email and image are threaded onto the token — so it is read
 * from the row. One indexed lookup per page render.
 */
export async function getAdminTimeZone(userId: string) {
  const user = await prisma.user.findUnique({
    select: {
      timezone: true
    },
    where: {
      id: userId
    }
  });

  return normalizeTimeZone(user?.timezone);
}

/** Medium date plus short time — "Aug 24, 2026, 12:00 PM". */
export function formatAdminDateTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone
  }).format(date);
}

/**
 * `User.timezone` is a plain string column that an old or hand-edited row may
 * hold anything in, and `Intl` throws a `RangeError` on a zone name it does not
 * recognise — which would take a whole admin page down over a profile setting.
 * Anything unusable falls back to the platform default.
 */
function normalizeTimeZone(timeZone: string | null | undefined) {
  const candidate = timeZone?.trim();

  if (!candidate) {
    return DEFAULT_ADMIN_TIME_ZONE;
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_ADMIN_TIME_ZONE;
  }
}
