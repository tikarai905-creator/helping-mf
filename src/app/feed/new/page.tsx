import Link from "next/link";
import { createPost } from "@/app/actions";
import { getCurrentUser } from "@/lib/queries";
import { KIND_DESCRIPTIONS, KIND_LABELS, MAX_AREA_LENGTH, MAX_POST_BODY_LENGTH } from "@/lib/config";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/feed" className="mb-3 inline-block text-sm text-muted hover:underline">
        ‹ Back to feed
      </Link>

      <h1 className="text-2xl font-semibold text-ink">What do you need?</h1>
      <p className="mt-1 text-sm text-muted">
        Anyone can post anything. Only the need and your rough area show on the feed — your name
        stays off it until you accept someone.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <form action={createPost} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink">
          The need
          <textarea
            name="body"
            required
            rows={4}
            maxLength={MAX_POST_BODY_LENGTH}
            placeholder="A hand moving a couch, a ride to an appointment, someone to talk to — anything."
            className="rounded-lg border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>

        <fieldset className="flex flex-col gap-2 text-sm text-ink">
          <legend className="mb-1">Kind — a label only, no money moves in this app</legend>
          <div className="flex gap-3">
            {(["free", "trade", "paid"] as const).map((kind, i) => (
              <label
                key={kind}
                className="flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg border border-border bg-surface px-2 py-2 has-[:checked]:border-coral has-[:checked]:bg-coral/5"
              >
                <input type="radio" name="kind" value={kind} defaultChecked={i === 0} className="sr-only" />
                <span className="font-medium">{KIND_LABELS[kind]}</span>
                <span className="text-xs text-muted">{KIND_DESCRIPTIONS[kind]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm text-ink">
          Rough area
          <input
            name="rough_area"
            required
            maxLength={MAX_AREA_LENGTH}
            defaultValue={user?.rough_area}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>

        <button
          type="submit"
          className="rounded-full bg-coral px-4 py-2 text-white hover:bg-coral-hover"
        >
          Post it
        </button>
      </form>
    </div>
  );
}
