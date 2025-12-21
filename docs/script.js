const BACKEND_BASE = window.BACKEND_BASE || "https://btcguru.onrender.com";
const BACKEND_API = `${BACKEND_BASE}/api`;

let mining = false;
let charts = {};
let selectedCoin = "bitcoin";

/* ====================
   DOM ELEMENTS
==================== */
const authSection = document.getElementById("authSection");
const dashboard = document.getElementById("dashboard");

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");

const walletBalanceEl = document.getElementById("walletBalance");
const hashRateEl = document.getElementById("minerHash");
const accruedEl = document.getElementById("minerAccrued");

const startBtn = document.getElementById("startMinerBtn");
const stopBtn = document.getElementById("stopMinerBtn");
const claimBtn = document.getElementById("claimMinerBtn");

const cryptoButtonsEl = document.getElementById("cryptoButtons");
const chartCanvas = document.getElementById("priceChart");

/* ====================
   API HELPER
==================== */
async function api(path, options = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BACKEND_API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` })
    },
    ...options
  });
  if (!res.ok) throw new Error("API request failed");
  return res.json();
}

/* ====================
   AUTH HANDLERS
==================== */
async function handleAuth(type) {
  const email = emailInput.value;
  const password = passwordInput.value;

  loginBtn.classList.add("loading-btn");
  registerBtn.classList.add("loading-btn");

  try {
    const data = await api(`/auth/${type}`, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem("token", data.token);
    showDashboard();
  } catch (err) {
    alert(err.message);
  } finally {
    loginBtn.classList.remove("loading-btn");
    registerBtn.classList.remove("loading-btn");
  }
}

loginBtn.addEventListener("click", () => handleAuth("login"));
registerBtn.addEventListener("click", () => handleAuth("register"));

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("token");
  location.reload();
});

/* ====================
   DASHBOARD UI
==================== */
function showDashboard() {
  authSection.style.display = "none";
  dashboard.classList.add("show");

  logoutBtn.style.display = "inline-block";
  refreshMinerStatus();
  loadCoinButtons();
  loadCoinData();
}

/* ====================
   MINER
==================== */
async function refreshMinerStatus() {
  try {
    const data = await api("/miner/status");
    walletBalanceEl.textContent = data.wallet.balance.toFixed(8);
    hashRateEl.textContent = data.miner.hash_rate;
    accruedEl.textContent = data.accrued.toFixed(8);

    mining = data.miner.is_active;
    startBtn.disabled = mining;
    stopBtn.disabled = !mining;
  } catch (err) {
    console.error(err.message);
  }
}

startBtn.addEventListener("click", async () => {
  startBtn.classList.add("loading-btn");
  await api("/miner/start", { method: "POST" });
  mining = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  startBtn.classList.remove("loading-btn");
});

stopBtn.addEventListener("click", async () => {
  stopBtn.classList.add("loading-btn");
  const data = await api("/miner/stop", { method: "POST" });
  accruedEl.textContent = data.accrued.toFixed(8);
  mining = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  stopBtn.classList.remove("loading-btn");
});

claimBtn.addEventListener("click", async () => {
  claimBtn.classList.add("loading-btn");
  await api("/miner/claim", { method: "POST" });
  refreshMinerStatus();
  claimBtn.classList.remove("loading-btn");
});

/* ====================
   COIN BUTTONS
==================== */
const topCoins = ["bitcoin", "ethereum", "litecoin", "ripple", "dogecoin"];
function loadCoinButtons() {
  cryptoButtonsEl.innerHTML = "";
  topCoins.forEach(coin => {
    const btn = document.createElement("button");
    btn.textContent = coin;
    btn.classList.add("crypto-btn");
    if (coin === selectedCoin) btn.classList.add("active");
    btn.addEventListener("click", () => {
      selectedCoin = coin;
      document.querySelectorAll(".crypto-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadCoinData();
    });
    cryptoButtonsEl.appendChild(btn);
  });
}

/* ====================
   COIN DATA & CHART
==================== */
async function loadCoinData() {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${selectedCoin}/market_chart?vs_currency=usd&days=7`
  ).then(r => r.json());

  // Sample every 3rd point to reduce lag
  const sampled = res.prices.filter((_, i) => i % 3 === 0);

  const labels = sampled.map(p => new Date(p[0]).toLocaleDateString());
  const values = sampled.map(p => p[1]);

  renderChart(labels, values);
}

function renderChart(labels, data) {
  if (charts.price) charts.price.destroy();
  charts.price = new Chart(chartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Price (USD)",
          data,
          tension: 0.3,
          borderColor: "#ffd700",
          backgroundColor: "rgba(255, 215, 0, 0.2)",
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 0
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 10
          }
        }
      }
    }
  });
}

/* ====================
   INIT
==================== */
document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      await api("/ping");
      showDashboard();
    } catch {
      logoutBtn.click();
    }
  }
});
