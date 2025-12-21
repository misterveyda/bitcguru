/* ================================
   CONFIG
================================ */
const BACKEND_BASE = window.BACKEND_BASE || "https://btcguru.onrender.com";
const BACKEND_API = `${BACKEND_BASE}/api`;
const API_COINGECKO = "https://api.coingecko.com/api/v3";

/* ================================
   STATE
================================ */
let mining = false;
let selectedCoin = "bitcoin";
let charts = {};

/* ================================
   DOM ELEMENTS
================================ */
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const authSection = document.getElementById("authSection");
const dashboard = document.getElementById("dashboard");
const minerBox = document.getElementById("minerBox");

const walletBalanceEl = document.getElementById("walletBalance");
const minerHashEl = document.getElementById("minerHash");
const minerAccruedEl = document.getElementById("minerAccrued");

const startMinerBtn = document.getElementById("startMinerBtn");
const stopMinerBtn = document.getElementById("stopMinerBtn");
const claimMinerBtn = document.getElementById("claimMinerBtn");

const coinSelect = document.getElementById("coinSelect");
const chartCanvas = document.getElementById("priceChart");

/* ================================
   API HELPER
================================ */
async function api(path, options = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BACKEND_API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` })
    },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "API request failed");
  }
  return res.json();
}

/* ================================
   AUTH
================================ */
async function handleAuth(type) {
  const email = emailInput.value;
  const password = passwordInput.value;

  if (!email || !password) return alert("Enter email & password");

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

registerBtn.addEventListener("click", () => handleAuth("register"));
loginBtn.addEventListener("click", () => handleAuth("login"));
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("token");
  location.reload();
});

/* ================================
   DASHBOARD
================================ */
function showDashboard() {
  authSection.style.display = "none";
  dashboard.style.display = "block";
  minerBox.style.display = "block";
  logoutBtn.style.display = "inline-block";
  refreshMinerStatus();
  loadCoinData();
}

function toggleMiningUI(active) {
  startMinerBtn.disabled = active;
  stopMinerBtn.disabled = !active;
}

/* ================================
   MINER
================================ */
async function refreshMinerStatus() {
  try {
    const data = await api("/miner/status");
    walletBalanceEl.textContent = data.wallet.balance.toFixed(8);
    minerHashEl.textContent = data.miner.hash_rate;
    minerAccruedEl.textContent = data.accrued.toFixed(8);
    mining = data.miner.is_active;
    toggleMiningUI(mining);
  } catch (err) {
    console.error(err.message);
  }
}

startMinerBtn.addEventListener("click", async () => {
  await api("/miner/start", { method: "POST" });
  mining = true;
  toggleMiningUI(true);
});

stopMinerBtn.addEventListener("click", async () => {
  const data = await api("/miner/stop", { method: "POST" });
  minerAccruedEl.textContent = data.accrued.toFixed(8);
  mining = false;
  toggleMiningUI(false);
});

claimMinerBtn.addEventListener("click", async () => {
  await api("/miner/claim", { method: "POST" });
  refreshMinerStatus();
});

/* ================================
   COINGECKO
================================ */
async function loadCoinData() {
  try {
    const res = await fetch(`${API_COINGECKO}/coins/${selectedCoin}/market_chart?vs_currency=usd&days=7`);
    const prices = await res.json();

    const labels = prices.prices.map(p => new Date(p[0]).toLocaleDateString());
    const data = prices.prices.map(p => p[1]);

    renderChart(labels, data);
  } catch (err) {
    console.error("CoinGecko fetch error:", err.message);
  }
}

coinSelect.addEventListener("change", e => {
  selectedCoin = e.target.value;
  loadCoinData();
});

/* ================================
   CHART
================================ */
function renderChart(labels, data) {
  if (charts.price) charts.price.destroy();
  charts.price = new Chart(chartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `${selectedCoin} Price (USD)`,
        data,
        borderColor: "#ffd700",
        backgroundColor: "rgba(255, 215, 0, 0.2)",
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

/* ================================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      await api("/ping");
      showDashboard();
    } catch {
      localStorage.removeItem("token");
    }
  }
});
