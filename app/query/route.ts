import { sql } from '@/app/lib/db';

const adminEmail = 'admin@school.test';
const hashedPassword = '$2b$10$.tHUpRYKxZJd0nnlGFmEief0U1bdIKoEhfy9GYDbjMP4UWuDqSWb6';

export async function POST(request: Request) {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return Response.json({ error: 'Password reset is not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await sql`
      UPDATE users
      SET password = ${hashedPassword}
      WHERE email = ${adminEmail}
      RETURNING email`;

    if (rows.length === 0) {
      return Response.json({ error: 'Admin account not found.' }, { status: 404 });
    }

    return Response.json({ message: 'Admin password reset successfully.', email: rows[0].email });
  } catch (error) {
    console.error('Failed to reset admin password:', error);
    return Response.json({ error: 'Failed to reset admin password.' }, { status: 500 });
  }
}
