/* ================================
   CONFIG
================================ */
const API_BASE = "https://api.coingecko.com/api/v3";
const BACKEND_BASE = window.BACKEND_BASE || "https://btcguru.onrender.com";
const BACKEND_API = `${BACKEND_BASE}/api`;

/* ================================
   STATE
================================ */
let mining = false;
let charts = {};
let selectedCoin = "bitcoin";
let selectedDays = 7; // default 7D

/* ================================
   DOM ELEMENTS
================================ */
const authSection = document.querySelector(".auth-section");
const minerBox = document.getElementById("minerBox");
const walletBalanceEl = document.getElementById("walletBalance");
const hashRateEl = document.getElementById("minerHash");
const accruedEl = document.getElementById("minerAccrued");

const startBtn = document.getElementById("startMinerBtn");
const stopBtn = document.getElementById("stopMinerBtn");
const claimBtn = document.getElementById("claimMinerBtn");

const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const coinButtonsContainer = document.getElementById("cryptoButtons");
const chartCanvas = document.getElementById("priceChart");
const timeframeButtons = document.querySelectorAll(".tf-btn");

/* ================================
   API HELPER
================================ */
async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${BACKEND_API}${path}`, {
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    ...options
  });

  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch { err = {}; }
    throw new Error(err.error || "API request failed");
  }

  return res.json();
}

/* ================================
   AUTH
================================ */
async function handleAuth(email, password, type) {
  try {
    const data = await api(`/auth/${type}`, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem("token", data.token);
    showDashboard();
  } catch (err) {
    alert(err.message);
  }
}

registerBtn?.addEventListener("click", () => {
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;
  handleAuth(email, password, "register");
});

loginBtn?.addEventListener("click", () => {
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;
  handleAuth(email, password, "login");
});

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("token");
  location.reload();
});

/* ================================
   UI STATE
================================ */
function showDashboard() {
  authSection.style.display = "none";
  minerBox.style.display = "block";
  logoutBtn.style.display = "inline-block";
  refreshMinerStatus();
  loadCoinData();
}

/* ================================
   MINER
================================ */
function toggleMiningUI(active) {
  startBtn.disabled = active;
  stopBtn.disabled = !active;
}

async function refreshMinerStatus() {
  try {
    const data = await api("/miner/status");
    walletBalanceEl.textContent = data.wallet.balance.toFixed(8);
    hashRateEl.textContent = data.miner.hash_rate;
    accruedEl.textContent = data.accrued.toFixed(8);
    mining = data.miner.is_active;
    toggleMiningUI(mining);
  } catch (err) { console.error(err.message); }
}

startBtn?.addEventListener("click", async () => {
  await api("/miner/start", { method: "POST" });
  mining = true;
  toggleMiningUI(true);
});

stopBtn?.addEventListener("click", async () => {
  const data = await api("/miner/stop", { method: "POST" });
  accruedEl.textContent = data.accrued.toFixed(8);
  mining = false;
  toggleMiningUI(false);
});

claimBtn?.addEventListener("click", async () => {
  await api("/miner/claim", { method: "POST" });
  refreshMinerStatus();
});

/* ================================
   COIN DATA
================================ */
// Sample function to reduce points and avoid lag
function sampleData(arr, maxPoints = 50) {
  const step = Math.ceil(arr.length / maxPoints);
  return arr.filter((_, i) => i % step === 0);
}

async function loadCoinData() {
  try {
    const prices = await fetch(
      `${API_BASE}/coins/${selectedCoin}/market_chart?vs_currency=usd&days=${selectedDays}`
    ).then(r => r.json());

    let labels = prices.prices.map(p => new Date(p[0]).toLocaleDateString());
    let values = prices.prices.map(p => p[1]);

    labels = sampleData(labels, 50);
    values = sampleData(values, 50);

    renderChart(labels, values);
  } catch (err) {
    console.error("Error loading coin data:", err);
  }
}

/* Coin selection (dynamic buttons) */
function createCoinButtons(coins = ["bitcoin","ethereum","dogecoin"]) {
  coinButtonsContainer.innerHTML = "";
  coins.forEach(c => {
    const btn = document.createElement("button");
    btn.textContent = c.toUpperCase();
    btn.classList.add("crypto-btn");
    if(c === selectedCoin) btn.classList.add("active");
    btn.addEventListener("click", () => {
      selectedCoin = c;
      coinButtonsContainer.querySelectorAll(".crypto-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadCoinData();
    });
    coinButtonsContainer.appendChild(btn);
  });
}

/* ================================
   TIMEFRAME BUTTONS
================================ */
timeframeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    selectedDays = btn.dataset.days;
    timeframeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    loadCoinData();
  });
});

/* ================================
   CHARTS
================================ */
function renderChart(labels, data) {
  if (charts.price) charts.price.destroy();

  charts.price = new Chart(chartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [{ label: "Price (USD)", data, tension: 0.3 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 }
    }
  });
}

/* ================================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  createCoinButtons(); // init coin buttons

  if (token) {
    try {
      await api("/ping");
      showDashboard();
    } catch {
      localStorage.removeItem("token");
    }
  }
});
