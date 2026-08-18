import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/queries";
import { APP_NAME } from "@/lib/config";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/feed");

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <h1 className="max-w-md text-3xl font-semibold leading-tight text-ink">
        Post what you need. A neighbor answers.
      </h1>
      <p className="mt-4 max-w-sm text-muted">
        {APP_NAME} is one board for a favor, a hand in the garden, a ride, or someone to talk to.
        You post, you stay anonymous, and you decide who gets in.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/signup"
          className="rounded-full bg-coral px-5 py-2.5 text-white hover:bg-coral-hover"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-border px-5 py-2.5 text-ink hover:border-coral/40"
        >
          Log in
        </Link>
      </div>
      <p className="mt-10 max-w-sm text-xs text-muted">
        We connect people. We don&apos;t vet them. Use your own judgment —{" "}
        <Link href="/terms" className="underline">
          read more
        </Link>
        .
      </p>
    </div>
  );
}
