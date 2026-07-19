const ROOM_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ROOM_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/u;
const RANDOM_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const JOIN_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const roomScope = (roomCode: string): number | null => {
  if (!ROOM_CODE_PATTERN.test(roomCode)) return null;
  let scope = 0;
  for (const character of roomCode.replace("-", "")) {
    const index = ROOM_ALPHABET.indexOf(character);
    if (index < 0) return null;
    scope = scope * 32 + index;
  }
  return scope;
};

const uuidBytes = (uuid: string): Uint8Array => {
  const hex = uuid.replaceAll("-", "");
  return Uint8Array.from(
    { length: 16 },
    (_value, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  );
};

const formatUuid = (bytes: Uint8Array): string => {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export function createJoinOperationId(
  roomCode: string,
  randomUUID: () => string
): string {
  const scope = roomScope(roomCode);
  if (scope === null) throw new RangeError("Join operation room code is invalid");
  const entropy = randomUUID();
  if (!RANDOM_UUID_PATTERN.test(entropy)) {
    throw new Error("Secure UUID generation returned invalid entropy");
  }
  const bytes = uuidBytes(entropy);
  bytes[0] = (scope >>> 22) & 0xff;
  bytes[1] = (scope >>> 14) & 0xff;
  bytes[2] = (scope >>> 6) & 0xff;
  bytes[3] = ((scope & 0x3f) << 2) | (bytes[3]! & 0x03);
  bytes[6] = (bytes[6]! & 0x0f) | 0x80;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return formatUuid(bytes);
}

export function isJoinOperationIdForRoom(
  operationId: string,
  roomCode: string
): boolean {
  const expected = roomScope(roomCode);
  if (expected === null || !JOIN_UUID_PATTERN.test(operationId)) return false;
  const bytes = uuidBytes(operationId);
  const actual = bytes[0]! * 2 ** 22 + bytes[1]! * 2 ** 14 +
    bytes[2]! * 2 ** 6 + (bytes[3]! >>> 2);
  return actual === expected;
}
