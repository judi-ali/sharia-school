import postgres from 'postgres';

// One shared client (reused across hot reloads in dev). Use Neon's pooled URL in POSTGRES_URL.
const g = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };
export const sql = g.__sql ?? (g.__sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require', max: 5 }));
