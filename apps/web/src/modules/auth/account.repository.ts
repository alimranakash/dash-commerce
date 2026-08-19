import { prisma } from "@dash/db";
import { accountIdentifierWhere, type AccountIdentifier } from "./identifier";

/**
 * Every read and write of the columns that identify an account, in one file:
 * `email`, `phone`, their verification stamps, and the password behind them.
 */

export async function findUserByIdentifier(identifier: AccountIdentifier) {
  return prisma.user.findUnique({
    select: {
      id: true
    },
    where: accountIdentifierWhere(identifier)
  });
}

/**
 * The only path that creates an account from a sign-up, and the reason no row
 * can exist with neither an email nor a phone: the handle that was verified is
 * the handle that gets written, and it is marked verified in the same statement
 * because the code has just been confirmed for it.
 */
export async function createVerifiedUser(data: {
  identifier: AccountIdentifier;
  name: string;
  passwordHash: string;
  verifiedAt: Date;
}) {
  return prisma.user.create({
    data: {
      name: data.name,
      passwordHash: data.passwordHash,
      ...(data.identifier.channel === "EMAIL"
        ? { email: data.identifier.email, emailVerified: data.verifiedAt }
        : { phone: data.identifier.phone, phoneVerified: data.verifiedAt })
    },
    select: {
      email: true,
      id: true,
      name: true,
      phone: true,
      role: true
    }
  });
}

export async function updateUserPasswordHash(userId: string, passwordHash: string) {
  return prisma.user.update({
    data: {
      passwordHash
    },
    select: {
      id: true
    },
    where: {
      id: userId
    }
  });
}

/**
 * Writes a newly verified handle onto an existing account.
 *
 * Replacing the one of the pair the visitor already had is the normal case, so
 * the other is left untouched — an account that signed up by phone keeps its
 * phone when it adds an email, and gains a second way to sign in rather than
 * swapping one for the other.
 */
export async function updateUserContact(data: {
  identifier: AccountIdentifier;
  userId: string;
  verifiedAt: Date;
}) {
  return prisma.user.update({
    data:
      data.identifier.channel === "EMAIL"
        ? { email: data.identifier.email, emailVerified: data.verifiedAt }
        : { phone: data.identifier.phone, phoneVerified: data.verifiedAt },
    select: {
      email: true,
      emailVerified: true,
      id: true,
      phone: true,
      phoneVerified: true
    },
    where: {
      id: data.userId
    }
  });
}

export async function getAccountContacts(userId: string) {
  return prisma.user.findUnique({
    select: {
      email: true,
      emailVerified: true,
      phone: true,
      phoneVerified: true
    },
    where: {
      id: userId
    }
  });
}
