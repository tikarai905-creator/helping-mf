# HELP APP — BUILD SPEC

*This is the build order for Claude Code. Every decision is already made. Do not ask the user to re-decide these — build them as written. If something here is genuinely impossible or unsafe, flag it, otherwise build. The user wants to see a working UI they can then change directly, not answer more questions.*

*Read THE FOUNDATIONS doc for the "why" behind any of this. This doc is the "what to build."*

---

## THE ONE SENTENCE

**It doesn't have to be just for help. Anyone can post anything. Anyone can reply. But the poster has to accept the reply before anything opens.**

One feed. Any post. Anyone replies. Poster is the gate. Once accepted, the two people see each other and can chat. That's the whole app. It works like Facebook / Kijiji / Indeed had a child — a community board for one city where you post whatever you need (a favor, a hand in the garden, a ride, someone to talk to, anything) and a nearby person chooses to answer.

Do NOT split this into "tasks" vs "talk" vs categories of feature. It is ONE post box and ONE flow, no matter what the post is about.

---

## STACK

- **Frontend:** Next.js (React), mobile-first responsive.
- **Backend/DB/Auth:** Supabase (Postgres, Supabase Auth, Row Level Security).
- **Auth:** email + password. Nothing fancier at launch.
- **No payment integration.** None. Do not wire Stripe or any money movement.
- **No ID/age verification integration.** None. Do not wire Persona/Onfido/etc.

This matches the user's existing DaddyEngine setup (Supabase + Next.js), so patterns carry over.

---

## THE CORE FLOW (build this exact sequence)

1. A user **posts a need** — free text, plus a rough area. The post is **anonymous to the feed**: the crowd sees the need text and rough area ONLY. No name, no photo, no identity of the poster.
2. Any user **browsing the feed sees needs near their area**. They can **reply / raise a hand** on a post.
3. Raising a hand reveals **only the replier** to the poster — a small card (see HELPER CARD below). It does NOT reveal the poster to the replier yet, and does NOT reveal the replier to anyone else.
4. The **poster looks at the replier's card and accepts or declines**. The poster is the gate. The poster may accept **one or many** repliers on the same post.
5. On accept: **profile pictures + names turn on between those two people only**, and an **in-app chat opens** between them. They message freely, can swap phone numbers if they want, arrange whatever, meet or not — the app does not police the chat.
6. The **post stays open until the poster closes it.** Poster opens it, lets in who they want, closes it when done.
7. After a connection, the **person who received the help confirms** it: a simple tap — **good / didn't happen / bad** (Uber end-of-trip style). See THE CONFIRM.

---

## PRIVACY MODEL (non-negotiable — build exactly)

**Identity is OFF in the crowd, ON in the accepted pair.**

- Feed layer: everyone sees the **need only**. Never the poster's name or photo.
- Reply: reveals **only the replier**, and **only to the poster**.
- Accepted pair: names + photos turn on **between those two only**, never to anyone else.

The poster is ALWAYS the gate — including the gate on their own post. Nobody is approached uninvited. No post = no approach.

**The app NEVER reads users' private chat messages.** No AI, no logging-for-reading, nothing inspects the content of the 1-on-1 chat between two matched people. (AI may read *public posts* and *filed reports* — see AI HELPERS — but never the private chat.)

---

## DATA MODEL (Postgres tables — build these)

**users**
- id (uuid, from Supabase auth)
- email
- display_name (first name or handle)
- profile_photo_url (nullable)
- rough_area (text — a neighborhood/area label they set at signup; NOT live GPS)
- age (integer — self-entered at signup, UNVERIFIED, informational only)
- created_at

**posts**
- id
- author_id → users.id (hidden from feed viewers via RLS/serialization)
- body (text — the free-text need; anyone can post anything)
- rough_area (text)
- kind (enum: 'free' | 'trade' | 'paid') — **a LABEL only. No money moves. Just tags what sort of exchange it is.**
- status (enum: 'open' | 'closed')
- is_seed (boolean, default false — true for the labeled example posts that fade as real ones arrive; see EMPTY ROOM)
- created_at

**replies** (a raised hand)
- id
- post_id → posts.id
- replier_id → users.id
- status (enum: 'pending' | 'accepted' | 'declined')
- created_at

**connections** (the web — created when a reply is accepted)
- id
- post_id → posts.id
- helper_id → users.id  (the one who replied/helped)
- receiver_id → users.id (the poster who got helped)
- first_connected_at (timestamp — when this specific pair connected for the FIRST time ever)
- is_repeat (boolean — true if these two users already had a prior connection; drives web-vs-score, see THE ENGINE)
- confirmed_status (enum: null | 'good' | 'didnt_happen' | 'bad')
- confirmed_at (nullable)
- created_at

**flags** (reports)
- id
- flagger_id → users.id
- target_type (enum: 'post' | 'user')
- target_id
- reason (text, optional)
- ai_category (text, nullable — filled by the sorting AI, see AI HELPERS)
- reviewed (boolean, default false — only the owner/admin sees these)
- created_at

**messages** (in-app chat, private)
- id
- connection_id → connections.id  (chat exists only for an accepted pair)
- sender_id → users.id
- body (text)
- created_at
- **Never read/analyzed by AI or the system. Storage + delivery only.**

---

## THE ENGINE — WEB + THREE NUMBERS (make this strong; everything leans on it)

This is NOT a points counter. It is a **web**: people are dots, every confirmed help is an edge between two dots.

**Three numbers on every user's card, read together as a "face":**
1. **Helped count** — how many DIFFERENT people this user has helped (grows on NEW people only).
2. **Score** — how *good* those helps were (slow-moving, see rules).
3. **Got-helped count** — how many times this user received help.

**Web rules:**
- A connection where `is_repeat = false` (a brand-new pair, helper side) grows the helper's **helped count**. This is a new edge, full weight.
- A connection where `is_repeat = true` (same two people again) does **NOT** grow the helped count. The edge already exists.
- The web grows on the **GIVING side**: helping someone and getting it confirmed earns the helper that person (helper can now see/message them anytime). The receiver does not automatically earn the helper.

**Score rules (v1 — build this simple, tune later like a signal dial):**
- Score starts neutral.
- A confirmed **'good'** nudges the helper's score up a little (repeat-help 'good' still counts toward score even though it doesn't grow the web — score = quality of ALL helps, web = new people only).
- A **'bad'** only starts pulling score DOWN once the user has accumulated **3+ 'bad' confirms** in their recent history. One or two bads = noise, ignored (probably a grump or a rejected flagger).
- Score is **slow to build and slow to fall** — no single person can make or wreck someone. It moves on **pattern and volume**, never a single tap.
- This is what defuses a weaponized flag: a rejected person rage-tapping 'bad' is one voice against a whole history, moves almost nothing.

Keep the score formula in ONE clearly-commented place so the user can tune the numbers later like a farm dial. Do not scatter the logic.

**The ripple shown to the user** = the web lighting up outward from their dot ("your help connected you to N people"). Same data as the safety engine, shown back as the reward.

---

## THE CONFIRM

- After a connection, the **receiver** (the poster who got helped) gets a simple prompt: **good / didn't happen / bad**. Uber end-of-trip style.
- The **receiver** confirms — not the helper claiming credit. This stops fake-help farming.
- The helper is naturally motivated to nudge the receiver to confirm (it's how they earn) — the system doesn't chase it, the helper does.
- **Soft fallback:** if the receiver never taps anything after a set window (e.g. 7 days) AND no 'bad' was filed, it can settle as a quiet 'good' worth slightly less than a real confirmed 'good'. Never let honest help vanish entirely; never let silence count as loudly as a real confirm. Put the window length in one config value.

---

## ANTI-FARMING (falls out of the engine — no separate system)

- New connections count; repeat connections fade to nothing (helped count only grows on new pairs).
- The receiver confirms — not the helper.
- The reward is real relationships, so a faked version is worthless by construction.
- A farmer makes a dense dead clump (same two dots); a real helper makes a wide bright spread (many dots). The shape is visible.
- One person raising a hand on many posts unmasks nobody — they only expose themselves to many posters who each decline. The hunter becomes the most-seen, most-declined person. Surface this pattern to the owner's review view (a user with many pending/declined replies across many posters is a readable shape).

**Principle: don't police the cheat — make it pointless.**

---

## FLAGS / REPORTS (owner-reviewed, never auto-acted)

- Anyone can flag a **post** or a **user**.
- A flag drops a row in the **flags** table. **Nothing automatic happens** — no auto-ban, no auto-hide-forever. (Optional: a heavily-flagged post can soft-hide pending review, but never permanent auto-action.)
- Only the **owner/admin** sees the flags table.
- The person filing may be the problem (rejected creep rage-reporting). The owner looks and decides. Someone who flags many people whom nobody else flags is themselves a readable shape — surface that too.

---

## AI HELPERS (optional, additive — build the app WITHOUT these first, add after)

Two jobs, both allowed. Both read **public** data only.
1. **Categorize posts:** read the free-text post body, tag it (repair / ride / yard / moving / talk / other) into a `category` field so the feed can be sorted/filtered. The user likes things categorized — this serves that.
2. **Sort the flag pile:** read filed reports and categorize them (likely-rage-flag / likely-real-concern / duplicate) into `flags.ai_category`, so a solo owner can triage at a glance. AI **sorts**, the owner **decides** — never auto-acts.

**Hard line:** AI reads public posts and filed reports ONLY. AI NEVER reads the private 1-on-1 chat between matched users. Build the core app first; these are a later pass.

---

## THE EMPTY ROOM (seed content)

- Day one the feed would be blank. Seed it with a handful of **labeled example posts** (`is_seed = true`) — e.g. "John needs help moving a couch," "Maria wants someone to talk to," with example numbers on the cards.
- Each seed post shows a small **"example"** tag so nobody taps to help a person who isn't real. Honesty keeps the never-vouch posture clean.
- Seed posts **retire/fade as real posts arrive** (hide seeds once real-post count passes a threshold, or let the owner clear them).
- Running is the win. A quiet room is fine. Do not build growth-hacking or engagement-pressure mechanics.

---

## LOCATION

- User sets a **rough area** at signup (a neighborhood/area label, or a coarse pin). **No live GPS tracking.**
- The feed shows needs in/around the user's area. "Nearby" = same or adjacent area. Keep it coarse and privacy-safe.

---

## LEGAL / COPY RULES (applies to every label and screen)

- **Facilitate, never vouch.** No screen ever says "verified," "safe," "trusted," or "screened."
- Terms/onboarding states plainly: **"You must be 18+. We connect people, we don't vet them. Use your own judgment. Meeting and helping is at your own risk and responsibility."**
- The app is a **classifieds board** (Kijiji/Facebook Marketplace precedent). It connects; it does not guarantee anything.
- Build reasonable walls (consent gate, flags, the confirm). Never promise safety.

---

## BUILD ORDER (do it in this sequence so there's a visible working thing early)

1. **Auth** — email/password signup + login (Supabase Auth). Signup collects display_name, rough_area, age (self-entered), and the 18+/terms acknowledgment.
2. **Post + Feed** — create a post (body, rough_area, kind label, status). Feed lists open posts near the viewer's area, **need-only, poster anonymous.** Seed the feed with labeled example posts.
3. **Reply + Accept** — raise a hand on a post (reveals replier to poster only). Poster's view of their post shows pending repliers' cards; poster accepts/declines; accept can be multiple.
4. **Reveal + Chat** — on accept, names/photos turn on between the pair, and an in-app chat opens (messages table). Private, never analyzed.
5. **Connections + Confirm** — accepting creates a connection row (set is_repeat by checking for a prior pair). Receiver gets the good/didn't-happen/bad confirm. Wire the soft-fallback window.
6. **The Engine** — compute the three numbers from connections + confirms. Web grows on new pairs; score from the v1 rule in one tunable place. Show the three numbers on every user card.
7. **Flags** — flag a post or user → flags table → owner-only review view. No auto-action.
8. **(Later) AI helpers** — post categorization + flag sorting. Public data only, never the chat.

Ship a visible, clickable UI as early as step 2 so the user can start reacting to real screens and change them directly.

---

## STANDING RULES FOR EVERY SESSION (the ripple law)

Nothing here is one isolated thing. A change to one piece must ripple to the pieces it touches, or the work isn't done:

- **Consent gate** is upstream of the feed, reply, reveal, chat, and flags. Every new screen: *did the poster open this door?*
- **Receiver-confirm** feeds → connections → web → the three numbers. Touch the confirm, you've touched all of them.
- **New-vs-repeat edge** holds up anti-farming AND the reward at once. Never make repeat help grow the web.
- **"Facilitate never vouch"** is a language rule on every button and label, not just legal text.

Before adding or changing anything, trace which chains it sits on. If a change doesn't ripple to what it touches, it's a leak, not a finish.

---

*End of build spec. Everything is decided. Build it, show the UI, let the user change it directly.*
