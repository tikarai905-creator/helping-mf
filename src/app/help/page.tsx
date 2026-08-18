import { redirect } from "next/navigation";
import { getCurrentUser, getSupportMessagesForUser } from "@/lib/queries";
import SupportChatWindow from "@/components/SupportChatWindow";

export default async function HelpPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const messages = await getSupportMessagesForUser(user.id);

  return (
    <div className="mx-auto flex h-[calc(100dvh-155px)] max-w-lg flex-col">
      <h1 className="text-xl font-semibold text-ink">Help</h1>
      <p className="mt-1 text-sm text-muted">
        An assistant answers using what it knows about Neighbor. The app owner can also read this
        to improve the app — it isn&apos;t private like your peer chats.
      </p>
      <SupportChatWindow initialMessages={messages} />
    </div>
  );
}
