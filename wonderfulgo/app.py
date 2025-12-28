import os
import json
import requests
import re
import time
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify

load_dotenv()

app = Flask(__name__)
api_key = os.getenv("GOOGLE_API_KEY")

# ==========================================
# ★モデル設定
# ==========================================
MODEL_1 = "gemini-2.5-flash-lite"
MODEL_2 = "gemini-2.5-flash"
MODEL_3 = "gemini-2.0-flash"

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    if not api_key: 
        return jsonify({"error": "APIキーが設定されていません。"}), 500

    data = request.json
    pet_info = data.get("petInfo", {})
    user_message = data.get("message", "")
    history = data.get("history", [])

    if not user_message: 
        return jsonify({"error": "空のメッセージです。"}), 400

    # 1. 車移動かどうかの判定（物理ガード用）
    is_planning = any(k in user_message for k in ["プラン", "コース", "ルート", "日程"]) and ("作って" in user_message or "提案" in user_message)
    is_car_trip = "移動手段：車" in user_message

    # 2. プロンプト作成（お気に入りの構成）
    pet_profile = "【愛犬の詳細プロファイル】\n"
    labels = {
        "dog_name":"名前","breed":"犬種","gender":"性別","age":"年齢","weight":"体重",
         "coat_type":"毛の長さ", "coat_color":"毛色",
         "personality":"性格","owner_residence":"居住地","dog_interaction":"他の犬との交流",
        "human_interaction":"人との交流","medical_history":"持病","allergies":"アレルギー",
        "exercise_level":"運動量","car_sickness":"車酔い","barking_tendency":"吠え癖","biting_habit":"噛み癖",
        "walk_frequency_time":"散歩の頻度","likes_water_play":"水遊びの好き嫌い","training_status":"しつけ状況"
    }
    for k, v in pet_info.items():
        if v and k in labels:
            pet_profile += f"- {labels[k]}: {v}\n"

    chat_context = ""
    if history:
        chat_context = "【これまでの会話履歴】\n"
        for msg in history[-8:]:
            role_name = "ユーザー" if msg['sender'] == 'user' else "AI"
            chat_context += f"{role_name}: {msg['content']}\n"
        chat_context += "--- 履歴ここまで ---\n\n"

    prompt = "役割:犬の専門家。以下のプロファイルと履歴を把握し、犬種特性・性格・健康状態・ユーザーの今日の気分を考慮して回答せよ。挨拶不要。\n"    
    prompt += f"{pet_profile}\n"
    prompt += f"{chat_context}"
    prompt += f"【今回の依頼・今日の気分・要望】\n{user_message}\n"

    if is_planning:
        prompt += "\n※お出かけプラン作成指示:\n"
        if "1日" in user_message:
            prompt += "- 条件:所要時間1日(3-4箇所,食事を含めたフルコース)\n"
        elif "半日" in user_message:
            prompt += "- 条件:所要時間半日(2-3箇所)\n"
        elif "2時間" in user_message:
            prompt += "- 条件:所要時間2時間(1-2箇所,散歩主体)\n"
        
        # 移動手段に応じたAIへの指示（これでもAIが間違えることがあるので、後でPythonで直します）
        if is_car_trip:
            prompt += "- 追加条件: 移動手段が「車」のため、各スポットについて「最も近い駐車場の名称と料金目安」を必ず調査し、parking_infoに記述してください。\n"
        else:
            prompt += "- 追加条件: 移動手段が車ではないため、parking_infoは必ず空文字(\"\")にしてください。駐車場情報は一切不要です。\n"
            
        prompt += "\nGoogle検索で現在実在する場所のみを確認して提案してください。JSON形式のみで出力してください:\n"
        prompt += '{"plan_title":"","greeting_message":"","spots":[{"name":"","address":"","pet_condition":"","description":"","parking_info":""}]}'
    else:
        prompt += "回答はテキストのみ。400~600文字程度で愛犬専用のアドバイスをプロとして行ってください。"

    # --- AI通信 ---
    def call_gemini(model):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        if is_planning:
            payload["tools"] = [{"google_search": {}}]
        
        try:
            res = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=90)
            return res.json() if res.status_code == 200 else None
        except: return None

    result = None
    for model in [MODEL_1, MODEL_2, MODEL_3]:
        result = call_gemini(model)
        if result: break
        time.sleep(1)

    if not result:
        return jsonify({"error": "アクセスが集中しています。再度お試しください。"}), 503

    try:
        text = result['candidates'][0]['content']['parts'][0]['text']
        if is_planning:
            match = re.search(r'(\{[\s\S]*\})', text)
            if match:
                try:
                    plan_data = json.loads(re.sub(r'[\x00-\x1F\x7F]', '', match.group(1)))
                    
                    # ==========================================
                    # ★【重要】物理ガード ＆ [object Object] 対策
                    # ==========================================
                    if "spots" in plan_data:
                        for spot in plan_data["spots"]:
                            if not is_car_trip:
                                # 【ガード1】車以外なら、中身が何であれ強制的に空文字にする
                                spot["parking_info"] = ""
                            else:
                                # 【ガード2】車移動の時：AIが辞書形式などで返してきた場合に備えて文字列に変換
                                p_val = spot.get("parking_info", "")
                                if p_val is not None and not isinstance(p_val, str):
                                    spot["parking_info"] = str(p_val)
                    # ==========================================
                    return jsonify(plan_data)
                except: pass
        return jsonify({"response": text})
    except:
        return jsonify({"error": "処理エラー"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
