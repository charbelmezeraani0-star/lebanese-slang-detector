"""
Unit tests for phrase_rules, clean_text, fuzzy_match, and Arabic detection.
Run with: pytest tests/
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest


# ===== phrase_rules tests =====

def test_weapon_klachenkov():
    from api import phrase_rules
    assert phrase_rules("ma3ak klachenkov?") == "WEAPONS SLANG"

def test_weapon_klashen():
    from api import phrase_rules
    assert phrase_rules("fi klashen 3andak?") == "WEAPONS SLANG"

def test_weapon_klash():
    from api import phrase_rules
    assert phrase_rules("jeeb klash") == "WEAPONS SLANG"

def test_weapon_gun():
    from api import phrase_rules
    assert phrase_rules("ma3ak gun?") == "WEAPONS SLANG"

def test_weapon_sekkin():
    from api import phrase_rules
    assert phrase_rules("fi sekkin 3andak") == "WEAPONS SLANG"

def test_weapon_ak47():
    from api import phrase_rules
    assert phrase_rules("jeeb ak47") == "WEAPONS SLANG"

def test_weapon_safe_kitchen_knife():
    from api import phrase_rules
    assert phrase_rules("sekkin matbakh") == "NORMAL"

def test_weed_hachich():
    from api import phrase_rules
    assert phrase_rules("bade hachich la sahra") == "WEED SLANG"

def test_weed_hach():
    from api import phrase_rules
    assert phrase_rules("ma3ak hach?") == "WEED SLANG"

def test_weed_7achich():
    from api import phrase_rules
    assert phrase_rules("fi 7achich 3andak?") == "WEED SLANG"

def test_weed_cha7ich():
    from api import phrase_rules
    assert phrase_rules("bade cha7ich") == "WEED SLANG"

def test_cocaine_el_abyad():
    from api import phrase_rules
    assert phrase_rules("bade el abyad") == "COCAINE SLANG"

def test_cocaine_el_bayda():
    from api import phrase_rules
    assert phrase_rules("ma3ak el bayda?") == "COCAINE SLANG"

def test_normal_empty():
    from api import phrase_rules
    assert phrase_rules("keef el jaw lyoum") is None

def test_normal_greeting():
    from api import phrase_rules
    result = phrase_rules("ahla w sahla")
    assert result is None or result == "NORMAL"


# ===== clean_text tests =====

def test_clean_text_lowercases():
    from api import clean_text
    result = clean_text("HELLO WORLD")
    assert result == result.lower()

def test_clean_text_removes_punctuation():
    from api import clean_text
    result = clean_text("hello, world!")
    assert "," not in result
    assert "!" not in result


# ===== fuzzy_match tests =====

def test_fuzzy_match_xanax_typo():
    from api import fuzzy_match
    result = fuzzy_match("xannax", ["xanax", "valium"], threshold=80)
    assert result == "xanax"

def test_fuzzy_match_no_match():
    from api import fuzzy_match
    result = fuzzy_match("hello", ["xanax", "valium"], threshold=85)
    assert result is None


# ===== Arabic support tests =====

def test_arabic_weed():
    from arabic_support import detect_arabic_slang
    assert detect_arabic_slang("عندك حشيش؟") == "WEED SLANG"

def test_arabic_weapon():
    from arabic_support import detect_arabic_slang
    assert detect_arabic_slang("عندك سلاح؟") == "WEAPONS SLANG"

def test_arabic_cocaine():
    from arabic_support import detect_arabic_slang
    assert detect_arabic_slang("بدي كوكايين") == "COCAINE SLANG"

def test_arabic_pills():
    from arabic_support import detect_arabic_slang
    assert detect_arabic_slang("بدي حبوب") == "PILLS SLANG"

def test_arabic_normal():
    from arabic_support import detect_arabic_slang
    assert detect_arabic_slang("كيفك اليوم") is None
