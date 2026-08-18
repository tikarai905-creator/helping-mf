import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <h1 className="text-2xl font-semibold text-ink">Can&apos;t find that</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        This post or page doesn&apos;t exist — maybe it was closed or removed.
      </p>
      <Link
        href="/feed"
        className="mt-6 rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-hover"
      >
        Back to feed
      </Link>
    </div>
  );
}
