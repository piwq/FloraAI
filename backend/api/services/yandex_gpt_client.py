import os
import urllib.request
import json

def get_agronomist_reply(system_prompt: str, past_messages: list, new_message: str) -> str:
    api_key = os.getenv("YANDEX_API_KEY")
    folder_id = os.getenv("YANDEX_FOLDER_ID")

    if not api_key or not folder_id:
        return f"Ответ (Заглушка). Нейросеть отключена. Вы спросили: {new_message}"

    yandex_messages = [{"role": "system", "text": system_prompt}]
    for msg in past_messages:
        yandex_messages.append({"role": msg.role, "text": msg.content})

    url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
    headers = {"Content-Type": "application/json", "Authorization": f"Api-Key {api_key}"}
    data = {
        "modelUri": f"gpt://{folder_id}/yandexgpt/latest",
        "completionOptions": {"temperature": 0.3, "maxTokens": 1000},
        "messages": yandex_messages
    }

    try:
        req = urllib.request.Request(url, headers=headers, data=json.dumps(data).encode())
        with urllib.request.urlopen(req) as res:
            response_json = json.loads(res.read())
            return response_json['result']['alternatives'][0]['message']['text']
    except Exception as e:
        return f"⚠️ Ошибка связи с Яндекс: {str(e)}"