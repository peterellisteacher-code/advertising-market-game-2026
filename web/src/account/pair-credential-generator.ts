const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const ALL_CHARACTERS = `${UPPERCASE}${LOWERCASE}${DIGITS}`;
const PASSWORD_LENGTH = 20;
const MAX_REJECTION_ATTEMPTS = 1_024;

export type SecureRandomValues = (
  target: Uint8Array<ArrayBuffer>
) => ArrayBufferView<ArrayBuffer>;

const browserRandomValues = (cryptoSource: Crypto): SecureRandomValues | undefined => {
  if (typeof cryptoSource?.getRandomValues !== "function") return undefined;
  return (target) => cryptoSource.getRandomValues(target);
};

const secureIndex = (length: number, randomValues: SecureRandomValues): number => {
  const rejectionLimit = Math.floor(256 / length) * length;
  for (let attempt = 0; attempt < MAX_REJECTION_ATTEMPTS; attempt += 1) {
    const bytes = new Uint8Array(new ArrayBuffer(1));
    randomValues(bytes);
    const sample = bytes[0];
    if (sample !== undefined && sample < rejectionLimit) return sample % length;
  }
  throw new Error("Secure password generation failed");
};

const takeCharacter = (alphabet: string, randomValues: SecureRandomValues): string =>
  alphabet[secureIndex(alphabet.length, randomValues)]!;

export function generateStrongPairPassword(
  randomValues?: SecureRandomValues,
  cryptoSource: Crypto = globalThis.crypto
): string {
  const source = randomValues ?? browserRandomValues(cryptoSource);
  if (source === undefined) throw new Error("Secure password generation is unavailable");

  const characters = [
    takeCharacter(UPPERCASE, source),
    takeCharacter(LOWERCASE, source),
    takeCharacter(DIGITS, source)
  ];
  while (characters.length < PASSWORD_LENGTH) {
    characters.push(takeCharacter(ALL_CHARACTERS, source));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureIndex(index + 1, source);
    [characters[index], characters[swapIndex]] = [characters[swapIndex]!, characters[index]!];
  }
  return characters.join("");
}
