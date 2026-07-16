// Pure helper backing the "random-name spinner" button on `/join/:code`'s
// nickname step. Deliberately not i18n'd — these are curated proper-noun-ish
// combos (like a Discord/Verse-style generated handle), not translatable UI
// copy; only the button's own label/aria-label goes through i18next.
//
// `random` is injectable (defaults to `Math.random`) so this stays a
// deterministic, testable pure function per the repo's Effect-TS-adjacent
// "no hidden I/O" convention — no clock reads, no global RNG baked in.

const ADJECTIVES = [
  "Disco",
  "Neon",
  "Cosmic",
  "Turbo",
  "Velvet",
  "Sparkly",
  "Funky",
  "Electric",
  "Groovy",
  "Rowdy",
  "Sassy",
  "Glitter",
  "Rogue",
  "Mighty",
  "Sneaky",
  "Radiant",
  "Wobbly",
  "Jazzy",
  "Feral",
  "Dazzling",
  "Spicy",
  "Golden",
  "Silky",
  "Booming",
] as const;

const NOUNS = [
  "Llama",
  "Walrus",
  "Falcon",
  "Otter",
  "Panther",
  "Koala",
  "Penguin",
  "Cobra",
  "Flamingo",
  "Raccoon",
  "Tiger",
  "Hedgehog",
  "Dolphin",
  "Phoenix",
  "Badger",
  "Peacock",
  "Wombat",
  "Cheetah",
  "Gecko",
  "Yak",
  "Toucan",
  "Marmot",
  "Panda",
  "Narwhal",
] as const;

/**
 * Picks a random "Adjective Noun" party name (e.g. "Disco Llama") from the
 * curated lists above. `random` returns a value in `[0, 1)`, same contract
 * as `Math.random` — pass a seeded/injected implementation in tests for a
 * deterministic result.
 */
export function randomPartyName(random: () => number = Math.random): string {
  const adjective = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(random() * NOUNS.length)];
  return `${adjective} ${noun}`;
}

// Exported for tests that want to assert against the exact curated lists
// without duplicating them.
export const PARTY_NAME_ADJECTIVES = ADJECTIVES;
export const PARTY_NAME_NOUNS = NOUNS;
