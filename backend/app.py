import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- INITIALIZE THE APP AND AI ---
app = Flask(__name__)
CORS(app)

# Configure the Generative AI model
try:
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    genai.configure(api_key=GOOGLE_API_KEY)
    text_model = genai.GenerativeModel('gemini-1.5-flash')
    print("Successfully configured Google AI text model")
except Exception as e:
    print(f"Error configuring Google AI: {e}")
    text_model = None

# --- API ROUTE for TWEET GENERATION ---
@app.route("/api/generate", methods=["POST"])
def generate_tweet_api():
    if not text_model:
        return jsonify({"error": "AI model not configured"}), 500
        
    data = request.get_json()
    if not all(key in data for key in ['topic', 'tone', 'length']):
        return jsonify({"error": "Missing required fields: topic, tone, or length."}), 400
    
    topic = data['topic']
    tone = data['tone']
    length = data['length']

    try:
        # This is the specialized prompt for the Tweet Generator
        prompt = f"""
        You are an expert social media strategist and copywriter specializing in creating viral Twitter content.
        Your task is to generate compelling content based on the user's request. Do not add any extra commentary, just the tweet(s).

        User's Request Details:
        - Topic: "{topic}"
        - Desired Tone: "{tone}"
        - Desired Length: "{length}"

        Instructions:
        1. Generate the content adhering strictly to the specified tone and length.
        2. Keep tweets concise and impactful (under 280 characters each).
        3. Include 2-3 relevant and popular hashtags.
        4. If a thread is requested (e.g., '3-Tweet Thread'), ensure each tweet flows logically to the next and number them (1/3, 2/3, 3/3).
        5. Format your entire response as a single block of text, with each tweet separated by a new line.
        """
        
        response = text_model.generate_content(prompt)
        
        # Split the single text block response into a list of tweets
        tweets = [tweet.strip() for tweet in response.text.strip().split('\n') if tweet.strip()]
        
        return jsonify({"tweets": tweets})

    except Exception as e:
        print(f"An error occurred during tweet generation: {e}")
        return jsonify({"error": str(e)}), 500

# --- START THE SERVER ---
if __name__ == "__main__":
    app.run(debug=True, port=5000)