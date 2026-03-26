# Lebanese Slang Detector — Browser Extension

A Chrome/Edge extension that detects Lebanese drug and weapons slang on any webpage.

## Features
- Analyze any text directly in the popup
- Scan the current webpage for suspicious content
- Highlights flagged text inline on the page
- Connects to your local Lebanese Slang Detector API

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this `SlangDetectorLB-Extension` folder
5. The extension icon appears in your toolbar

## Requirements

The backend API must be running:
```bash
cd SlangDetectorLB-Backend-master
source venv/bin/activate
uvicorn api:app --reload
```

## Usage

1. Click the extension icon in the toolbar
2. **Analyze text**: Type or paste text and click "Analyze Text"
3. **Scan page**: Click "Scan Current Page" to find suspicious content
