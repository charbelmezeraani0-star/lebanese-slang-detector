from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import joblib
import re
import nltk
from nltk.corpus import stopwords, wordnet
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize
from fuzzywuzzy import fuzz
import logging
from arabic_support import detect_arabic_slang

logger = logging.getLogger("uvicorn.error")

# ================= PYDANTIC MODELS =================

class AnalyzeRequest(BaseModel):
    text: str = Field(..., description="The text to analyze for slang content")

class AnalyzeBatchRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts to analyze (max 50)")

class AnalyzeResponse(BaseModel):
    original: Optional[str] = None
    cleaned: Optional[str] = None
    label: str
    confidence: float
    source: Optional[str] = None

# ================= LIFESPAN (STARTUP) =================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Download NLTK resources at startup
    logger.info("Downloading NLTK resources...")
    nltk.download("punkt", quiet=True)
    nltk.download("punkt_tab", quiet=True)
    nltk.download("stopwords", quiet=True)
    nltk.download("averaged_perceptron_tagger", quiet=True)
    nltk.download("averaged_perceptron_tagger_eng", quiet=True)
    nltk.download("wordnet", quiet=True)
    logger.info("NLTK resources ready.")
    yield

# ================= APP INIT =================

app = FastAPI(
    title="Lebanese Slang Detector API",
    description=(
        "An NLP-powered API for detecting drug and weapons-related slang "
        "in Lebanese Arabic (Arabizi) chat messages. Uses a hybrid approach "
        "combining a TF-IDF + Logistic Regression ML model with a rule-based engine."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= MODEL LOADING =================

MODEL_PATH = "enhanced_multiclass_model.joblib"

# ================= STATS COUNTER =================

_stats: dict = {"total_analyzed": 0, "by_label": {}}

try:
    model = joblib.load(MODEL_PATH)
    logger.info(f"Model loaded successfully from {MODEL_PATH}")
    MODEL_LOADED = True
except Exception as e:
    logger.error(
        f"CRITICAL: Failed to load model from '{MODEL_PATH}'. "
        f"Please run train_model.py to generate the model file. Error: {e}"
    )
    model = None
    MODEL_LOADED = False

# ================= NLP SETUP =================

english_stop = set(stopwords.words("english"))
leb_stopwords = {
    "ya","wallah","shu","shou","enta","ana","huwe","fi","ma",
    "ya3ne","tab","yalla","lek","ya3ni","w","eh","ahu","akid",
    "fiya","elha","hala2","hayda","hayde","haydi","hot"
}
stop_words = english_stop.union(leb_stopwords)
lemmatizer = WordNetLemmatizer()

class_names = {
    0: "NORMAL",
    1: "WEED SLANG",
    2: "PILLS SLANG",
    3: "COCAINE SLANG",
    4: "WEAPONS SLANG"
}

_stats["by_label"] = {name: 0 for name in class_names.values()}

# ================= RULE ENGINE =================

def phrase_rules(text: str):
    t = text.lower().strip()
    clean_t = re.sub(r"\s+", " ", t)
    tokens = clean_t.split()

    weapon_words = [
        "sekkin", "sekin", "sekkinak", "sekinak",
        "knife","sekkineh",
        "gun", "pistol", "beretta", "glock", "rifle",
        "m16", "ak47", "ak-47", "kalash", "kalashnikov",
        "klachenkov", "klashen", "klash", "klashnkov",
        "sniper", "revolver", "magnum",
        "sle7ak", "sle7", "slehak", "sleh", "baroud", "baroude", "baroudi",
        "bomb", "grenade", "tnt", "c4", "explosive", "eneble"
    ]

    if "sekkin matbakh" in clean_t or "sekin matbakh" in clean_t:
        return "NORMAL"

    if any(w in clean_t for w in weapon_words):
        return "WEAPONS SLANG"

    if re.match(r"^j['\s][a-z]", clean_t):
        return "NORMAL"

    if clean_t == "j":
        return "NORMAL"

    weed_words = ["hachich", "hach", "hashich", "7achich", "cha7ich", "widad", "weedad", "widat"]
    if any(w in clean_t for w in weed_words):
        return "WEED SLANG"

    if "j" in tokens:
        weed_ctx = ["oerout", "wra2", "wara2", "dakhin", "smoke", "baf", "baff", "joint", "weed"]
        if "chi" in tokens or any(ctx in tokens for ctx in weed_ctx):
            return "WEED SLANG"
        for i in range(len(tokens) - 1):
            if tokens[i] == "bade" and tokens[i + 1] == "j":
                return "WEED SLANG"

    if tokens and tokens[0] == "bade" and len(tokens) <= 2:
        suspicious_terms = ["j", "otaata", "abyad", "bayda",
                            "coke", "weed", "hash", "poudre",
                            "snow", "xanax", "xans", "pill", "pills"]
        if all(tok not in suspicious_terms for tok in tokens[1:]):
            return "NORMAL"

    safe_objects = [
        "jeep", "siara", "seyara", "car", "motor", "moteur",
        "kamis", "shirt", "amis", "tshirt", "t-shirt", "hoodie",
        "kanze", "chal7a", "jacket", "pants", "skirt", "dress",
        "shanta", "bag", "purse", "handbag",
        "ghata", "manta", "sofa", "ferse", "tanjara", "banet"
    ]

    for obj in safe_objects:
        if obj in clean_t and ("bayda" in clean_t or "abyad" in clean_t):
            return "NORMAL"

    text_words = clean_t.split()  # noqa: F841

    if "el abyad" in clean_t or "el bayda" in clean_t:
        return "COCAINE SLANG"

    if "abyad" in clean_t:
        return "COCAINE SLANG"

    cocaine_context = [
        "otaata", "packet", "poudra", "powder",
        "l2met", "bag", "kabsna", "kamacho"
    ]

    if "bayda" in clean_t:
        if any(c in clean_t for c in cocaine_context):
            return "COCAINE SLANG"
        pass

    arrest_terms = [
        "kamacho", "kamachou", "kamachoune",
        "kamchou", "kamchoune",
        "masakou", "msaknou", "msaknoune",
        "kebsne", "kabasna", "kebsouni", "kabsouni"
    ]

    if any(a in clean_t for a in arrest_terms) and ("abyad" in clean_t or "el abyad" in clean_t):
        return "COCAINE SLANG"

    cocaine_packet_terms = [
        "otaata bayda", "otet bayda",
        "packet bayda", "bag bayda",
        "l2met bayda", "poudra bayda"
    ]

    if any(term in clean_t for term in cocaine_packet_terms):
        return "COCAINE SLANG"

    request_verbs = [
        "bade", "baddi", "bedde",
        "jebet", "jib", "jeeb", "jible",
        "ma3ak", "3andak",
        "dabbir", "ndabbir"
    ]

    if "abyad" in clean_t or "el abyad" in clean_t or "el bayda" in clean_t:
        if any(v in clean_t for v in request_verbs):
            return "COCAINE SLANG"

    if "bayda" in clean_t and any(v in clean_t for v in request_verbs):
        if any(c in clean_t for c in cocaine_context):
            return "COCAINE SLANG"
        return "NORMAL"

    pills_keywords = ["xans", "xan", "xanax", "hboub", "habbe", "7abbe", "pills", "pill"]
    pills_request_verbs = [
        "jebet", "jib", "jeeb", "jible", "3andak", "ma3ak",
        "bade", "baddi", "bedde",
        "btejeeb", "btjeeb", "dabbir", "ndabbir", "dabbirlé","dabberle"
    ]

    if any(pk in clean_t for pk in pills_keywords) and any(rv in clean_t for rv in pills_request_verbs):
        return "PILLS SLANG"

    if "abyad" in clean_t or "bayda" in clean_t:
        return "NORMAL"

    return None


# ================= SLANG MAP =================

slang_map = {
    "widad": "weed", "weedad": "weed", "widat": "weed",
    "weed": "weed", "hash": "hash", "hashish": "hash",
    "joint": "joint", "7achich": "hash", "j": "joint",
    "hbboub": "pills", "7abba": "pills", "pill": "pills",
    "pills": "pills", "capsule": "pills", "caps": "pills",
    "dose": "pills", "xans": "pills", "xanax": "pills",
    "valium": "pills", "vals": "pills",
    "hboub": "pills", "habbe": "pills", "7abbe": "pills",
    "coke": "cocaine", "snow": "cocaine", "white": "cocaine",
    "powder": "cocaine", "poudre": "cocaine",
    "hachich": "hash", "hach": "hash", "hashich": "hash", "cha7ich": "hash",
    "gun": "weapon", "sle7": "weapon", "msala7": "weapon","msalla7": "weapon",
    "knife": "weapon", "sekkin": "weapon",
    "sekin": "weapon", "sekinak": "weapon", "sekkinak": "weapon", "baroud": "weapon",
    "baroude": "weapon", "m16": "weapon", "ak47": "weapon",
    "ak-47": "weapon", "kalash": "weapon", "kalashnikov": "weapon",
    "klachenkov": "weapon", "klashen": "weapon", "klash": "weapon", "klashnkov": "weapon",
    "pistol": "weapon", "glock": "weapon", "beretta": "weapon",
    "revolver": "weapon", "magnum": "weapon",
    "bomb": "weapon", "grenade": "weapon", "tnt": "weapon", "c4": "weapon"
}

# ================= NLP HELPERS =================

def fuzzy_match(token: str, options: list, threshold=85):
    for opt in options:
        if fuzz.ratio(token, opt) >= threshold:
            return opt
    return None

def normalize_variants(token):
    if re.match(r"sle7\w*", token):
        return "weapon"
    cocaine_words = ["bayda", "abyad", "coke", "white"]
    match = fuzzy_match(token, cocaine_words, 80)
    if match:
        if match in ["bayda", "abyad"]:
            return token
        return "cocaine"
    pills_words = ["xans", "xanax", "valium", "pill", "caps"]
    match = fuzzy_match(token, pills_words, 80)
    if match:
        return "pills"
    return slang_map.get(token, token)


def get_wordnet_pos(tag):
    if tag.startswith('J'): return wordnet.ADJ
    if tag.startswith('V'): return wordnet.VERB
    if tag.startswith('N'): return wordnet.NOUN
    if tag.startswith('R'): return wordnet.ADV
    return wordnet.NOUN

def clean_text(text):
    logger.info("\n================ CLEANING PIPELINE ================")
    logger.info(f"RAW INPUT: {text}")
    lowered = str(text).lower()
    cleaned_punc = re.sub(r"[^\w\s]", " ", lowered)
    logger.info(f"LOWERCASE & NO PUNCT: {cleaned_punc}")
    tokens = word_tokenize(cleaned_punc)
    logger.info(f"TOKENS: {tokens}")
    tokens_no_stop = [t for t in tokens if t not in stop_words]
    logger.info(f"AFTER STOPWORD REMOVAL: {tokens_no_stop}")
    normalized = [normalize_variants(t) for t in tokens_no_stop]
    logger.info(f"AFTER SLANG NORMALIZATION: {normalized}")
    tagged = nltk.pos_tag(normalized)
    logger.info(f"POS TAGS: {tagged}")
    lemmatized = [lemmatizer.lemmatize(w, get_wordnet_pos(t)) for w, t in tagged]
    logger.info(f"LEMMATIZED TOKENS: {lemmatized}")
    final_cleaned = " ".join(lemmatized)
    logger.info(f"FINAL CLEANED TEXT: {final_cleaned}")
    logger.info("====================================================\n")
    return final_cleaned

# ================= CORE ANALYSIS LOGIC =================

def _run_analysis(text: str) -> AnalyzeResponse:
    """Run the full analysis pipeline on a single text and return an AnalyzeResponse."""
    if not text.strip():
        return AnalyzeResponse(label="NORMAL", confidence=0.0)

    if not MODEL_LOADED or model is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Model is not loaded. Please train the model first by running train_model.py."
            )
        )

    # Arabic script detection
    arabic_label = detect_arabic_slang(text)
    if arabic_label:
        _stats["total_analyzed"] += 1
        _stats["by_label"][arabic_label] = _stats["by_label"].get(arabic_label, 0) + 1
        return AnalyzeResponse(
            original=text, cleaned=text,
            label=arabic_label, confidence=1.0, source="ARABIC_RULE"
        )

    cleaned = clean_text(text)
    probs = model.predict_proba([cleaned])[0]
    model_idx = probs.argmax()
    model_label = class_names[model_idx]
    model_conf = float(probs[model_idx])
    rule_label_raw = phrase_rules(text)
    rule_label_cleaned = phrase_rules(cleaned)
    rule_label = rule_label_raw or rule_label_cleaned

    THRESHOLD = 0.60

    def _track(label: str, conf: float, source: str) -> AnalyzeResponse:
        _stats["total_analyzed"] += 1
        _stats["by_label"][label] = _stats["by_label"].get(label, 0) + 1
        return AnalyzeResponse(original=text, cleaned=cleaned, label=label, confidence=conf, source=source)

    if rule_label == "WEAPONS SLANG":
        return _track("WEAPONS SLANG", 1.0, "RULE_STRONG")
    if rule_label and rule_label != "NORMAL":
        return _track(rule_label, 1.0, "RULE_OVERRIDE")
    if model_label != "NORMAL" and model_conf < THRESHOLD:
        return _track("NORMAL", model_conf, "MODEL_BELOW_THRESHOLD")
    if model_label != "NORMAL" and model_conf >= THRESHOLD:
        return _track(model_label, model_conf, "MODEL_STRONG")
    return _track("NORMAL", model_conf, "CLEAN")

# ================= ENDPOINTS =================

@app.get("/stats", summary="Usage statistics", tags=["Utility"])
def get_stats():
    """Returns total messages analyzed and breakdown by label since server start."""
    return {
        "total_analyzed": _stats["total_analyzed"],
        "by_label": _stats["by_label"],
        "model_loaded": MODEL_LOADED
    }


@app.get("/health", summary="Health check", tags=["Utility"])
def health_check():
    """Returns the API health status and whether the model is loaded."""
    return {"status": "ok", "model": "loaded" if MODEL_LOADED else "not loaded"}


@app.get("/classes", summary="List detection classes", tags=["Utility"])
def get_classes():
    """Returns the list of all possible classification labels."""
    return {"classes": list(class_names.values())}


@app.post("/analyze", response_model=AnalyzeResponse, summary="Analyze a single text", tags=["Analysis"])
def analyze_text(data: AnalyzeRequest):
    """
    Analyze a single text message for Lebanese drug and weapons slang.
    Returns the label, confidence score, and processing details.
    """
    return _run_analysis(data.text)


@app.post(
    "/analyze/batch",
    response_model=List[AnalyzeResponse],
    summary="Analyze multiple texts",
    tags=["Analysis"]
)
def analyze_batch(data: AnalyzeBatchRequest):
    """
    Analyze a batch of text messages (maximum 50 at a time).
    Returns a list of results in the same order as the input texts.
    """
    if not data.texts:
        raise HTTPException(status_code=400, detail="The 'texts' list must not be empty.")
    if len(data.texts) > 50:
        raise HTTPException(
            status_code=400,
            detail=f"Batch size exceeds maximum allowed (50). Got {len(data.texts)} texts."
        )
    return [_run_analysis(text) for text in data.texts]
