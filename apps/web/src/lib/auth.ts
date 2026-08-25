import "./env";
import { prisma } from "@dash/db";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import { getServerSession } from "next-auth";
import * as CredentialsProviderModule from "next-auth/providers/credentials";
import * as GoogleProviderModule from "next-auth/providers/google";
import type { GoogleProfile } from "next-auth/providers/google";
import { accountIdentifierWhere, parseAccountIdentifier } from "../modules/auth/identifier";
import { loginSchema } from "../modules/auth/schemas";

const nextAuthSecret = process.env.NEXTAUTH_SECRET ?? "dash-commerce-local-dev-secret-change-me";
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const platformOwnerEmail = "alimranakash.bd@gmail.com";
/**
 * Mirrors how NextAuth derives the flag itself, so the cookie names below keep
 * the `__Secure-` prefix it expects on a deployed HTTPS origin and drop it in
 * local development.
 */
const useSecureCookies = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
const cookiePrefix = useSecureCookies ? "__Secure-" : "";
/**
 * How long the OAuth `state` and PKCE `code_verifier` cookies stay valid.
 *
 * NextAuth defaults both to 15 minutes, which is a short window on a phone: the
 * account chooser, a password prompt, and a verification code that has to be
 * fetched from the SMS app can easily outlast it, and a browser backgrounded
 * mid-flow adds however long the user was away. When either has expired by the
 * time Google redirects back, the callback fails with `OAuthCallback` even
 * though the sign-in itself was authorised. An hour costs nothing: both cookies
 * are cleared the moment the callback consumes them.
 */
const oauthCheckCookieMaxAge = 60 * 60;
const CredentialsProvider = resolveDefaultExport(CredentialsProviderModule);
const GoogleProvider = resolveDefaultExport(GoogleProviderModule);

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email or phone and password",
    credentials: {
      identifier: { label: "Email or phone", type: "text" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      const parsedCredentials = loginSchema.safeParse(credentials);

      if (!parsedCredentials.success) {
        return null;
      }

      // An unparseable handle is indistinguishable from a wrong one on purpose:
      // the form must not become a way to ask which numbers are registered.
      const identifier = parseAccountIdentifier(parsedCredentials.data.identifier);

      if (!identifier) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: accountIdentifierWhere(identifier)
      });

      if (!user?.passwordHash || user.isSuspended) {
        return null;
      }

      const isValidPassword = await compare(parsedCredentials.data.password, user.passwordHash);

      if (!isValidPassword) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role
      };
    }
  })
];

if (googleClientId && googleClientSecret) {
  providers.unshift(GoogleProvider({
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    allowDangerousEmailAccountLinking: true,
    authorization: {
      params: {
        prompt: "select_account",
        scope: "openid email profile"
      }
    }
  }));
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as never) as unknown as Adapter,
  secret: nextAuthSecret,
  session: {
    strategy: "jwt"
  },
  pages: {
    error: "/login",
    signIn: "/login"
  },
  // Only the two OAuth check cookies are overridden; every other name and option
  // stays on the NextAuth default.
  cookies: {
    pkceCodeVerifier: {
      name: `${cookiePrefix}next-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        maxAge: oauthCheckCookieMaxAge,
        path: "/",
        sameSite: "lax",
        secure: useSecureCookies
      }
    },
    state: {
      name: `${cookiePrefix}next-auth.state`,
      options: {
        httpOnly: true,
        maxAge: oauthCheckCookieMaxAge,
        path: "/",
        sameSite: "lax",
        secure: useSecureCookies
      }
    }
  },
  providers,
  callbacks: {
    async signIn({ account, profile, user }) {
      const email = account?.provider === "google"
        ? (profile as GoogleProfile | undefined)?.email
        : user.email;

      if (account?.provider === "google") {
        const googleProfile = profile as GoogleProfile | undefined;

        if (!googleProfile?.email || !googleProfile.email_verified) {
          return false;
        }
      }

      if (await isSuspendedAccount(email)) {
        return false;
      }

      await ensurePlatformOwnerAdmin(email);
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      const owner = await ensurePlatformOwnerAdmin(user?.email ?? token.email);

      if (owner) {
        token.id = owner.id;
        token.role = owner.role;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }

      return session;
    }
  }
};

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);

  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

async function isSuspendedAccount(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    },
    select: {
      isSuspended: true
    }
  });

  return user?.isSuspended === true;
}

async function ensurePlatformOwnerAdmin(email: string | null | undefined) {
  if (email?.trim().toLowerCase() !== platformOwnerEmail) {
    return null;
  }

  const owner = await prisma.user.findUnique({
    where: {
      email: platformOwnerEmail
    },
    select: {
      id: true,
      role: true
    }
  });

  if (!owner) {
    return null;
  }

  if (owner.role !== "ADMIN") {
    await prisma.user.update({
      where: {
        id: owner.id
      },
      data: {
        role: "ADMIN"
      }
    });
  }

  return {
    id: owner.id,
    role: "ADMIN" as const
  };
}

function resolveDefaultExport<T>(module: T): T extends { default: infer U } ? U : T {
  let current = module as unknown;

  while (
    current &&
    typeof current === "object" &&
    "default" in current &&
    Object.keys(current).every((key) => key === "default" || key === "__esModule")
  ) {
    current = (current as { default: unknown }).default;
  }

  return current as T extends { default: infer U } ? U : T;
}
