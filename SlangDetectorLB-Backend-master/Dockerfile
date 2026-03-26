FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python3 -c "\
import nltk; \
nltk.download('punkt'); \
nltk.download('punkt_tab'); \
nltk.download('stopwords'); \
nltk.download('averaged_perceptron_tagger'); \
nltk.download('averaged_perceptron_tagger_eng'); \
nltk.download('wordnet')"

RUN python3 train_model.py

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
