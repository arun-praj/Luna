import { createAvatar } from "@dicebear/core";
import { shapes } from "@dicebear/collection";

function createAccountImage(seed: string, backgroundColor: string) {
  return createAvatar(shapes, {
    seed,
    backgroundColor: [backgroundColor],
    radius: 22,
    size: 96,
  }).toDataUri();
}

export const accountImages = {
  primary: createAccountImage("Primary bank vault", "dcece7"),
  esewa: createAccountImage("Digital wallet mobile", "dcebf5"),
  savings: createAccountImage("Savings growth", "e8e2f3"),
  cash: createAccountImage("Everyday cash", "f5e9d2"),
};
