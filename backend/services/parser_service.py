import json
import re
import google.generativeai as genai

from core.config import settings


genai.configure(api_key=settings.GEMINI_API_KEY)

model = genai.GenerativeModel("gemini-2.5-flash")


def extract_json(text: str) -> dict:
    text = text.strip()
    text = text.replace("```json", "")
    text = text.replace("```", "")

    match = re.search(r"\{.*\}", text, re.DOTALL)

    if not match:
        raise ValueError("No valid JSON found in Gemini response")

    return json.loads(match.group())


async def parse_event_with_genai(description: str) -> dict:
    prompt = f"""
You are an intelligent traffic event parser.

Return ONLY valid JSON.
Do not add markdown.
Do not add explanation.

Schema:
{{
  "event_cause": "",
  "event_type": "",
  "vehicle_type": "",
  "blockage_level": "",
  "traffic_condition": "",
  "urgency": "",
  "injury_mentioned": false,
  "fire_mentioned": false,
  "confidence": 0.0
}}

Allowed event_cause values:
- vehicle_breakdown
- accident
- tree_fall
- congestion
- public_event
- procession
- vip_movement
- protest
- unknown

Allowed event_type values:
- accident
- congestion
- road_block
- fire
- construction
- unknown

Allowed vehicle_type values:
- car
- bike
- bus
- truck
- auto
- none

Allowed blockage_level values:
- none
- partial
- full

Allowed traffic_condition values:
- normal
- moderate
- heavy

Allowed urgency values:
- low
- medium
- high
- immediate

User traffic report:
"{description}"
"""

    response = model.generate_content(prompt)
    parsed_data = extract_json(response.text)

    return {
        "event_cause": parsed_data.get("event_cause", "unknown"),
        "event_type": parsed_data.get("event_type", "unknown"),
        "vehicle_type": parsed_data.get("vehicle_type", "none"),
        "blockage_level": parsed_data.get("blockage_level", "none"),
        "traffic_condition": parsed_data.get("traffic_condition", "normal"),
        "urgency": parsed_data.get("urgency", "low"),
        "injury_mentioned": parsed_data.get("injury_mentioned", False),
        "fire_mentioned": parsed_data.get("fire_mentioned", False),
        "confidence": parsed_data.get("confidence", 0.0),
    }