import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

async function listInvoices() {
  const data = await sql`
    UPDATE users
SET password = '$2b$10$P6BiMAEVQAN3NxZi2pIgZ.vT4j4JhaLDg1FD6HXKZi/8A5VNahUt.'
WHERE email = 'admin@school.test'
RETURNING email;
  `;

  return data;
}

export async function GET() {
  // return Response.json({
  //   message:
  //     'Uncomment this file and remove this line. You can delete this file when you are finished.',
  // });
  try {
    return Response.json(await listInvoices());
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
