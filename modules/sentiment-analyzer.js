const { exec } = require('child_process');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Sentiment Analyzer Module
 * Interfaces with Python script for sentiment analysis
 */

class SentimentAnalyzer {
  constructor() {
    this.pythonScript = path.join(__dirname, '..', 'sentiment_analyzer.py');
    this.isTrained = false;
    this.metrics = null;
  }

  /**
   * Train the sentiment model
   * @returns {Promise<Object>} Training metrics
   */
  async train() {
    try {
      const { stdout } = await execAsync(`python3 "${this.pythonScript}" train`);
      const result = JSON.parse(stdout);
      
      if (result.success) {
        this.isTrained = true;
        this.metrics = result.metrics;
        console.log('✅ Sentiment model trained successfully');
        console.log('📊 Metrics:', this.metrics);
        return result.metrics;
      } else {
        throw new Error(result.error || 'Training failed');
      }
    } catch (error) {
      console.error('Error training sentiment model:', error);
      throw error;
    }
  }

  /**
   * Get model metrics
   * @returns {Promise<Object>} Model metrics
   */
  async getMetrics() {
    if (this.metrics) {
      return this.metrics;
    }

    try {
      const { stdout } = await execAsync(`python3 "${this.pythonScript}" metrics`);
      const result = JSON.parse(stdout);
      
      if (result.error) {
        // Model not trained, train it
        return await this.train();
      }
      
      this.metrics = result;
      return result;
    } catch (error) {
      console.error('Error getting metrics:', error);
      // Try training if metrics fail
      return await this.train();
    }
  }

  /**
   * Analyze sentiment of news articles
   * @param {Array} articles - Array of article objects with title and description
   * @returns {Promise<Object>} Sentiment analysis result
   */
  async analyzeArticles(articles) {
    if (!articles || articles.length === 0) {
      return {
        sentiment: 'neutral',
        confidence: 0,
        error: 'No articles to analyze'
      };
    }

    try {
      // Extract headlines and first paragraphs
      const texts = articles.map(article => {
        const title = article.title || '';
        const description = article.description || '';
        // Get first paragraph (first 200 chars of description)
        const firstPara = description.substring(0, 200);
        return `${title} ${firstPara}`.trim();
      }).filter(text => text.length > 0);

      if (texts.length === 0) {
        return {
          sentiment: 'neutral',
          confidence: 0,
          error: 'No text content found'
        };
      }

      // Call Python script - use base64 to avoid shell escaping issues
      const textsJson = JSON.stringify(texts);
      const base64Json = Buffer.from(textsJson).toString('base64');
      const { stdout } = await execAsync(`python3 "${this.pythonScript}" predict_base64 ${base64Json}`);
      const result = JSON.parse(stdout);

      if (result.error) {
        // Model not trained, train it first
        await this.train();
        // Retry prediction
        const { stdout: retryStdout } = await execAsync(`python3 "${this.pythonScript}" predict '${textsJson}'`);
        return JSON.parse(retryStdout);
      }

      return result;
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      
      // If model not trained, train it
      if (error.message && error.message.includes('not trained')) {
        await this.train();
        return await this.analyzeArticles(articles);
      }
      
      return {
        sentiment: 'neutral',
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * Ensure model is trained
   * @returns {Promise<void>}
   */
  async ensureTrained() {
    if (!this.isTrained) {
      await this.getMetrics();
      this.isTrained = true;
    }
  }
}

module.exports = SentimentAnalyzer;

