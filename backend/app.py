import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv
import base64

# Load environment variables
load_dotenv()

# --- INITIALIZE THE APP AND AI ---
app = Flask(__name__)
CORS(app)

# Configure the Generative AI model
try:
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    STABILITY_API_KEY = os.getenv("STABILITY_API_KEY") # Get Stability AI key
    genai.configure(api_key=GOOGLE_API_KEY)
    text_model = genai.GenerativeModel('gemini-1.5-flash')
    print("Successfully configured Google AI text model")
except Exception as e:
    print(f"Error configuring AI models: {e}")
    text_model = None
    STABILITY_API_KEY = None

# --- STABILITY AI IMAGE GENERATION FUNCTION ---
def generate_image_with_stability(prompt):
    if not STABILITY_API_KEY:
        raise ValueError("Stability AI API key not found.")

    url = "https://api.stability.ai/v2beta/stable-image/generate/sd3"
    headers = {
        "authorization": f"Bearer {STABILITY_API_KEY}",
        "accept": "image/*"
    }
    files = {
        "prompt": (None, prompt),
        "output_format": (None, "png"),
    }
    
    print(f"Sending request to Stability AI for prompt: {prompt}")
    response = requests.post(url, headers=headers, files=files)
    
    if response.status_code == 200:
        print("Successfully generated image from Stability AI.")
        # Encode image bytes to a base64 string
        base64_image = base64.b64encode(response.content).decode('utf-8')
        return base64_image
    else:
        print(f"Stability AI Error: {response.text}")
        raise Exception(f"Failed to generate image: {response.text}")

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
        image_verbs = ["generate", "create", "draw", "make", "show", "paint"]
        image_nouns = ["image", "picture", "photo", "drawing", "painting", "art", "artwork"]
        
        has_verb = any(verb in user_msg_lower for verb in image_verbs)
        has_noun = any(noun in user_msg_lower for noun in image_nouns)
        
        if has_verb and has_noun:
            # Clean up the prompt to send to the image generator
            image_prompt = latest_user_message
            for verb in image_verbs + ["a", "an", "of"]:
                image_prompt = image_prompt.lower().replace(verb, "").strip()
            
            generated_image_base64 = generate_image_with_stability(image_prompt)
            
            return jsonify({
                "text_response": f"Here is the image I generated for '{image_prompt}':",
                "image_base64": generated_image_base64
            })

        # --- Normal chat logic ---
        # The system instruction is simplified as this is a better practice for chat models
        chat_session = text_model.start_chat(history=history[:-1])
        response = chat_session.send_message(latest_user_message)
        
        return jsonify({"text_response": response.text})

    except Exception as e:
        print(f"An error occurred during chat generation: {e}")
        return jsonify({"error": str(e)}), 500

# --- START THE SERVER ---
if __name__ == "__main__":
    app.run(debug=True, port=5000)