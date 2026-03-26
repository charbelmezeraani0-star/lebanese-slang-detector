# Lebanese Slang Detector

### NLP-Powered Real-Time Chat Moderation for Lebanese Arabic

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111%2B-009688?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18%2B-61DAFB?style=flat-square&logo=react)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%7C%20Storage-FFCA28?style=flat-square&logo=firebase)
![scikit-learn](https://img.shields.io/badge/scikit--learn-ML%20Pipeline-F7931E?style=flat-square&logo=scikit-learn)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension%20Manifest%20v3-4285F4?style=flat-square&logo=google-chrome)

---

## Overview

The **Lebanese Slang Detector** is a full-stack NLP system that detects drug and weapons-related slang in Lebanese Arabic chat messages in real time. It combines a machine learning classifier, a hand-crafted rule engine, and fuzzy matching to handle the unique challenges of Lebanese Arabizi — Latin-script Lebanese Arabic that mixes Arabic, French, and English words, often substituting numbers for Arabic phonemes.

The project consists of four components:

| Component | Description |
|---|---|
| **Backend API** | FastAPI + scikit-learn NLP classification engine |
| **React Chat App** | WhatsApp-style real-time group chat with Firebase |
| **Admin Dashboard** | Live moderation panel with stats and CSV export |
| **Browser Extension** | Chrome/Edge extension to scan any webpage |

---

## Features

### Chat Application
- Real-time group chat rooms powered by Firebase Firestore
- Every message is analyzed by the NLP API before being stored
- Flagged messages are highlighted with the detected category and confidence score
- If the backend is offline, messages are still sent and marked **(unverified)**

### NLP & Detection
- 5-class classification: NORMAL, WEED SLANG, PILLS SLANG, COCAINE SLANG, WEAPONS SLANG
- Hybrid pipeline: rule engine for known patterns + ML model for ambiguous text
- Fuzzy matching to handle typos and intentional misspellings
- Arabic script support — detects slang written in Arabic letters (حشيش, سلاح, etc.)
- Multi-model training: compares Logistic Regression, LinearSVC, and Random Forest; picks best by accuracy

### UI & UX
- Dark mode / light mode toggle (persists across sessions)
- Typing indicators (real-time, Firestore-backed, expire after 5 seconds)
- Online user count (heartbeat every 30s, expires after 60s)
- Message reactions (long-press or right-click an emoji from a picker, stored in Firestore)
- Read receipts (powered by Intersection Observer API)
- Image sharing with Firebase Storage upload and live progress bar
- Notification sound when a new message arrives (Web Audio API)
- Message search / filter within a room
- Auto-scroll to latest message
- Avatar colors generated from username
- Room list with unread message count badges and last-seen timestamps

### Admin Dashboard
- Live feed of the last 200 messages from all rooms
- Stats cards: total messages, flagged count, flag rate percentage
- Category breakdown with animated progress bars
- Export all flagged messages to CSV

### Browser Extension
- Analyze any text directly from the extension popup
- Scan the current webpage and highlight suspicious text inline
- Color-coded highlights per category (green = weed, orange = pills, purple = cocaine, red = weapons)

### Developer Experience
- Docker + docker-compose for one-command deployment
- AraBERT fine-tuning script (HuggingFace transformers) for deep Arabic NLP
- pytest test suite for rule engine, preprocessing, and API endpoints
- `/health`, `/classes`, `/stats` endpoints for monitoring

---

## How It Works

Each message sent in the chat is analyzed and assigned one of five categories:

| Label | Color | Meaning |
|---|---|---|
| **NORMAL** | Green | No suspicious content |
| **WEED SLANG** | Light green | Cannabis, hash, joints, related terms |
| **PILLS SLANG** | Orange | Xanax, Valium, pills, capsules |
| **COCAINE SLANG** | Purple | Cocaine and Lebanese code words |
| **WEAPONS SLANG** | Red | Guns, knives, Kalashnikov, explosives |

Flagged messages appear with a colored border, category badge, and confidence percentage in both the chat and the admin dashboard.

---

## Architecture

```
User sends message
       │
       ▼
React Frontend (Chat.js)
       │
       ├── POST /analyze ──► FastAPI Backend
       │                          │
       │                     Rule Engine
       │                          │
       │                     NLP Pipeline (TF-IDF + Best ML Model)
       │                          │
       │                     Arabic Script Detection
       │                          │
       │◄──────────────── label + confidence
       │
       ├── If flagged: show colored badge in UI
       │
       └── Write message to Firebase Firestore
                  │
                  └── All connected clients update in real time (onSnapshot)
```

### Backend — `SlangDetectorLB-Backend-master/`

| File | Purpose |
|---|---|
| `api.py` | FastAPI app, all endpoints, rule engine, hybrid classifier |
| `train_model.py` | Multi-model training with argparse CLI |
| `arabic_support.py` | Arabic script keyword detection (no GPU required) |
| `train_arabert.py` | AraBERT fine-tuning script (HuggingFace transformers) |
| `lebanese_drug_slangv3.csv` | Labeled training dataset (1000+ rows) |
| `tests/test_rules.py` | pytest unit tests |
| `Dockerfile` | Container build for the backend |
| `.env.example` | Environment variable template |

### Frontend — `SlangDetectorLB-Frontend-master/`

| File | Purpose |
|---|---|
| `src/App.js` | React Router setup, ThemeProvider wrapper |
| `src/firebase.js` | Firebase initialization (Firestore + Storage) |
| `src/ThemeContext.js` | Global dark/light mode context with localStorage |
| `src/RoomSelector.js` | Room list with badges and create-room flow |
| `src/Chat.js` | Main chat component with all real-time features |
| `src/AdminDashboard.js` | Moderation dashboard with stats and CSV export |
| `Dockerfile` | Container build for the frontend |
| `.env.example` | Firebase config template |

### Browser Extension — `SlangDetectorLB-Extension/`

| File | Purpose |
|---|---|
| `manifest.json` | Manifest v3, permissions: activeTab, scripting, storage |
| `popup.html` | Extension popup UI |
| `popup.js` | Text analysis and page scan logic |
| `content.js` | Content script — highlights flagged text on any webpage |
| `background.js` | Service worker |

---

## NLP Pipeline

Each message passes through the following steps before classification:

1. **Lowercasing** — normalize text to lowercase
2. **Punctuation removal** — strip non-alphanumeric characters
3. **Tokenization** — split into word tokens (`nltk.word_tokenize`)
4. **Stop word removal** — remove English stopwords plus Lebanese fillers: `wallah`, `yalla`, `shu`, `enta`, `halla2`, `bas`, `la2`, `haida`, etc.
5. **Slang normalization** — map known variants to canonical forms using an exact lookup table and fuzzy matching (e.g., `widad` → `weed`, `sle7ak` → `weapon`, `hachich` → `weed`, `klachenkov` → `kalashnikov`)
6. **POS tagging** — tag each token as noun, verb, adjective, or adverb
7. **Lemmatization** — reduce tokens to their base form using WordNet
8. **TF-IDF Vectorization** — unigrams, bigrams, trigrams (max 10,000 features)
9. **Classification** — best model from: Logistic Regression, LinearSVC (calibrated), or Random Forest

### Rule Engine

Before the ML model runs, a rule engine checks the cleaned text against a list of high-confidence phrase patterns:

- **Exact match rules** for known slang: `j`, `joint`, `6abe`, `7abbe`, `hachich`, `klash`, `sle7`
- **Context-aware rules** that require additional signals (e.g., `sekkin matbakh` — kitchen knife — is NORMAL; `sekkin` alone is WEAPONS SLANG)
- **Fuzzy matching** (fuzzywuzzy, threshold 85) to catch intentional typos like `h4chich` or `kl4shen`
- If any rule fires with confidence ≥ 0.90, the rule result overrides the ML model

### Multi-Model Training

`train_model.py` trains three models and picks the best by cross-validation accuracy:

| Model | Notes |
|---|---|
| Logistic Regression | Fast, interpretable baseline |
| LinearSVC | High accuracy on text classification; wrapped in CalibratedClassifierCV for probability output |
| Random Forest | Ensemble method for robustness |

The winning model is saved to `slang_model.joblib` and loaded by the API at startup.

---

## Lebanese Arabic Support

This system is purpose-built for **Arabizi** — Lebanese Arabic written in the Latin alphabet, using numbers as phonetic substitutes for Arabic letters:

| Number | Arabic Sound | Example |
|---|---|---|
| `7` | ح (h with dot) | `7abbe` = pill |
| `3` | ع (ayn) | `3andak` = do you have |
| `2` | ء (hamza) | `wra2` = behind |
| `8` | غ (ghayn) | `8alat` = wrong |

**Arabic script detection** (`arabic_support.py`) also handles messages written entirely in Arabic letters, mapping keywords like حشيش (hashish), كوكايين (cocaine), سلاح (weapon), مسدس (pistol) to the correct categories — no GPU or transformer model required.

**AraBERT fine-tuning** (`train_arabert.py`) is available for deeper Arabic NLP using `aubmindlab/bert-base-arabertv02`. This requires a GPU and the `transformers`, `torch`, and `accelerate` packages.

---

## Getting Started

### Prerequisites

- Python 3.10+ with pip
- Node.js 18+ and npm
- A Firebase project with Firestore and Storage enabled

---

### 1 — Backend Setup

```bash
cd SlangDetectorLB-Backend-master

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate          # Linux/macOS
# venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Train the model (required before first run)
python3 train_model.py

# Start the API server
uvicorn api:app --reload
```

The API will be available at `http://127.0.0.1:8000`.
Interactive docs (Swagger UI) are at `http://127.0.0.1:8000/docs`.

**Training options:**

```bash
# Force retrain even if a model file already exists
python3 train_model.py --force

# Use a custom dataset
python3 train_model.py --dataset my_data.csv

# Evaluate existing model without retraining
python3 train_model.py --evaluate
```

---

### 2 — Frontend Setup

```bash
cd SlangDetectorLB-Frontend-master

# Install dependencies
npm install

# Start the development server
npm start
```

The app opens at `http://localhost:3000`.

**Firebase configuration:**

1. Go to [Firebase Console](https://console.firebase.google.com) → your project → Project Settings → General
2. Copy your Firebase config object
3. Paste the values into `src/firebase.js` (or use `.env` with `.env.example` as a template)
4. Enable Firestore and Storage in the Firebase console
5. Set Firestore rules to allow read/write (for development):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

---

### 3 — Browser Extension Setup

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `SlangDetectorLB-Extension/` folder
5. The extension icon appears in your toolbar
6. Make sure the backend API is running at `http://127.0.0.1:8000`

---

### 4 — Docker (All-in-One)

```bash
# From the project root
docker-compose up --build
```

This starts the backend on port `8000` and the frontend on port `3000` with a single command.

---

### 5 — Run Tests

```bash
cd SlangDetectorLB-Backend-master
source venv/bin/activate
pytest tests/ -v
```

---

### 6 — AraBERT Fine-Tuning (Optional, GPU Required)

```bash
pip install transformers torch accelerate
python3 train_arabert.py
```

This fine-tunes `aubmindlab/bert-base-arabertv02` on the included Arabic training data and saves the model locally. Once trained, it can be integrated into the API for deeper Arabic text understanding.

---

## API Reference

### `POST /analyze`

Analyze a single text message.

**Request:**
```json
{ "text": "bade j" }
```

**Response:**
```json
{
  "original": "bade j",
  "cleaned": "joint",
  "label": "WEED SLANG",
  "confidence": 1.0,
  "source": "RULE_OVERRIDE"
}
```

The `source` field can be:
- `RULE_OVERRIDE` — matched by the rule engine
- `FUZZY_MATCH` — matched via fuzzy string similarity
- `ML_MODEL` — classified by the trained ML model
- `ARABIC_DETECTION` — matched by Arabic script keyword detection

---

### `POST /analyze/batch`

Analyze up to 50 messages in one request (used by the browser extension).

**Request:**
```json
{ "texts": ["bade j", "kifak", "3andak sle7"] }
```

**Response:** Array of result objects in the same order as the input.

---

### `GET /health`

Check if the API and model are running.

**Response:**
```json
{ "status": "ok", "model": "loaded" }
```

---

### `GET /classes`

List all classification labels.

**Response:**
```json
{ "classes": ["NORMAL", "WEED SLANG", "PILLS SLANG", "COCAINE SLANG", "WEAPONS SLANG"] }
```

---

### `GET /stats`

Return usage statistics since the server started.

**Response:**
```json
{
  "total_analyzed": 142,
  "by_label": {
    "NORMAL": 115,
    "WEED SLANG": 12,
    "PILLS SLANG": 6,
    "COCAINE SLANG": 4,
    "WEAPONS SLANG": 5
  }
}
```

---

## Dataset

The training dataset (`lebanese_drug_slangv3.csv`) contains over 1,000 labeled examples covering all five categories. It includes:

- Lebanese Arabizi spellings (Latin script with number substitutions)
- Arabic script variants
- French-influenced Lebanese terms (`poudra`, `joint`, `capsule`, `gramme`)
- Common misspellings and intentional obfuscation
- Newly added terms: `hachich`, `hach`, `7achich`, `cha7ich`, `klachenkov`, `klashen`, `klash`, `xanax`, `valium`, `keta`, `mdma`, `m16`, `rpg`, `dynamit`
- Negative examples (normal messages) to reduce false positives

To add new training data, append rows to the CSV in the format:

```
text,label
bade hachich,WEED SLANG
3andak klashen,WEAPONS SLANG
```

Then retrain:

```bash
python3 train_model.py --force
```

---

## Project Structure

```
nlp prokect/
├── README.md
├── docker-compose.yml
│
├── SlangDetectorLB-Backend-master/
│   ├── api.py                      # FastAPI app, rule engine, hybrid classifier
│   ├── train_model.py              # Multi-model training (LR / SVC / RF)
│   ├── arabic_support.py           # Arabic script keyword detection
│   ├── train_arabert.py            # AraBERT fine-tuning (HuggingFace)
│   ├── requirements.txt            # Python dependencies
│   ├── Dockerfile
│   ├── .env.example
│   ├── .gitignore
│   ├── lebanese_drug_slangv3.csv   # Training dataset
│   └── tests/
│       ├── __init__.py
│       └── test_rules.py           # pytest unit tests
│
├── SlangDetectorLB-Frontend-master/
│   ├── Dockerfile
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── App.js                  # Router + ThemeProvider
│       ├── firebase.js             # Firebase init (Firestore + Storage)
│       ├── ThemeContext.js         # Dark/light mode context
│       ├── RoomSelector.js         # Room list with badges
│       ├── Chat.js                 # Real-time chat with all features
│       └── AdminDashboard.js       # Moderation dashboard
│
└── SlangDetectorLB-Extension/
    ├── manifest.json               # Manifest v3
    ├── popup.html                  # Extension popup
    ├── popup.js                    # Popup logic
    ├── content.js                  # Webpage highlighter
    ├── background.js               # Service worker
    └── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI |
| ML pipeline | scikit-learn (TF-IDF + LR / LinearSVC / RandomForest) |
| NLP preprocessing | NLTK (tokenization, POS tagging, lemmatization) |
| Fuzzy matching | fuzzywuzzy |
| Deep Arabic NLP | HuggingFace transformers, aubmindlab/bert-base-arabertv02 |
| Frontend framework | React 18 |
| Routing | React Router v7 |
| Real-time database | Firebase Firestore |
| File storage | Firebase Storage |
| Dark mode | React Context API + localStorage |
| HTTP client | Axios |
| Testing | pytest + httpx |
| Containerization | Docker + docker-compose |
| Browser extension | Chrome Manifest v3 |

---

## Notes

- The `.joblib` model file is excluded from version control. Run `python3 train_model.py` after cloning to generate it.
- Never commit `src/firebase.js` with real credentials. Use the `.env.example` template and add `.env` to `.gitignore`.
- Firestore security rules are set to open (`allow read, write: if true`) for development. Tighten rules before any production deployment.
- The system is designed as a moderation assistance tool. Human review is recommended for high-stakes decisions.
- AraBERT fine-tuning requires a CUDA-capable GPU. The keyword-based `arabic_support.py` works without a GPU.
