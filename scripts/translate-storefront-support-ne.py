import json
import re
from pathlib import Path

from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
MODEL = "Helsinki-NLP/opus-mt-en-mul"

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


tokenizer = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL)
entries = []
for key, value in flatten(source):
    placeholders = []

    def protect(match):
        placeholders.append(match.group(0))
        return f"ZXPH{len(placeholders) - 1}ZX"

    entries.append((key, re.sub(r"\{[a-zA-Z][a-zA-Z0-9_]*\}", protect, value), placeholders))

result = {}
for start in range(0, len(entries), 16):
    batch = entries[start : start + 16]
    inputs = tokenizer(
        [f">>npi<< {item[1]}" for item in batch],
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=256,
    )
    generated = model.generate(**inputs, max_new_tokens=256)
    translations = tokenizer.batch_decode(generated, skip_special_tokens=True)
    for (key, _, placeholders), value in zip(batch, translations):
        for index, placeholder in enumerate(placeholders):
            value = re.sub(
                rf"ZX\s*PH\s*{index}\s*ZX",
                lambda _: placeholder,
                value,
                flags=re.IGNORECASE,
            )
        set_path(result, key, value)

message_file = ROOT / "messages" / "ne.json"
with message_file.open(encoding="utf-8") as handle:
    messages = json.load(handle)
messages["StorefrontSupport"] = result
with message_file.open("w", encoding="utf-8", newline="\n") as handle:
    json.dump(messages, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
print(f"ne: {len(entries)} messages translated")
