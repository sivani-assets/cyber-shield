import os, re, uuid, json, sqlite3, traceback, base64, io
try:
    from PIL import Image
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
try:
    from flask_cors import CORS
    _cors_available = True
except ImportError:
    _cors_available = False

app = Flask(__name__, static_folder="frontend", static_url_path="")
if _cors_available:
    CORS(app)

# ================================================================
# OPTIONAL: Paste Groq key for AI scanning (free: console.groq.com)
# Without key: manual pattern detection is used (always works!)
# ================================================================
GROQ_API_KEY = ""
# ================================================================

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cybershakthi.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    db = get_db()
    db.execute("CREATE TABLE IF NOT EXISTS scam_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, verdict TEXT, timestamp TEXT)")
    db.execute("CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, name TEXT, phone TEXT, description TEXT, location TEXT, timestamp TEXT)")
    db.commit()
    db.close()

init_db()

# ── Manual pattern detection (works without any API key) ───────
SCAM_PATTERNS = [
    # OTP & verification
    (r"otp|one.time.pass|verification.code|your otp|otp is|otp:",           "OTP request — never share!", 9),
    (r"valid only for [0-9]+|valid for [0-9]+ min|expires in [0-9]+",               "OTP expiry pressure",        7),
    (r"do not share|never share|share with no one|share this otp",           "OTP sharing warning (scam)", 6),
    # Identity & KYC
    (r"aadhaar|aadhar|pan.card|kyc|e-kyc|kyc.update|kyc.verif",             "Identity document request",  9),
    (r"link.?(aadhaar|pan)|update.?(aadhaar|pan|kyc)|verify.?kyc",          "Fake KYC/ID link",           9),
    # Banking & card
    (r"cvv|card.number|atm.pin|debit.card|credit.card|net.?banking",        "Card/bank details request",  10),
    (r"sbi|hdfc|icici|axis|kotak|paytm|phonepe|gpay|upi.?(id|pin|link)",    "Bank/UPI impersonation",     8),
    (r"account.?(block|suspend|deactivat|verif|freeze|close)",              "Account threat",             8),
    (r"password|passcode|mpin|ipin|login|sign.?in",                         "Password/login request",     8),
    # Lottery & prizes
    (r"won|winner|lottery|prize|congratulat|lucky.draw|selected",           "Lottery/prize scam",         8),
    (r"lakh|crore|[0-9]+,000|reward|cashprize|cash.prize",                     "Cash prize bait",            7),
    (r"kbc|kaun.banega|national.lottery|whatsapp.lottery",                  "KBC/lottery scam",           9),
    # Urgency
    (r"urgent|immediately|expires|act.now|last.chance|limited.time|hurry",  "Urgency/pressure tactics",   6),
    (r"24.hours|48.hours|\d+ hours|today only|tonight|deadline",            "Deadline pressure",          5),
    (r"block|suspend|deactivat|terminat|cancel",                            "Account threat language",    6),
    # Job fraud
    (r"job.offer|work.from.home|wfh|earn [0-9]+|salary|part.time|data.entry", "Fake job offer",             6),
    (r"registration.fee|training.fee|security.deposit|joining.fee",         "Job fee scam",               9),
    # Free offers
    (r"free.?(iphone|mobile|gift|recharge|money|cash|sim|data)",            "Free gift bait",             7),
    (r"claim.?(now|here|prize|reward|gift)|collect.?(prize|reward)",        "Fake claim prompt",          7),
    # Suspicious links
    (r"http://|\.xyz|\.tk|\.ml|\.cf|\.ga|bit\.ly|tinyurl",              "Suspicious link",            7),
    (r"click.?here|tap.?here|open.?link|visit.?now|follow.?link",           "Suspicious link prompt",     5),
    (r"verify.?(now|account|number|otp)|confirm.?(otp|account|number)",     "Fake verify prompt",         8),
    # Investment fraud
    (r"invest|trading|profit|return|stock.tip|share.market|crypto",         "Investment fraud",           6),
    (r"guaranteed.return|[0-9]+%.?(profit|return|gain)|double.money",          "Fake investment return",     8),
    # Refund & cashback
    (r"refund|cashback|discount|coupon|voucher|offer",                      "Too-good offer",             3),
    (r"income.tax.refund|tds.refund|gst.refund|it.refund",                  "Fake tax refund",            8),
    # Romance & impersonation  
    (r"army|military|doctor|engineer|abroad|foreign|london|dubai|usa",      "Romance scam profile",       4),
    (r"stranded|stuck|emergency|hospital|accident|urgent.help",             "Distress money request",     6),
    # Dear customer pattern (very common in Indian SMS scams)
    (r"dear.customer|dear.user|dear.member|valued.customer",                "Impersonation SMS",          5),
    (r"can.t reply|cannot reply|do not reply|don.t reply",                  "One-way scam SMS",           4),
]

def manual_scan(image_b64):
    # Use OCR to extract real visible text from the image
    text = ""
    if OCR_AVAILABLE:
        try:
            img_bytes = base64.b64decode(image_b64)
            img = Image.open(io.BytesIO(img_bytes))
            # Preprocess: convert to grayscale + increase contrast for better OCR
            img = img.convert("L")
            # Run OCR with page segmentation mode 6 (single block of text)
            custom_config = r"--oem 3 --psm 6"
            text = pytesseract.image_to_string(img, config=custom_config)
            # Also try PSM 3 (fully automatic) and merge results
            text2 = pytesseract.image_to_string(img, config=r"--oem 3 --psm 3")
            text = text + " " + text2
        except Exception as ocr_err:
            print(f"[OCR error]: {ocr_err}")
    # If OCR unavailable/failed, text stays empty — patterns won't match but no crash
    if not text:
        text = ""
    text = text.lower()
    flags, score = [], 0
    for pattern, label, weight in SCAM_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            flags.append(label)
            score += weight
    verdict = "danger" if score >= 7 else "suspicious" if score >= 3 else "safe"
    confidence = min(97, 30 + score * 5)
    if verdict == "danger":
        explanation = f"Found {len(flags)} high-risk pattern(s) — this looks like a scam."
        advice = "Do NOT share any details. Report to cybercrime.gov.in or call 1930."
    elif verdict == "suspicious":
        explanation = f"Found {len(flags)} warning sign(s). Verify before responding."
        advice = "Do not click any links. Verify the sender through official channels."
    else:
        explanation = "No obvious scam patterns detected."
        advice = "Stay alert — never share OTP, Aadhaar, or passwords with anyone."
    return {"verdict": verdict, "confidence": confidence, "red_flags_found": flags,
            "scam_type": flags[0] if flags else "", "explanation": explanation, "advice": advice}

@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")

@app.route("/api/scan-image", methods=["POST"])
def scan_image():
    try:
        data = request.json
        if not data or "image" not in data:
            return jsonify({"status": "error", "message": "No image"}), 400

        image_b64 = data.get("image", "")
        media_type = "image/jpeg"
        if "," in image_b64:
            header = image_b64.split(",")[0]
            image_b64 = image_b64.split(",")[1]
            if "png"  in header: media_type = "image/png"
            elif "webp" in header: media_type = "image/webp"

        # Try Groq AI if key provided
        if GROQ_API_KEY not in ("PASTE_YOUR_GROQ_KEY_HERE", ""):
            try:
                from groq import Groq
                client = Groq(api_key=GROQ_API_KEY)
                response = client.chat.completions.create(
                    model="meta-llama/llama-4-maverick-17b-128e-instruct",
                    messages=[{"role": "user", "content": [
                        {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_b64}"}},
                        {"type": "text", "text": """Analyze this screenshot for scams targeting people in India.
Reply ONLY with valid JSON, no extra text:
{"verdict":"danger","confidence":85,"red_flags_found":["list issues"],"scam_type":"type","explanation":"2-3 sentences","advice":"action to take"}
verdict must be exactly: danger, suspicious, or safe"""}
                    ]}],
                    max_tokens=512
                )
                raw = response.choices[0].message.content.strip()
                raw = re.sub(r"```json|```", "", raw).strip()
                # Extract JSON object if surrounded by extra text
                m = re.search(r'\{.*\}', raw, re.DOTALL)
                raw = m.group(0) if m else raw
                result = json.loads(raw)
                if result.get("verdict") not in ("danger","suspicious","safe"):
                    result["verdict"] = "suspicious"
                db = get_db()
                db.execute("INSERT INTO scam_logs (url,verdict,timestamp) VALUES (?,?,?)",
                           ("[image-scan]", result["verdict"], datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
                db.commit(); db.close()
                return jsonify({"status": "success", "result": result})
            except Exception as e:
                print(f"[Groq failed, using manual]: {e}")

        # Manual detection — always works
        result = manual_scan(image_b64)
        db = get_db()
        db.execute("INSERT INTO scam_logs (url,verdict,timestamp) VALUES (?,?,?)",
                   ("[image-scan]", result["verdict"], datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        db.commit(); db.close()
        return jsonify({"status": "success", "result": result})

    except Exception as e:
        print(f"ERROR: {traceback.format_exc()}")
        return jsonify({"status": "error", "result": {
            "verdict": "suspicious", "confidence": 0, "red_flags_found": [],
            "scam_type": "", "explanation": f"Error: {str(e)}", "advice": "Check terminal."
        }}), 200

@app.route("/api/scan-url", methods=["POST"])
def scan_url():
    data = request.json or {}
    url = data.get("url","").strip()
    if not url: return jsonify({"status":"error","message":"No URL"}), 400
    RED_FLAGS = [
        (r"bit\.ly|tinyurl|t\.co",                            "URL shortener", 5),
        (r"free[\-_]?(gift|prize|lottery|recharge)",          "Free prize bait", 8),
        (r"sbi[\-_.]?kyc|hdfc[\-_.]?update|paytm[\-_.]?kyc", "Fake bank KYC", 9),
        (r"verify[\-_.]?account|confirm[\-_.]?otp",           "OTP scam", 8),
        (r"aadhaar[\-_.]?update|pan[\-_.]?link",              "Fake govt ID", 9),
        (r"win[\-_]?(cash|money|reward|crore|lakh)",          "Cash reward scam", 7),
        (r"\.xyz$|\.tk$|\.ml$|\.cf$|\.ga$",                  "Suspicious domain", 5),
        (r"^http://",                                          "Not HTTPS", 3),
        (r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}",              "IP address URL", 6),
    ]
    chk = url if url.startswith("http") else "https://"+url
    flags, score = [], 0
    for pat, label, w in RED_FLAGS:
        if re.search(pat, chk, re.IGNORECASE):
            flags.append(label); score += w
    verdict = "danger" if score>=8 else "suspicious" if score>=3 else "safe"
    db = get_db()
    db.execute("INSERT INTO scam_logs (url,verdict,timestamp) VALUES (?,?,?)",
               (url, verdict, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    db.commit(); db.close()
    return jsonify({"status":"success","verdict":verdict,"confidence":min(95,40+score*6),
        "red_flags_found":flags,
        "explanation":f"Found {len(flags)} suspicious pattern(s)." if flags else "No phishing patterns found.",
        "advice":"Do NOT open this. Call 1930." if score>=8 else "Verify before clicking." if score>=3 else "Looks okay — stay alert.",
        "scam_type":flags[0] if flags else ""})

@app.route("/api/report", methods=["POST"])
def submit_report():
    data = request.json or {}
    rid = f"SHLD-{str(uuid.uuid4())[:8].upper()}"
    db = get_db()
    db.execute("INSERT INTO reports (id,name,phone,description,location,timestamp) VALUES (?,?,?,?,?,?)",
               (rid, data.get("name","Anonymous"), data.get("phone",""),
                data.get("description",""), data.get("location",""),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    db.commit(); db.close()
    return jsonify({"status":"success","report_id":rid,"message":f"Report {rid} filed."})

@app.route("/api/heatmap", methods=["GET"])
def get_heatmap():
    db = get_db()
    rows = db.execute("SELECT location, COUNT(*) as count FROM reports WHERE location!='' GROUP BY location ORDER BY count DESC").fetchall()
    db.close()
    return jsonify([{"location":r["location"],"count":r["count"]} for r in rows])

@app.route("/api/logs", methods=["GET"])
def get_logs():
    db = get_db()
    rows = db.execute("SELECT * FROM scam_logs ORDER BY id DESC LIMIT 50").fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/status", methods=["GET"])
def get_status():
    try:
        db = get_db()
        scans = db.execute("SELECT COUNT(*) FROM scam_logs").fetchone()[0]
        reports = db.execute("SELECT COUNT(*) FROM reports").fetchone()[0]
        db.close()
        key_ok = GROQ_API_KEY not in ("PASTE_YOUR_GROQ_KEY_HERE","")
        return jsonify({"status":"ok","database":"connected","total_scans":scans,"total_reports":reports,"api_key_set":key_ok})
    except Exception as e:
        return jsonify({"status":"error","message":str(e)}), 500

if __name__ == "__main__":
    key_ok = GROQ_API_KEY not in ("PASTE_YOUR_GROQ_KEY_HERE","")
    print("\n" + "="*50)
    print("  SHIELD v3.0")
    print("="*50)
    print(f"  Database : {DB_PATH}")
    print(f"  Mode     : {'Groq AI + Manual' if key_ok else 'Manual Detection (no API needed)'}")
    print(f"  Open at  : http://127.0.0.1:5000")
    print("="*50 + "\n")
    app.run(debug=True, port=5000)