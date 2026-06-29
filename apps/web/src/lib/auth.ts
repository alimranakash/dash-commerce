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
import { loginSchema } from "../modules/auth/schemas";

const nextAuthSecret = process.env.NEXTAUTH_SECRET ?? "dash-commerce-local-dev-secret-change-me";
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const platformOwnerEmail = "alimranakash.bd@gmail.com";
const CredentialsProvider = resolveDefaultExport(CredentialsProviderModule);
const GoogleProvider = resolveDefaultExport(GoogleProviderModule);

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      const parsedCredentials = loginSchema.safeParse(credentials);

      if (!parsedCredentials.success) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: {
          email: parsedCredentials.data.email
        }
      });

      if (!user?.passwordHash) {
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
