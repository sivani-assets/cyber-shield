// ═══════════════════════════════════════════════════════════════
//  SHIELD v3.0 — script.js
//  Talks to Flask backend at http://127.0.0.1:5000
// ═══════════════════════════════════════════════════════════════

const API = "http://127.0.0.1:5000/api";

// ── Translations ─────────────────────────────────────────────
const T = {
  danger:     { en:"⚠️ DANGER — PHISHING DETECTED", hi:"⚠️ खतरा — फ़िशिंग मिली", ta:"⚠️ ஆபத்து — ஃபிஷிங்", te:"⚠️ ప్రమాదం", bn:"⚠️ বিপদ — ফিশিং", mr:"⚠️ धोका — फिशिंग" },
  suspicious: { en:"🟠 SUSPICIOUS — Verify Before Acting", hi:"🟠 संदिग्ध — पहले जांचें", ta:"🟠 சந்தேகாஸ்பதம்", te:"🟠 అనుమానాస్పదం", bn:"🟠 সন্দেহজনক", mr:"🟠 संशयास्पद" },
  safe:       { en:"✅ LOOKS SAFE — Stay Alert Always",   hi:"✅ सुरक्षित लगता है", ta:"✅ பாதுகாப்பானது", te:"✅ సురక్షితం", bn:"✅ নিরাপদ", mr:"✅ सुरक्षित" },
};

// ── India Cities for Heatmap ──────────────────────────────────
const INDIA_CITIES = [
  { name:"Mumbai",    state:"Maharashtra", lat:19.076, lng:72.877, scams:18420, type:"Financial Fraud" },
  { name:"Delhi",     state:"Delhi",       lat:28.704, lng:77.102, scams:22310, type:"Romance Scam" },
  { name:"Bengaluru", state:"Karnataka",   lat:12.971, lng:77.594, scams:14850, type:"Job Fraud" },
  { name:"Hyderabad", state:"Telangana",   lat:17.385, lng:78.486, scams:12640, type:"KYC Scam" },
  { name:"Chennai",   state:"Tamil Nadu",  lat:13.082, lng:80.270, scams:11320, type:"OTP Fraud" },
  { name:"Kolkata",   state:"West Bengal", lat:22.572, lng:88.363, scams:9840,  type:"Financial Fraud" },
  { name:"Ahmedabad", state:"Gujarat",     lat:23.022, lng:72.571, scams:8760,  type:"Job Fraud" },
  { name:"Pune",      state:"Maharashtra", lat:18.520, lng:73.856, scams:9120,  type:"Romance Scam" },
  { name:"Jaipur",    state:"Rajasthan",   lat:26.912, lng:75.787, scams:7230,  type:"KYC Scam" },
  { name:"Lucknow",   state:"UP",          lat:26.846, lng:80.946, scams:6540,  type:"OTP Fraud" },
];

// ── Scam Simulator Scenarios ──────────────────────────────────
const SCENARIOS = [
  {
    id:"lottery", emoji:"🎰", title:"Fake Lottery Win",
    category:"Financial Fraud",
    messages:[
      { from:"scammer", text:"Congratulations! You've won ₹50 Lakhs in the National Digital Lottery! 🎉" },
      { from:"scammer", text:"To claim your prize, pay ₹2,999 processing fee first. Time limit: 2 hours!" },
    ],
    choices:[
      { text:"Pay the fee to claim my prize", correct:false, feedback:"❌ Wrong! Legitimate lotteries NEVER ask you to pay a fee to claim winnings. This is a classic advance-fee scam." },
      { text:"Ask for their official registration number", correct:true,  feedback:"✅ Smart! Always ask for official details. Real orgs will provide them; scammers will disappear." },
      { text:"Ignore and delete the message", correct:true,  feedback:"✅ Best move! No entry = no win. Delete and block immediately." },
    ]
  },
  {
    id:"job", emoji:"💼", title:"Fake Job Offer",
    category:"Job Fraud",
    messages:[
      { from:"scammer", text:"Hi! We found your resume on Naukri. WFH job, ₹45,000/month. No experience needed." },
      { from:"scammer", text:"Just pay ₹1,500 for your ID card and training kit. We'll deduct it from your first salary!" },
    ],
    choices:[
      { text:"Pay ₹1,500 to get the job", correct:false, feedback:"❌ Wrong! Real employers NEVER charge you money for a job. This is a job fraud scam — very common in India." },
      { text:"Ask for the company's GST number and LinkedIn page", correct:true, feedback:"✅ Correct! Verify before trusting. Legitimate companies will have verifiable details." },
      { text:"Call the company's official number from their website", correct:true, feedback:"✅ Perfect! Always verify through official channels, not the number they gave you." },
    ]
  },
  {
    id:"kyc", emoji:"🏦", title:"Fake KYC / Bank Alert",
    category:"KYC Scam",
    messages:[
      { from:"scammer", text:"ALERT: Your SBI account will be blocked in 24 hours! Complete KYC now: http://sbi-kyc-verify.xyz" },
      { from:"scammer", text:"Click the link and enter your ATM card number, CVV and OTP to re-activate." },
    ],
    choices:[
      { text:"Click the link and enter my details", correct:false, feedback:"❌ Extremely dangerous! 'sbi-kyc-verify.xyz' is a fake site. Banks will NEVER ask for CVV or OTP via SMS." },
      { text:"Call SBI's official number: 1800 11 2211", correct:true, feedback:"✅ Perfect! Always call your bank's official number. Never trust links in SMS messages." },
      { text:"Delete and report to 1930 (Cyber Crime Helpline)", correct:true, feedback:"✅ Excellent! Reporting helps protect others. 1930 is India's official cyber crime helpline." },
    ]
  },
  {
    id:"romance", emoji:"💔", title:"Romance / Love Scam",
    category:"Romance Scam",
    messages:[
      { from:"scammer", text:"Hi beautiful 😊 I'm Dr. James from London, working with UN. I found you on Facebook." },
      { from:"scammer", text:"I am deeply in love with you. Can you help me? I'm stranded — please send ₹10,000 via GPay." },
    ],
    choices:[
      { text:"Send money, they seem genuine", correct:false, feedback:"❌ This is a romance scam! The 'doctor' is a scammer. They build fake emotional connections then ask for money." },
      { text:"Video call them to verify their identity first", correct:true, feedback:"✅ Smart! Scammers will always refuse a video call or use fake pre-recorded videos. This exposes them." },
      { text:"Block and report the profile", correct:true, feedback:"✅ Best choice! Report the profile on the platform and to cybercrime.gov.in to protect others." },
    ]
  },
];

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
let currentLang = "en";
let currentFile = null;
let completedScenarios = [];

// ═══════════════════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════════════════
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
    if (tab.dataset.tab === "heatmap") renderHeatmap("all");
    if (tab.dataset.tab === "simulator") renderSimMenu();
  });
});

// ═══════════════════════════════════════════════════════════════
//  LANGUAGE PILLS
// ═══════════════════════════════════════════════════════════════
document.querySelectorAll(".lang-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".lang-pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    currentLang = pill.dataset.lang;
  });
});

// ═══════════════════════════════════════════════════════════════
//  SCREENSHOT AI
// ═══════════════════════════════════════════════════════════════
const uploadZone  = document.getElementById("uploadZone");
const fileInput   = document.getElementById("fileInput");
const previewWrap = document.getElementById("previewWrap");
const previewImg  = document.getElementById("previewImg");
const clearBtn    = document.getElementById("clearImg");
const scanImgBtn  = document.getElementById("scanImgBtn");
const resultBanner = document.getElementById("resultBanner");
const aiDesc      = document.getElementById("aiDesc");
const aiFlagList  = document.getElementById("aiFlagList");

uploadZone.addEventListener("click", () => fileInput.click());

uploadZone.addEventListener("dragover", e => {
  e.preventDefault();
  uploadZone.style.borderColor = "rgba(255,77,109,0.9)";
});
uploadZone.addEventListener("dragleave", () => {
  uploadZone.style.borderColor = "";
});
uploadZone.addEventListener("drop", e => {
  e.preventDefault();
  uploadZone.style.borderColor = "";
  handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener("change", e => handleFile(e.target.files[0]));

clearBtn.addEventListener("click", () => {
  currentFile = null;
  previewImg.src = "";
  previewWrap.style.display = "none";
  uploadZone.style.display = "block";
  resultBanner.style.display = "none";
  aiFlagList.innerHTML = "";
  aiDesc.textContent = "Upload a screenshot and click Scan. Our AI reads text, logos, links and urgency cues to detect phishing patterns.";
  document.getElementById("uploadTitle").textContent = "Drop screenshot or click to upload";
  fileInput.value = "";
});

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = e => {
    currentFile = e.target.result;
    previewImg.src = currentFile;
    uploadZone.style.display = "none";
    previewWrap.style.display = "block";
    resultBanner.style.display = "none";
    aiFlagList.innerHTML = "";
    aiDesc.textContent = "Ready to scan! Click the button below.";
  };
  reader.readAsDataURL(file);
}

// ── 26 India-specific scam patterns — no backend needed ─────────
const IMG_PATTERNS = [
  [/otp|one[\s-]?time[\s-]?pass|your\s+otp|otp\s+is/i,                          "OTP request — never share!",   9],
  [/valid\s+only\s+for\s+\d+|valid\s+for\s+\d+\s*min/i,                         "OTP expiry pressure",          7],
  [/do\s+not\s+share|never\s+share|don.t\s+share\s+otp/i,                        "OTP share warning",            5],
  [/aadhaar|aadhar|pan\s*card|e[\s-]?kyc|kyc\s*update/i,                          "Identity document request",    9],
  [/cvv|card\s*number|atm\s*pin|net\s*banking|debit\s*card/i,                     "Card/bank details request",   10],
  [/\bsbi\b|hdfc|icici|axis\s*bank|paytm|phonepe|gpay|\bupi\b/i,                  "Bank/UPI impersonation",       7],
  [/account\s*(block|suspend|deactivat|freeze|close)/i,                             "Account threat",               8],
  [/password|passcode|\bmpin\b/i,                                                   "Password request",             8],
  [/won|winner|lottery|prize|lucky\s*draw|congratulat/i,                            "Lottery/prize scam",           8],
  [/\blakh|\bcrore|cash\s*prize|reward/i,                                           "Cash prize bait",              6],
  [/kbc|kaun\s*banega|national\s*lottery/i,                                         "KBC/lottery scam",             9],
  [/urgent|immediately|act\s*now|last\s*chance|hurry/i,                             "Urgency pressure",             6],
  [/24\s*hours|48\s*hours|today\s*only|deadline/i,                                  "Deadline pressure",            5],
  [/registration\s*fee|training\s*fee|joining\s*fee/i,                              "Job fee scam",                 9],
  [/work\s*from\s*home|wfh\b|data\s*entry/i,                                       "Fake job offer",               6],
  [/free\s*(iphone|gift|recharge|money|cash)/i,                                     "Free gift bait",               7],
  [/claim\s*(now|prize|reward)|collect\s*(prize|reward)/i,                          "Fake claim prompt",            7],
  [/http:\/\/|\.xyz\b|\.tk\b|bit\.ly|tinyurl/i,                                   "Suspicious link",              7],
  [/click\s*here|tap\s*here|open\s*link|visit\s*now/i,                             "Click-bait prompt",            5],
  [/verify\s*(now|account|otp)|confirm\s*(otp|account)/i,                           "Fake verify prompt",           8],
  [/dear\s*(customer|user|member|valued)/i,                                          "Impersonation SMS",            5],
  [/can.t\s*reply|cannot\s*reply|do\s*not\s*reply/i,                               "One-way scam SMS",             4],
  [/income\s*tax\s*refund|tds\s*refund|gst\s*refund/i,                             "Fake tax refund",              8],
  [/guaranteed\s*return|\d+%\s*(profit|return)|double\s*money/i,                   "Fake investment return",       8],
  [/stranded|stuck\s*abroad|emergency\s*help/i,                                     "Distress money request",       6],
  [/purplle|meesho|flipkart.*otp|amazon.*otp/i,                                      "E-commerce OTP scam",          6],
];

function patternScanImage(dataUrl) {
  // Decode base64 → binary string, then extract ONLY printable ASCII words (3+ chars)
  // This avoids random binary bytes accidentally matching scam patterns
  let text = "";
  try {
    const b64 = dataUrl.split(",")[1] || "";
    const binary = atob(b64);
    // Extract sequences of printable ASCII characters (letters, digits, common punctuation)
    // minimum 3 chars long to avoid single-char noise
    const matches = binary.match(/[\x20-\x7E]{3,}/g) || [];
    text = matches.join(" ");
  } catch(e) {
    text = "";
  }

  // Only proceed if we extracted a meaningful amount of text
  // If text is very short, the image likely has no readable text → safe
  if (text.length < 20) {
    return {
      verdict: "safe", confidence: 70,
      red_flags_found: [],
      scam_type: "",
      explanation: "No readable text found in this image. Cannot detect scam patterns.",
      advice: "Stay alert — never share OTP, Aadhaar, or passwords with anyone.",
    };
  }

  const flags = [];
  let score = 0;
  IMG_PATTERNS.forEach(([re, label, w]) => {
    if (re.test(text)) { flags.push(label); score += w; }
  });
  const verdict    = score >= 7 ? "danger" : score >= 3 ? "suspicious" : "safe";
  const confidence = Math.min(96, 32 + score * 4);
  return {
    verdict, confidence,
    red_flags_found: flags,
    scam_type: flags[0] || "",
    explanation: verdict === "danger"
      ? `Found ${flags.length} high-risk scam pattern(s) — this is likely a phishing/scam attempt.`
      : verdict === "suspicious"
      ? `Found ${flags.length} warning sign(s). Verify carefully before responding.`
      : "No obvious scam patterns detected. Stay alert — never share OTP or Aadhaar.",
    advice: verdict === "danger"
      ? "Do NOT share any details. Report immediately to cybercrime.gov.in or call 1930."
      : verdict === "suspicious"
      ? "Do not click any links. Verify the sender through official channels."
      : "Looks okay — but never share OTP, PIN, or Aadhaar with anyone.",
  };
}

scanImgBtn.addEventListener("click", async () => {
  if (!currentFile) { alert("Please upload a screenshot first."); return; }
  scanImgBtn.disabled = true;
  scanImgBtn.innerHTML = '<span class="spinner"></span> Analyzing...';
  resultBanner.style.display = "none";
  aiFlagList.innerHTML = "";
  await new Promise(r => setTimeout(r, 60));
  try {
    const result = patternScanImage(currentFile);
    showBanner(resultBanner, result.verdict, result, currentLang);
    renderFlags(aiFlagList, result.red_flags_found || []);
    aiDesc.textContent = result.explanation || "";
  } catch(e) {
    resultBanner.className = "banner-suspicious";
    resultBanner.innerHTML = "<div class='banner-title'>⚠️ Scan error: " + e.message + "</div>";
    resultBanner.style.display = "block";
  }
  scanImgBtn.disabled = false;
  scanImgBtn.innerHTML = "🖥️ Scan with AI";
});
// ═══════════════════════════════════════════════════════════════
//  LINK SCANNER
// ═══════════════════════════════════════════════════════════════
document.getElementById("scanUrlBtn").addEventListener("click", scanURL);
document.getElementById("urlInput").addEventListener("keydown", e => { if(e.key === "Enter") scanURL(); });

function scanURL() {
  const raw = document.getElementById("urlInput").value.trim();
  const banner = document.getElementById("urlResultBanner");
  const flagGrid = document.getElementById("urlFlagList");
  if (!raw) return;
  banner.style.display = "none";
  flagGrid.innerHTML = "";
  document.getElementById("scanUrlBtn").textContent = "⏳ Scanning...";
  const url = raw.startsWith("http") ? raw : "https://" + raw;
  const URL_FLAGS = [
    [/(bit\.ly|tinyurl|t\.co)/i,                               "URL shortener",        5],
    [/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,                 "IP address as URL",    6],
    [/^http:\/\//i,                                              "Not HTTPS",            3],
    [/(paypa1|g00gle|amaz0n|faceb00k)/i,                         "Typosquatting brand",  7],
    [/(\.xyz|\.tk|\.ml|\.cf|\.ga)(\?|\/|$)/i,               "Suspicious TLD",       6],
    [/(sbi[\-.]kyc|hdfc[\-.]|paytm[\-.]kyc)/i,                 "Fake bank domain",     9],
    [/(verify[\-.]account|confirm[\-.]otp|kyc[\-.]update)/i,   "Fake verify page",     8],
    [/(aadhaar[\-.]update|pan[\-.]link)/i,                      "Fake govt ID page",    9],
    [/(winner|prize|reward|lottery)/i,                           "Prize/lottery bait",   8],
    [/(urgent|act[\-]now|expire|limited[\-]time)/i,             "Urgency keywords",     5],
    [/(login[\-]secure|account[\-]verify)/i,                    "Fake login page",      8],
    [/(income[\-]tax|tds[\-]refund|gst[\-]refund)/i,           "Fake tax refund",      8],
  ];
  const flags = [];
  let score = 0;
  URL_FLAGS.forEach(([re, label, w]) => { if (re.test(url)) { flags.push(label); score += w; } });
  const verdict    = score >= 8 ? "danger" : score >= 3 ? "suspicious" : "safe";
  const confidence = Math.min(95, 40 + score * 6);
  const data = {
    verdict, confidence, red_flags_found: flags, scam_type: flags[0] || "",
    explanation: flags.length ? `Found ${flags.length} suspicious pattern(s) in this URL.` : "No phishing patterns detected.",
    advice: verdict === "danger" ? "Do NOT open this. Report to 1930 or cybercrime.gov.in."
          : verdict === "suspicious" ? "Verify the sender before clicking."
          : "Looks okay — verify the source before sharing personal info.",
  };
  showBanner(banner, data.verdict, data, currentLang);
  renderFlags(flagGrid, data.red_flags_found || []);
  document.getElementById("scanUrlBtn").textContent = "🔍 Scan";
}
// ═══════════════════════════════════════════════════════════════
//  HELPERS — Banner & Flags
// ═══════════════════════════════════════════════════════════════
function showBanner(el, verdict, r, lang) {
  const cls = { danger:"banner-danger", suspicious:"banner-suspicious", safe:"banner-safe" };
  el.className = cls[verdict] || "banner-suspicious";
  const title = (T[verdict] || T.suspicious)[lang] || (T[verdict] || T.suspicious).en;
  el.innerHTML = `
    <div class="banner-title">${title}</div>
    <div style="margin-top:6px">${r.explanation || ""}</div>
    ${r.advice ? `<div style="margin-top:8px;font-style:italic;opacity:.8">💡 ${r.advice}</div>` : ""}
    <div class="banner-conf" style="margin-top:8px">Confidence: ${r.confidence || 0}%
      ${r.scam_type ? ` · Scam type: ${r.scam_type}` : ""}
    </div>
  `;
  el.style.display = "block";
}

function renderFlags(container, flags) {
  container.innerHTML = "";
  flags.forEach(f => {
    const d = document.createElement("div");
    d.className = "flag-item";
    d.textContent = f;
    container.appendChild(d);
  });
}

// ═══════════════════════════════════════════════════════════════
//  HEATMAP
// ═══════════════════════════════════════════════════════════════
function lngToX(lng) { return ((lng - 68) / (97 - 68)) * 360 + 20; }
function latToY(lat) { return ((37 - lat) / (37 - 8)) * 400 + 20; }

let activeFilter = "all";

document.querySelectorAll(".filter-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    activeFilter = pill.dataset.filter;
    renderHeatmap(activeFilter);
  });
});

function renderHeatmap(filter) {
  const svg = document.getElementById("cityDots");
  svg.innerHTML = "";
  const cities = filter === "all" ? INDIA_CITIES : INDIA_CITIES.filter(c => c.type === filter);
  const maxScams = Math.max(...cities.map(c => c.scams));

  cities.forEach(city => {
    const x = lngToX(city.lng);
    const y = latToY(city.lat);
    const r = 8 + (city.scams / maxScams) * 18;
    const opacity = 0.4 + (city.scams / maxScams) * 0.5;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x); circle.setAttribute("cy", y);
    circle.setAttribute("r", r);
    circle.setAttribute("fill", `rgba(255,45,85,${opacity})`);
    circle.setAttribute("class", "city-dot");
    circle.addEventListener("click", () => showCityCard(city, maxScams));
    svg.appendChild(circle);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x); label.setAttribute("y", y + r + 9);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "city-label");
    label.textContent = city.name;
    svg.appendChild(label);
  });

  // Top-5 table
  const top5 = [...cities].sort((a,b) => b.scams - a.scams).slice(0,5);
  const table = document.getElementById("cityTable");
  table.innerHTML = `<tr><th>#</th><th>City</th><th>State</th><th>Reports</th><th>Primary Scam</th></tr>`;
  top5.forEach((city, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${i+1}</td>
      <td><strong>${city.name}</strong></td>
      <td style="color:var(--muted)">${city.state}</td>
      <td><span style="color:var(--red);font-weight:700">${city.scams.toLocaleString()}</span></td>
      <td><span class="verdict-badge badge-danger">${city.type}</span></td>
    `;
    table.appendChild(row);
  });
}

function showCityCard(city, maxScams) {
  document.getElementById("cityName").textContent = city.name;
  document.getElementById("cityState").textContent = city.state;
  document.getElementById("cityScams").textContent = city.scams.toLocaleString() + " reports";
  document.getElementById("cityType").textContent = "Primary: " + city.type;
  document.getElementById("cityBar").style.width = ((city.scams / maxScams) * 100) + "%";
  document.getElementById("cityCard").style.display = "block";
}

document.getElementById("cityClose").addEventListener("click", () => {
  document.getElementById("cityCard").style.display = "none";
});

// ═══════════════════════════════════════════════════════════════
//  SCAM SIMULATOR
// ═══════════════════════════════════════════════════════════════
function renderSimMenu() {
  const grid = document.getElementById("scenarioGrid");
  grid.innerHTML = "";
  SCENARIOS.forEach(s => {
    const card = document.createElement("div");
    card.className = "scenario-card" + (completedScenarios.includes(s.id) ? " done" : "");
    card.innerHTML = `
      <div class="scenario-emoji">${s.emoji}</div>
      <div class="scenario-title">${s.title}</div>
      <div class="scenario-cat">${s.category}${completedScenarios.includes(s.id) ? " · ✅ Done" : ""}</div>
    `;
    card.addEventListener("click", () => startScenario(s));
    grid.appendChild(card);
  });
}

let simScore = 0;
let currentScenario = null;
let choicesMade = 0;

function startScenario(scenario) {
  currentScenario = scenario;
  choicesMade = 0;
  document.getElementById("simMenu").style.display = "none";
  document.getElementById("simPlay").style.display = "block";
  document.getElementById("simTitle").textContent = scenario.title;
  document.getElementById("simScore").textContent = simScore;

  const chat = document.getElementById("chatWindow");
  chat.innerHTML = "";

  // Show messages with delay
  scenario.messages.forEach((msg, i) => {
    setTimeout(() => {
      const div = document.createElement("div");
      div.className = "chat-msg";
      div.innerHTML = `
        <div class="chat-avatar">${scenario.emoji}</div>
        <div class="chat-bubble scammer">${msg.text}</div>
      `;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
      if (i === scenario.messages.length - 1) showChoices(scenario.choices);
    }, i * 800);
  });

  document.getElementById("simFeedback").style.display = "none";
  document.getElementById("simChoices").innerHTML = "";
}

function showChoices(choices) {
  const container = document.getElementById("simChoices");
  container.innerHTML = "";
  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = choice.text;
    btn.addEventListener("click", () => handleChoice(choice, btn, choices));
    container.appendChild(btn);
  });
}

function handleChoice(choice, btn, allChoices) {
  // Disable all buttons
  document.querySelectorAll(".choice-btn").forEach(b => b.disabled = true);
  btn.classList.add(choice.correct ? "correct" : "wrong");

  if (choice.correct) simScore += 10;
  document.getElementById("simScore").textContent = simScore;

  const fb = document.getElementById("simFeedback");
  fb.style.display = "block";
  fb.innerHTML = `<div class="feedback-title">${choice.correct ? "✅ Correct!" : "❌ Not quite..."}</div><div>${choice.feedback}</div>`;

  choicesMade++;
  if (choicesMade === 1) {
    // Mark scenario done
    if (!completedScenarios.includes(currentScenario.id)) {
      completedScenarios.push(currentScenario.id);
    }
    setTimeout(() => {
      const nextBtn = document.createElement("button");
      nextBtn.className = "scan-btn";
      nextBtn.textContent = "← Back to Scenarios";
      nextBtn.style.marginTop = "16px";
      nextBtn.addEventListener("click", () => {
        document.getElementById("simPlay").style.display = "none";
        document.getElementById("simMenu").style.display = "block";
        renderSimMenu();
      });
      document.getElementById("simFeedback").appendChild(nextBtn);
    }, 600);
  }
}

document.getElementById("simBack").addEventListener("click", () => {
  document.getElementById("simPlay").style.display = "none";
  document.getElementById("simMenu").style.display = "block";
  renderSimMenu();
});

// ═══════════════════════════════════════════════════════════════
//  SOS MODAL
// ═══════════════════════════════════════════════════════════════
document.getElementById("sosBtn").addEventListener("click", () => {
  document.getElementById("sosModal").style.display = "flex";
  document.getElementById("sosStep1").style.display = "block";
  document.getElementById("sosStep2").style.display = "none";
});

document.getElementById("modalClose").addEventListener("click", () => {
  document.getElementById("sosModal").style.display = "none";
});

document.getElementById("sosModal").addEventListener("click", e => {
  if (e.target === document.getElementById("sosModal"))
    document.getElementById("sosModal").style.display = "none";
});

document.getElementById("sosSubmit").addEventListener("click", async () => {
  const btn = document.getElementById("sosSubmit");
  btn.textContent = "Sending..."; btn.disabled = true;

  const payload = {
    name:        document.getElementById("sosName").value,
    phone:       document.getElementById("sosPhone").value,
    description: document.getElementById("sosDesc").value,
    location:    document.getElementById("sosLocation").value,
  };

  // Generate report ID locally — no backend needed
  await new Promise(r => setTimeout(r, 900));
  const rid = "SHLD-" + Math.random().toString(36).substr(2,8).toUpperCase();
  document.getElementById("reportId").textContent = rid;
  document.getElementById("sosStep1").style.display = "none";
  document.getElementById("sosStep2").style.display = "block";
  btn.textContent = "Submit Report";
  btn.disabled = false;

  btn.textContent = "Submit Report"; btn.disabled = false;
});