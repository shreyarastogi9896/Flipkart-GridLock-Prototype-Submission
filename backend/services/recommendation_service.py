import json
import re
import google.generativeai as genai

from core.config import settings


genai.configure(api_key=settings.GEMINI_API_KEY)

model = genai.GenerativeModel("gemini-2.5-flash")


def extract_json(text: str) -> dict:
    text = text.strip()
    text = text.replace("```json", "").replace("```", "")

    match = re.search(r"\{.*\}", text, re.DOTALL)

    if not match:
        raise ValueError("No valid JSON found in Gemini response")

    return json.loads(match.group())


async def generate_recommendation(
    parsed: dict,
    road_block_probability: float,
    severity_score: float,
    historical_intelligence: dict
) -> dict:

    prompt = f"""
You are an AI traffic command assistant.

Based on the traffic event data, recommend the best response action.

Return ONLY valid JSON.

Allowed recommended_action:
- IGNORE
- MONITOR
- PARTIAL_BLOCK
- FULL_BLOCK

Schema:
{{
  "recommended_action": "",
  "response_level": "",
  "reason": "",
  "resources": {{
    "traffic_police": 0,
    "tow_truck": 0,
    "ambulance": 0
  }}
}}

Event Data:
parsed_event = {parsed}
road_block_probability = {road_block_probability}
severity_score = {severity_score}
historical_intelligence = {historical_intelligence}
"""

    response = model.generate_content(prompt)

    data = extract_json(response.text)

    return {
        "recommended_action": data.get("recommended_action", "MONITOR"),
        "response_level": data.get("response_level", "MEDIUM"),
        "reason": data.get("reason", ""),
        "resources": data.get(
            "resources",
            {
                "traffic_police": 2,
                "tow_truck": 0,
                "ambulance": 0
            }
        )
    }