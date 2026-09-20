import json
import re
from pathlib import Path

from argostranslate import translate

ROOT = Path(__file__).resolve().parents[1]
LOCALES = {"bn": "bn", "ar": "ar", "id": "id", "zh": "zh"}

with (ROOT / "messages" / "en.json").open(encoding="utf-8") as handle:
    source = json.load(handle)["StorefrontSupport"]


def flatten(value, prefix="", entries=None):
    entries = [] if entries is None else entries
    for key, child in value.items():
        current = f"{prefix}.{key}" if prefix else key
        if isinstance(child, str):
            entries.append((current, child))
        else:
            flatten(child, current, entries)
    return entries


def set_path(target, dotted_path, value):
    parts = dotted_path.split(".")
    cursor = target
    for part in parts[:-1]:
        cursor = cursor.setdefault(part, {})
    cursor[parts[-1]] = value


def translate_namespace(translator):
    entries = []
    for key, value in flatten(source):
        placeholders = []

        def protect(match):
            placeholders.append(match.group(0))
            return f"CODEXPLACEHOLDER{len(placeholders) - 1}TOKEN"

        entries.append((key, re.sub(r"\{[a-zA-Z][a-zA-Z0-9_]*\}", protect, value), placeholders))

    result = {}
    separator = "\n🧩🧩🧩\n"
    index = 0
    while index < len(entries):
        batch = []
        size = 0
        while index < len(entries) and len(batch) < 500:
            candidate = entries[index]
            if batch and size + len(candidate[1]) > 20000:
                break
            batch.append(candidate)
            size += len(candidate[1])
            index += 1
        translated = translator.translate(separator.join(item[1] for item in batch))
        lines = [line.strip() for line in translated.splitlines() if line.strip()]
        parts = lines[::2]
        if len(lines) != len(batch) * 2 - 1 or len(parts) != len(batch):
            raise RuntimeError(
                f"Expected {len(batch) * 2 - 1} translated lines, received {len(lines)}"
            )
        for (key, _, placeholders), value in zip(batch, parts):
            for placeholder_index, placeholder in enumerate(placeholders):
                value = value.replace(f"CODEXPLACEHOLDER{placeholder_index}TOKEN", placeholder)
                value = value.replace(f"CODEX PLACEHOLDER {placeholder_index} TOKEN", placeholder)
            set_path(result, key, value)
    return result


for locale, language in LOCALES.items():
    translator = translate.get_translation_from_codes("en", language)
    if translator is None:
        raise RuntimeError(f"No English to {language} translation model is installed")
    translated_namespace = translate_namespace(translator)
    message_file = ROOT / "messages" / f"{locale}.json"
    with message_file.open(encoding="utf-8") as handle:
        messages = json.load(handle)
    messages["StorefrontSupport"] = translated_namespace
    with message_file.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(messages, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"{locale}: translated")
