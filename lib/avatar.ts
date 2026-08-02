import { createAvatar } from "@dicebear/core";
import { funEmoji } from "@dicebear/collection";

export const AVATAR_PRESETS = [
  { id: "sunrise", label: "Sunrise", seed: "Sunrise", background: "f7c873", eyes: "cute", mouth: "lilSmile" },
  { id: "ocean", label: "Ocean", seed: "Ocean", background: "b7dfe4", eyes: "wink", mouth: "wideSmile" },
  { id: "lavender", label: "Lavender", seed: "Lavender", background: "d8d2f3", eyes: "love", mouth: "shy" },
  { id: "meadow", label: "Meadow", seed: "Meadow", background: "bfe2c7", eyes: "plain", mouth: "smileTeeth" },
  { id: "coral", label: "Coral", seed: "Coral", background: "f7c2b4", eyes: "stars", mouth: "cute" },
  { id: "citrus", label: "Citrus", seed: "Citrus", background: "f4df9b", eyes: "glasses", mouth: "smileLol" },
  { id: "berry", label: "Berry", seed: "Berry", background: "e5bfd8", eyes: "closed", mouth: "kissHeart" },
  { id: "sky", label: "Sky", seed: "Sky", background: "bcd4f2", eyes: "tearDrop", mouth: "tongueOut" },
  { id: "mint", label: "Mint", seed: "Mint", background: "b9e5d4", eyes: "wink2", mouth: "shout" },
  { id: "midnight", label: "Midnight", seed: "Midnight", background: "bfc8e8", eyes: "shades", mouth: "plain" },
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number]["id"];

const RANDOM_BACKGROUNDS = ["f7c873", "b7dfe4", "d8d2f3", "bfe2c7", "f7c2b4", "f4df9b", "e5bfd8", "bcd4f2", "b9e5d4", "bfc8e8"] as const;
const RANDOM_EYES = ["sad", "tearDrop", "pissed", "cute", "wink", "wink2", "plain", "glasses", "closed", "love", "stars", "shades", "closed2", "crying", "sleepClose"] as const;
const RANDOM_MOUTHS = ["plain", "lilSmile", "sad", "shy", "cute", "wideSmile", "shout", "smileTeeth", "smileLol", "pissed", "drip", "tongueOut", "kissHeart", "sick", "faceMask"] as const;

type RandomAvatarConfig = {
  seed: string;
  background: (typeof RANDOM_BACKGROUNDS)[number];
  eyes: (typeof RANDOM_EYES)[number];
  mouth: (typeof RANDOM_MOUTHS)[number];
};

function pick<T>(values: readonly T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

export function randomAvatarPreset() {
  const config: RandomAvatarConfig = {
    seed: `surprise-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    background: pick(RANDOM_BACKGROUNDS),
    eyes: pick(RANDOM_EYES),
    mouth: pick(RANDOM_MOUTHS),
  };
  return `random:${config.seed}:${config.background}:${config.eyes}:${config.mouth}`;
}

function parseRandomAvatar(preset: string | null | undefined): RandomAvatarConfig | null {
  if (!preset?.startsWith("random:")) return null;
  const [, seed, background, eyes, mouth] = preset.split(":");
  if (!seed || !RANDOM_BACKGROUNDS.includes(background as RandomAvatarConfig["background"]) || !RANDOM_EYES.includes(eyes as RandomAvatarConfig["eyes"]) || !RANDOM_MOUTHS.includes(mouth as RandomAvatarConfig["mouth"])) return null;
  return { seed, background: background as RandomAvatarConfig["background"], eyes: eyes as RandomAvatarConfig["eyes"], mouth: mouth as RandomAvatarConfig["mouth"] };
}

export function isAvatarPreset(value: string) {
  return AVATAR_PRESETS.some((item) => item.id === value) || parseRandomAvatar(value) !== null;
}

export function avatarForPreset(preset: string | null | undefined) {
  const random = parseRandomAvatar(preset);
  const selected = AVATAR_PRESETS.find((item) => item.id === preset) ?? AVATAR_PRESETS[0];
  return createAvatar(funEmoji, {
    seed: random?.seed ?? selected.seed,
    backgroundColor: [random?.background ?? selected.background],
    eyes: [random?.eyes ?? selected.eyes],
    mouth: [random?.mouth ?? selected.mouth],
    radius: 18,
  }).toDataUri();
}

export const arunAvatar = avatarForPreset("sunrise");
