"""
AraBERT Fine-tuning Script for Lebanese Slang Detection.

Uses aubmindlab/bert-base-arabertv02 from HuggingFace.
Fine-tunes it on Arabic-script drug/weapon slang data.

Requirements (install first):
    pip install transformers torch datasets accelerate

Usage:
    python3 train_arabert.py
    python3 train_arabert.py --epochs 5 --batch_size 16
    python3 train_arabert.py --predict "عندك حشيش؟"
"""

import argparse
import os
import json

# ================= ARABIC TRAINING DATA =================
# Arabic-script examples for each category
# Add more examples here to improve accuracy

ARABIC_DATA = [
    # WEED SLANG (label 1)
    ("عندك حشيش؟", 1),
    ("بدي حشيش اليوم", 1),
    ("في حشيش عندك؟", 1),
    ("جيب حشيش من عندك", 1),
    ("حشيشة لبنانية أصلية", 1),
    ("بدي دخين اليوم", 1),
    ("في جوينت؟", 1),
    ("نقص بلنت", 1),
    ("في عشبة عندك؟", 1),
    ("ماريجوانا اليوم", 1),
    ("قنب لبناني", 1),
    ("دخنا حشيش", 1),

    # PILLS SLANG (label 2)
    ("بدي حبوب", 2),
    ("في حبوب عندك؟", 2),
    ("جيب حبة وحدة", 2),
    ("عندك زاناكس؟", 2),
    ("بدي فاليوم", 2),
    ("في كبسول عندك؟", 2),
    ("حبوب جديدة", 2),
    ("مهدئات لبنانية", 2),
    ("منومات عندك؟", 2),

    # COCAINE SLANG (label 3)
    ("عندك كوكايين؟", 3),
    ("بدي كوك اليوم", 3),
    ("في بودرة عندك؟", 3),
    ("البيضاء اليوم", 3),
    ("الأبيض اليوم", 3),
    ("مسحوق نظيف", 3),
    ("جيب كوكايين", 3),
    ("بودرة لبنانية", 3),

    # WEAPONS SLANG (label 4)
    ("عندك سلاح؟", 4),
    ("في مسدس عندك؟", 4),
    ("بدي بندقية", 4),
    ("عندك سكين؟", 4),
    ("في رشاش؟", 4),
    ("كلاشنكوف عندك؟", 4),
    ("طبنجة جديدة", 4),
    ("رصاص عندك؟", 4),
    ("سلاح نظيف", 4),

    # NORMAL (label 0)
    ("كيفك اليوم؟", 0),
    ("شو الأخبار؟", 0),
    ("رايح عالسوق", 0),
    ("بدي نام", 0),
    ("الجو حلو اليوم", 0),
    ("شو بدك تاكل؟", 0),
    ("وين رايح؟", 0),
    ("أنا تعبان", 0),
    ("بكرا منحكي", 0),
    ("مبسوط كتير", 0),
    ("رايح عالجيم", 0),
    ("شو في جديد؟", 0),
]

CLASS_NAMES = {0: "NORMAL", 1: "WEED SLANG", 2: "PILLS SLANG", 3: "COCAINE SLANG", 4: "WEAPONS SLANG"}

MODEL_NAME = "aubmindlab/bert-base-arabertv02"
OUTPUT_DIR = "arabert_slang_model"


def train(epochs=3, batch_size=8, learning_rate=2e-5):
    try:
        from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
        import torch
        from torch.utils.data import Dataset
    except ImportError:
        print("[ERROR] Missing dependencies. Run:")
        print("  pip install transformers torch accelerate")
        return

    print(f"\n{'='*50}")
    print(f"  AraBERT Fine-tuning")
    print(f"{'='*50}")
    print(f"[MODEL] Loading tokenizer: {MODEL_NAME}")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    class SlangDataset(Dataset):
        def __init__(self, data, tokenizer, max_len=128):
            self.encodings = tokenizer(
                [d[0] for d in data],
                truncation=True, padding=True, max_length=max_len, return_tensors="pt"
            )
            self.labels = [d[1] for d in data]

        def __len__(self):
            return len(self.labels)

        def __getitem__(self, idx):
            item = {k: v[idx] for k, v in self.encodings.items()}
            item["labels"] = self.labels[idx]
            return item

    print(f"[DATA]  {len(ARABIC_DATA)} training examples across {len(CLASS_NAMES)} classes")

    # Split 80/20
    split = int(len(ARABIC_DATA) * 0.8)
    train_data = ARABIC_DATA[:split]
    eval_data = ARABIC_DATA[split:]

    train_dataset = SlangDataset(train_data, tokenizer)
    eval_dataset = SlangDataset(eval_data, tokenizer)

    print(f"[MODEL] Loading model: {MODEL_NAME}")
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(CLASS_NAMES),
        ignore_mismatched_sizes=True
    )

    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        learning_rate=learning_rate,
        weight_decay=0.01,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        logging_steps=10,
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
    )

    print(f"[TRAIN] Starting training ({epochs} epochs)...")
    trainer.train()

    # Save model + label map
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    with open(os.path.join(OUTPUT_DIR, "label_map.json"), "w") as f:
        json.dump(CLASS_NAMES, f, ensure_ascii=False)

    print(f"\n[SAVE]  Model saved to: {OUTPUT_DIR}/")
    print(f"[DONE]  AraBERT fine-tuning complete!\n")


def predict(text: str):
    try:
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        import torch
    except ImportError:
        print("[ERROR] Missing dependencies. Run: pip install transformers torch")
        return

    if not os.path.exists(OUTPUT_DIR):
        print(f"[ERROR] No trained model found at '{OUTPUT_DIR}'. Run training first.")
        return

    tokenizer = AutoTokenizer.from_pretrained(OUTPUT_DIR)
    model = AutoModelForSequenceClassification.from_pretrained(OUTPUT_DIR)
    model.eval()

    with open(os.path.join(OUTPUT_DIR, "label_map.json")) as f:
        label_map = json.load(f)

    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
    with torch.no_grad():
        outputs = model(**inputs)
    probs = torch.softmax(outputs.logits, dim=1)[0]
    pred = probs.argmax().item()
    conf = probs[pred].item()

    print(f"\nText: {text}")
    print(f"Label: {label_map[str(pred)]} ({conf*100:.1f}%)\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune AraBERT for Lebanese slang detection")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch_size", type=int, default=8)
    parser.add_argument("--lr", type=float, default=2e-5)
    parser.add_argument("--predict", type=str, default=None, help="Text to classify (skips training)")
    args = parser.parse_args()

    if args.predict:
        predict(args.predict)
    else:
        train(epochs=args.epochs, batch_size=args.batch_size, learning_rate=args.lr)
