import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { sql } from '@/app/lib/db';
import { authConfig } from './auth.config';

type User = { id: string; name: string; email: string; password: string };

async function getUser(email: string): Promise<User | undefined> {
  try {
    const user = await sql<User[]>`SELECT id, name, email, password FROM users WHERE email = ${email}`;
    return user[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);
        if (!parsed.success) return null;
        const user = await getUser(parsed.data.email);
        if (!user) return null;
        return (await bcrypt.compare(parsed.data.password, user.password)) ? user : null;
      },
    }),
  ],
});
