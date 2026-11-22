import { signOut } from '@/auth';

// Reached when a signed-in user was deactivated or removed: clear the session and go to the login page
export async function GET() {
  await signOut({ redirectTo: '/login' });
}
