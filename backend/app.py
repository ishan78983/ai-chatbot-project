import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv
import re
import urllib.parse

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

# --- API ROUTE for CHAT ---
@app.route("/api/generate", methods=["POST"])
def generate_chat_api():
    if not text_model:
        return jsonify({"error": "AI model not configured"}), 500
        
    data = request.get_json()
    history = data.get('history')
    latest_user_message = history[-1]['parts'][0]['text'] if history else ""

    if not history:
        return jsonify({"error": "Chat history is required"}), 400

    try:
        # Flexible image request check
        user_msg_lower = latest_user_message.lower()
        image_verbs = ["generate", "create", "draw", "make", "show"]
        image_nouns = ["image", "picture", "photo", "drawing", "painting"]
        
        has_verb_and_noun = any(verb in user_msg_lower for verb in image_verbs) and any(noun in user_msg_lower for noun in image_nouns)
        is_short_prompt_with_noun = len(user_msg_lower.split()) <= 3 and any(noun in user_msg_lower for noun in image_nouns)

        if has_verb_and_noun or is_short_prompt_with_noun:
            
            # Extract the subject of the image from the user's prompt
            search_subject = latest_user_message
            for verb in image_verbs + image_nouns + ["of", "a", "an"]:
                search_subject = search_subject.lower().replace(verb, "").strip()

            if not search_subject:
                search_subject = "image"
            
            # Use the reliable placehold.co service
            encoded_subject = urllib.parse.quote_plus(search_subject)
            image_url = f"https://placehold.co/512x512/7c3aed/FFFFFF?text={encoded_subject}"
            
            return jsonify({
                "text_response": f"This is a placeholder image for your request: '{search_subject}'. If this appears, your app is working!",
                "image_url": image_url
            })

        # --- Normal chat logic ---
        system_instruction = {"role": "user", "parts": [{"text": "You are Gemini, a highly advanced, multi-talented AI assistant..."}]}
        model_instruction = { "role": "model", "parts": [{"text": "Understood. I am Gemini..."}]}

        full_history = [system_instruction, model_instruction] + history[:-1]
        chat_session = text_model.start_chat(history=full_history)
        response = chat_session.send_message(latest_user_message)
        
        return jsonify({"text_response": response.text})

    except Exception as e:
        print(f"An error occurred during chat generation: {e}")
        return jsonify({"error": str(e)}), 500


# --- START THE SERVER ---
if __name__ == "__main__":
    app.run(debug=True, port=5000)