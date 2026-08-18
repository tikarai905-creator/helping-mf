import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getModerationQueue } from "@/lib/queries";
import { isDeepSeekConfigured } from "@/lib/deepseek/config";
import ModerationQueueList from "@/components/ModerationQueueList";
import ScanNowButton from "@/components/ScanNowButton";

export default async function ModerationQueuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_admin) {
    return (
      <div className="mx-auto max-w-md text-center text-sm text-muted">
        Owner only.
      </div>
    );
  }

  const queue = await getModerationQueue();

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Moderation queue</h1>
          <p className="mt-1 text-sm text-muted">
            AI reads public post text only, never the private chat. Nothing sends or deletes on
            its own — you decide.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <ScanNowButton configured={isDeepSeekConfigured()} />
      </div>

      <div className="mt-6">
        <ModerationQueueList initialItems={queue} />
      </div>

      <p className="mt-8 text-sm">
        <Link href="/admin/flags" className="underline">
          User-filed reports
        </Link>{" "}
        ·{" "}
        <Link href="/admin/users" className="underline">
          Message a user
        </Link>
      </p>
    </div>
  );
}
