import re
import os
import sys
import argparse
import nltk
import pandas as pd
from nltk.corpus import stopwords, wordnet
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score
import joblib
from fuzzywuzzy import fuzz


# ================= NLTK SETUP =================

nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)
nltk.download('stopwords', quiet=True)
nltk.download('averaged_perceptron_tagger', quiet=True)
nltk.download('averaged_perceptron_tagger_eng', quiet=True)
nltk.download('wordnet', quiet=True)

# ================= STOP WORDS =================

english_stop = set(stopwords.words("english"))
leb_stopwords = {
    "ya", "wallah", "shu", "shou", "enta", "ana", "huwe", "fi", "ma",
    "ya3ne", "tab", "yalla", "lek", "ya3ni"
}
stop_words = english_stop.union(leb_stopwords)

lemmatizer = WordNetLemmatizer()

# ================= SLANG MAP =================

slang_map = {
    # Weed
    "widad": "weed", "weedad": "weed", "widat": "weed",
    "weed": "weed", "hash": "hash", "hashish": "hash",
    "joint": "joint", "j": "joint",

    # Pills
    "hbboub": "pills", "7abba": "pills", "pill": "pills",
    "pills": "pills", "capsule": "pills", "caps": "pills",
    "dose": "pills", "xans": "pills", "xanax": "pills",
    "valium": "pills", "vals": "pills",
    "hboub": "pills", "habbe": "pills", "7abbe": "pills",

    # Cocaine
    "coke": "cocaine", "snow": "cocaine", "white": "cocaine",
    "powder": "cocaine", "poudre": "cocaine",

    # Weapons
    "gun": "weapon", "sle7": "weapon", "msela7": "weapon",
    "piece": "weapon", "knife": "weapon", "sekkin": "weapon",
    "sekinak": "weapon","sekkinak": "weapon",
}

# ================= CLASS NAMES =================

class_names = {
    0: "NORMAL",
    1: "WEED SLANG",
    2: "PILLS SLANG",
    3: "COCAINE SLANG",
    4: "WEAPONS SLANG"
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
    match = fuzzy_match(token, cocaine_words)
    if match and match not in ["bayda", "abyad"]:
        return "cocaine"

    pills_words = ["pill", "pills", "xans", "xanax", "valium"]
    match = fuzzy_match(token, pills_words)
    if match:
        return "pills"

    return slang_map.get(token, token)


def get_wordnet_pos(tag):
    if tag.startswith('J'): return wordnet.ADJ
    elif tag.startswith('V'): return wordnet.VERB
    elif tag.startswith('N'): return wordnet.NOUN
    elif tag.startswith('R'): return wordnet.ADV
    return wordnet.NOUN


def clean_text(text):
    text = str(text).lower()
    text = re.sub(r"[^\w\s]", " ", text)

    tokens = word_tokenize(text)
    tokens = [t for t in tokens if t not in stop_words]
    tokens = [normalize_variants(t) for t in tokens]

    tagged = nltk.pos_tag(tokens)
    lemmatized = [lemmatizer.lemmatize(w, get_wordnet_pos(t)) for w, t in tagged]

    return " ".join(lemmatized)

# ================= TRAINING =================

def train_model(dataset_path: str, model_path: str):
    print("\n" + "=" * 50)
    print("  TRAINING PHASE")
    print("=" * 50)
    print(f"[DATA]  Loading dataset from: {dataset_path}")

    df = pd.read_csv(dataset_path)
    print(f"[DATA]  Loaded {len(df)} records.")
    print(f"[DATA]  Label distribution:\n{df['label'].value_counts().to_string()}\n")

    print("[PREP]  Cleaning and preprocessing text...")
    df["clean"] = df["text"].apply(clean_text)

    X_train, X_test, y_train, y_test = train_test_split(
        df["clean"],
        df["label"],
        test_size=0.2,
        random_state=42,
        stratify=df["label"]
    )
    print(f"[SPLIT] Train: {len(X_train)} | Test: {len(X_test)}\n")

    tfidf = TfidfVectorizer(
        analyzer="word",
        ngram_range=(1, 3),
        sublinear_tf=True,
        min_df=1,
        max_df=0.95
    )

    candidates = {
        "Logistic Regression": Pipeline([
            ("tfidf", tfidf),
            ("clf", LogisticRegression(max_iter=800, solver="lbfgs", multi_class="multinomial"))
        ]),
        "Linear SVC": Pipeline([
            ("tfidf", tfidf),
            ("clf", CalibratedClassifierCV(LinearSVC(max_iter=2000)))
        ]),
        "Random Forest": Pipeline([
            ("tfidf", tfidf),
            ("clf", RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1))
        ]),
    }

    best_model = None
    best_acc = 0.0
    best_name = ""

    print("\n[MODEL] Training and comparing classifiers...")
    for name, pipeline in candidates.items():
        print(f"  → {name}...", end=" ", flush=True)
        pipeline.fit(X_train, y_train)
        acc = accuracy_score(y_test, pipeline.predict(X_test))
        print(f"accuracy={acc:.4f}")
        if acc > best_acc:
            best_acc = acc
            best_model = pipeline
            best_name = name

    print(f"\n[MODEL] Best model: {best_name} (accuracy={best_acc:.4f})\n")
    model = best_model

    print("\n" + "=" * 50)
    print("  EVALUATION")
    print("=" * 50)
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"[EVAL]  Accuracy: {acc:.4f} ({acc * 100:.2f}%)\n")
    print("[EVAL]  Classification Report:")
    print(classification_report(y_test, y_pred))

    print("=" * 50)
    joblib.dump(model, model_path)
    print(f"[SAVE]  Model saved to: {model_path}")
    print("=" * 50 + "\n")

    return model, X_test, y_test

# ================= EVALUATION ONLY =================

def evaluate_model(model_path: str, dataset_path: str):
    print("\n" + "=" * 50)
    print("  EVALUATION ONLY MODE")
    print("=" * 50)

    if not os.path.exists(model_path):
        print(f"[ERROR] Model not found at: {model_path}")
        print("[ERROR] Please train the model first (without --evaluate flag).")
        sys.exit(1)

    print(f"[LOAD]  Loading model from: {model_path}")
    model = joblib.load(model_path)

    print(f"[DATA]  Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    df["clean"] = df["text"].apply(clean_text)

    _, X_test, _, y_test = train_test_split(
        df["clean"],
        df["label"],
        test_size=0.2,
        random_state=42,
        stratify=df["label"]
    )

    print(f"[EVAL]  Running predictions on {len(X_test)} test samples...\n")
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"[EVAL]  Accuracy: {acc:.4f} ({acc * 100:.2f}%)\n")
    print("[EVAL]  Classification Report:")
    print(classification_report(y_test, y_pred))
    print("=" * 50 + "\n")

# ================= CLI ENTRY POINT =================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train or evaluate the Lebanese Slang Detector NLP model."
    )
    parser.add_argument(
        "--dataset",
        default="lebanese_drug_slangv3.csv",
        help="Path to the training CSV dataset (default: lebanese_drug_slangv3.csv)"
    )
    parser.add_argument(
        "--model",
        default="enhanced_multiclass_model.joblib",
        help="Path to save/load the trained model (default: enhanced_multiclass_model.joblib)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force retraining even if a model file already exists"
    )
    parser.add_argument(
        "--evaluate",
        action="store_true",
        help="Load an existing model and run evaluation on the test split (no retraining)"
    )

    args = parser.parse_args()

    if args.evaluate:
        evaluate_model(model_path=args.model, dataset_path=args.dataset)
    elif os.path.exists(args.model) and not args.force:
        print(f"\n[SKIP]  Model already exists at: {args.model}")
        print("[SKIP]  Use --force to retrain or --evaluate to run evaluation.\n")
    else:
        train_model(dataset_path=args.dataset, model_path=args.model)
