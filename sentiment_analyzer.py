#!/usr/bin/env python3
"""
Sentiment Analysis Model using Logistic Regression
Trains on Sentences_75Agree.txt and classifies news as positive/neutral/negative
"""

import sys
import json
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import pickle
import os

# Global model and vectorizer
model = None
vectorizer = None
metrics = None

def load_training_data(filepath='Sentences_75Agree.txt'):
    """Load and parse training data"""
    sentences = []
    labels = []
    
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = line.strip()
            if not line or '@' not in line:
                continue
            
            # Split on @ to get sentence and label
            parts = line.rsplit('@', 1)
            if len(parts) != 2:
                continue
            
            sentence = parts[0].strip()
            label = parts[1].strip().lower()
            
            # Map labels: positive (2), neutral (1), negative (0)
            if label == 'positive':
                labels.append(2)  # positive
                sentences.append(sentence)
            elif label == 'negative':
                labels.append(0)  # negative
                sentences.append(sentence)
            elif label == 'neutral':
                labels.append(1)  # neutral
                sentences.append(sentence)
    
    return sentences, labels

def train_model():
    """Train the logistic regression model"""
    global model, vectorizer, metrics
    
    print("Loading training data...", file=sys.stderr)
    sentences, labels = load_training_data()
    
    if len(sentences) == 0:
        print("Error: No training data found", file=sys.stderr)
        return False
    
    print(f"Loaded {len(sentences)} training examples", file=sys.stderr)
    
    # Create TF-IDF features
    print("Creating TF-IDF features...", file=sys.stderr)
    vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2), stop_words='english')
    X = vectorizer.fit_transform(sentences)
    y = labels
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Train model
    print("Training logistic regression model...", file=sys.stderr)
    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X_train, y_train)
    
    # Calculate metrics (multi-class classification)
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    # Use macro average for multi-class (positive, neutral, negative)
    precision = precision_score(y_test, y_pred, average='macro', zero_division=0)
    recall = recall_score(y_test, y_pred, average='macro', zero_division=0)
    f1 = f1_score(y_test, y_pred, average='macro', zero_division=0)
    
    metrics = {
        'accuracy': round(accuracy, 4),
        'precision': round(precision, 4),
        'recall': round(recall, 4),
        'f1_score': round(f1, 4)
    }
    
    print(f"Model trained! Accuracy: {accuracy:.4f}", file=sys.stderr)
    
    # Save model
    with open('sentiment_model.pkl', 'wb') as f:
        pickle.dump(model, f)
    with open('sentiment_vectorizer.pkl', 'wb') as f:
        pickle.dump(vectorizer, f)
    
    return True

def load_model():
    """Load pre-trained model"""
    global model, vectorizer
    
    if os.path.exists('sentiment_model.pkl') and os.path.exists('sentiment_vectorizer.pkl'):
        with open('sentiment_model.pkl', 'rb') as f:
            model = pickle.load(f)
        with open('sentiment_vectorizer.pkl', 'rb') as f:
            vectorizer = pickle.load(f)
        return True
    return False

def predict_sentiment(texts):
    """Predict sentiment for a list of texts"""
    global model, vectorizer
    
    if model is None or vectorizer is None:
        if not load_model():
            return None
    
    # Combine texts
    combined_text = ' '.join(texts)
    
    # Transform and predict
    X = vectorizer.transform([combined_text])
    prediction = model.predict(X)[0]
    probability = model.predict_proba(X)[0]
    
    # Map prediction to label: 0=negative, 1=neutral, 2=positive
    sentiment_map = {0: 'negative', 1: 'neutral', 2: 'positive'}
    sentiment = sentiment_map.get(prediction, 'neutral')
    
    # Get confidence (max probability)
    confidence = max(probability)
    
    # Get probabilities for each class
    # Ensure we have 3 classes (in case model was trained with different number)
    prob_negative = probability[0] if len(probability) > 0 else 0
    prob_neutral = probability[1] if len(probability) > 1 else 0
    prob_positive = probability[2] if len(probability) > 2 else 0
    
    return {
        'sentiment': sentiment,
        'confidence': round(float(confidence), 4),
        'probability_negative': round(float(prob_negative), 4),
        'probability_neutral': round(float(prob_neutral), 4),
        'probability_positive': round(float(prob_positive), 4)
    }

def get_metrics():
    """Get model metrics"""
    global metrics
    return metrics

# Command line interface
if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: train|predict|metrics'}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'train':
        success = train_model()
        if success:
            result = {
                'success': True,
                'metrics': metrics
            }
            print(json.dumps(result))
        else:
            print(json.dumps({'success': False, 'error': 'Training failed'}))
    
    elif command == 'predict':
        if len(sys.argv) < 3:
            print(json.dumps({'error': 'Usage: predict <json_texts>'}))
            sys.exit(1)
        
        texts = json.loads(sys.argv[2])
        result = predict_sentiment(texts)
        if result:
            print(json.dumps(result))
        else:
            print(json.dumps({'error': 'Model not trained. Run train first.'}))
    
    elif command == 'predict_base64':
        if len(sys.argv) < 3:
            print(json.dumps({'error': 'Usage: predict_base64 <base64_json>'}))
            sys.exit(1)
        
        import base64
        texts_json = base64.b64decode(sys.argv[2]).decode('utf-8')
        texts = json.loads(texts_json)
        result = predict_sentiment(texts)
        if result:
            print(json.dumps(result))
        else:
            print(json.dumps({'error': 'Model not trained. Run train first.'}))
    
    elif command == 'metrics':
        if not load_model():
            # Train if model doesn't exist
            train_model()
        result = get_metrics()
        if result:
            print(json.dumps(result))
        else:
            print(json.dumps({'error': 'No metrics available. Train model first.'}))
    
    else:
        print(json.dumps({'error': f'Unknown command: {command}'}))

