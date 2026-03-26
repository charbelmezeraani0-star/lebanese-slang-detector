"""
Arabic script detection and normalization for Lebanese slang.
Detects drug and weapons-related terms written in Arabic script.
"""
import re

# Arabic-script slang mapped to internal category
ARABIC_KEYWORDS = {
    # Weed
    "حشيش": "WEED SLANG",
    "حشيشة": "WEED SLANG",
    "حشش": "WEED SLANG",
    "زبالة": "WEED SLANG",
    "عشبة": "WEED SLANG",
    "جوينت": "WEED SLANG",
    "بلنت": "WEED SLANG",
    "تدخين": "WEED SLANG",
    "ماريجوانا": "WEED SLANG",
    "قنب": "WEED SLANG",
    # Pills
    "حبوب": "PILLS SLANG",
    "حبة": "PILLS SLANG",
    "كبسول": "PILLS SLANG",
    "زاناكس": "PILLS SLANG",
    "فاليوم": "PILLS SLANG",
    "مهدئات": "PILLS SLANG",
    "منومات": "PILLS SLANG",
    # Cocaine
    "كوكايين": "COCAINE SLANG",
    "كوك": "COCAINE SLANG",
    "بودرة": "COCAINE SLANG",
    "البيضاء": "COCAINE SLANG",
    "الأبيض": "COCAINE SLANG",
    "مسحوق": "COCAINE SLANG",
    # Weapons
    "سلاح": "WEAPONS SLANG",
    "مسدس": "WEAPONS SLANG",
    "بندقية": "WEAPONS SLANG",
    "سكين": "WEAPONS SLANG",
    "قنبلة": "WEAPONS SLANG",
    "رشاش": "WEAPONS SLANG",
    "كلاشنكوف": "WEAPONS SLANG",
    "طبنجة": "WEAPONS SLANG",
    "مسلح": "WEAPONS SLANG",
    "رصاص": "WEAPONS SLANG",
    "ذخيرة": "WEAPONS SLANG",
}


def normalize_arabic(text: str) -> str:
    """Normalize Arabic text: alef variants, tashkeel, teh marbuta."""
    text = re.sub(r'[إأآا]', 'ا', text)
    text = re.sub(r'[\u064B-\u065F]', '', text)   # remove tashkeel
    text = text.replace('ة', 'ه')
    return text


def detect_arabic_slang(text: str):
    """
    Check if text contains Arabic-script drug/weapon keywords.
    Returns the category label string or None if nothing detected.
    """
    normalized = normalize_arabic(text)
    for arabic_word, label in ARABIC_KEYWORDS.items():
        normalized_kw = normalize_arabic(arabic_word)
        if normalized_kw in normalized:
            return label
    return None
