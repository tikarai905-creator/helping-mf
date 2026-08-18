import Link from "next/link";
import { getCurrentUser } from "@/lib/queries";
import { signOut } from "@/app/actions";
import { APP_NAME } from "@/lib/config";

export default async function Nav() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link href={user ? "/feed" : "/"} className="text-lg font-semibold text-ink">
          {APP_NAME}
        </Link>

        {user ? (
          <nav className="flex items-center gap-4 text-sm text-ink">
            <Link href="/feed" className="hover:text-coral">
              Feed
            </Link>
            <Link href="/feed/new" className="hover:text-coral">
              Post a need
            </Link>
            <Link href="/messages" className="hover:text-coral">
              Messages
            </Link>
            <Link href="/profile" className="hover:text-coral">
              Profile
            </Link>
            <Link href="/help" className="hover:text-coral">
              Help
            </Link>
            {user.is_admin && (
              <>
                <Link href="/admin/activity" className="hover:text-coral">
                  Activity
                </Link>
                <Link href="/admin/moderation" className="hover:text-coral">
                  Moderation
                </Link>
                <Link href="/admin/flags" className="hover:text-coral">
                  Reports
                </Link>
                <Link href="/admin/support" className="hover:text-coral">
                  Support
                </Link>
                <Link href="/admin/users" className="hover:text-coral">
                  Message a user
                </Link>
              </>
            )}
            <form action={signOut}>
              <button type="submit" className="text-muted hover:text-coral">
                Log out
              </button>
            </form>
          </nav>
        ) : (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-ink hover:text-coral">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-coral px-3 py-1.5 text-white hover:bg-coral-hover"
            >
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
