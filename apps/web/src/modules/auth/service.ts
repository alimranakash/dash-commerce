import { prisma } from "@dash/db";
import { hash } from "bcryptjs";
import { registerSchema, type RegisterInput } from "./schemas";

export async function registerUser(input: RegisterInput) {
  const data = registerSchema.parse(input);
  const existingUser = await prisma.user.findUnique({
    where: {
      email: data.email
    },
    select: {
      id: true
    }
  });

  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  const passwordHash = await hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });

  return user;
}
