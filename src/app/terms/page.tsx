import { TERMS_TEXT } from "@/lib/config";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold text-ink">Terms &amp; how this works</h1>
      <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink/80">{TERMS_TEXT}</p>
      <p className="mt-6 text-sm text-muted">
        This is a classifieds board, like Kijiji or Facebook Marketplace. It connects people who
        post needs with people who want to help. It does not screen, verify, or guarantee anyone.
      </p>
    </div>
  );
}
