type MessageTranslator<Key extends string> = {
  (key: Key): string;
  has(key: Key): boolean;
};

/** API-provided enum values may be newer than the current message catalog. */
export function hasDynamicMessage<Key extends string>(
  translate: MessageTranslator<Key>, key: string,
): boolean {
  return translate.has(key as Key);
}

export function translateDynamic<Key extends string>(
  translate: MessageTranslator<Key>, key: string, fallback = key.split(".").pop() ?? key,
): string {
  return hasDynamicMessage(translate, key) ? translate(key as Key) : fallback;
}
