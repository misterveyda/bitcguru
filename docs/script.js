/* ================================
   CONFIG
================================ */
const API_BASE = "https://api.coingecko.com/api/v3";

// Runtime backend injection (GitHub Pages friendly)
const BACKEND_BASE =
  (typeof window !== "undefined" &&
    (window.BACKEND_BASE || window.__BACKEND_BASE__)) ||
  "https://bitcguru.onrender.com";

const BACKEND_API = `${BACKEND_BASE}/api`;

/* ================================
   STATE
================================ */
let mining = false;
let charts = {};
let selectedCoin = "bitcoin";

/* ================================
   DOM ELEMENTS
================================ */
const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const walletBalanceEl = document.getElementById("wallet-balance");
const hashRateEl = document.getElementById("hash-rate");
const accruedEl = document.getElementById("accrued");

const startBtn = document.getElementById("start-mining");
const stopBtn = document.getElementById("stop-mining");
const claimBtn = document.getElementById("claim-rewards");

const coinSelect = document.getElementById("coin-select");
const chartCanvas = document.getElementById("price-chart");

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
    let err;
    try {
      err = await res.json();
    } catch {
      err = {};
    }
    throw new Error(err.error || "API request failed");
  }

  return res.json();
}

/* ================================
   AUTH
================================ */
async function handleAuth(e, type) {
  e.preventDefault();

  const email = e.target.email.value;
  const password = e.target.password.value;

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

loginForm?.addEventListener("submit", e => handleAuth(e, "login"));
registerForm?.addEventListener("submit", e => handleAuth(e, "register"));

function logout() {
  localStorage.removeItem("token");
  location.reload();
}

/* ================================
   UI STATE
================================ */
function showDashboard() {
  authSection.style.display = "none";
  dashboardSection.style.display = "block";
  refreshMinerStatus();
  loadCoinData();
}

function toggleMiningUI(active) {
  startBtn.disabled = active;
  stopBtn.disabled = !active;
}

/* ================================
   MINER
================================ */
async function refreshMinerStatus() {
  try {
    const data = await api("/miner/status");

    walletBalanceEl.textContent = data.wallet.balance.toFixed(8);
    hashRateEl.textContent = data.miner.hash_rate;
    accruedEl.textContent = data.accrued.toFixed(8);

    mining = data.miner.is_active;
    toggleMiningUI(mining);
  } catch (err) {
    console.error(err.message);
  }
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
   COINGECKO DATA
================================ */
async function loadCoinData() {
  const prices = await fetch(
    `${API_BASE}/coins/${selectedCoin}/market_chart?vs_currency=usd&days=7`
  ).then(r => r.json());

  const labels = prices.prices.map(p =>
    new Date(p[0]).toLocaleDateString()
  );
  const values = prices.prices.map(p => p[1]);

  renderChart(labels, values);
}

coinSelect?.addEventListener("change", e => {
  selectedCoin = e.target.value;
  loadCoinData();
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
      datasets: [
        {
          label: "Price (USD)",
          data,
          tension: 0.3
        }
      ]
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
      logout();
    }
  }
});
