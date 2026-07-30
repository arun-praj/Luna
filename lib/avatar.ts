import { createAvatar } from "@dicebear/core";
import { funEmoji } from "@dicebear/collection";

export const arunAvatar = createAvatar(funEmoji, {
  seed: "Arun",
  backgroundColor: ["e2efed"],
  radius: 18,
}).toDataUri();
