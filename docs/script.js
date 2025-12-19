// Cleaned, single-scope enhanced script for the Crypto Miner Monitor
// Top 5 cryptocurrencies to track
const TOP_5_CRYPTOS = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', emoji: '₿' },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', emoji: '◆' },
    { id: 'ripple', symbol: 'XRP', name: 'Ripple', emoji: '✕' },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano', emoji: '◇' },
    { id: 'solana', symbol: 'SOL', name: 'Solana', emoji: '◎' }
];

const API_BASE = 'https://api.coingecko.com/api/v3';
let selectedCrypto = null;
let cryptoData = {};
let autoRefreshInterval = null;
let priceChart = null;
let currentDays = 7;

// Initialize the app once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeCryptoButtons();
    loadCryptoData();
    setupRefreshButton();
    setupAutoRefresh();
    setupTimeframeButtons();
    setupAnalyzeButton();
    createEmptyChart();
});

// Create crypto selection buttons
function initializeCryptoButtons() {
    const cryptoButtons = document.getElementById('cryptoButtons');
    cryptoButtons.innerHTML = '';

    TOP_5_CRYPTOS.forEach(crypto => {
        const btn = document.createElement('button');
        btn.className = 'crypto-btn';
        btn.innerHTML = `
            <span class="crypto-name">${crypto.emoji} ${crypto.name}</span>
            <span class="crypto-symbol">${crypto.symbol}</span>
            <span class="crypto-price" id="price-${crypto.id}">Loading...</span>
        `;
        btn.addEventListener('click', (e) => selectCrypto(crypto, e));
        cryptoButtons.appendChild(btn);
    });
}

// Fetch crypto data from CoinGecko API
async function loadCryptoData() {
    const cryptoIds = TOP_5_CRYPTOS.map(c => c.id).join(',');
    
    try {
        const response = await fetch(
            `${API_BASE}/simple/price?ids=${cryptoIds}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
        );
        
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        cryptoData = data;
        
        // Update button prices
        TOP_5_CRYPTOS.forEach(crypto => {
            const price = data[crypto.id]?.usd || 0;
            const priceEl = document.getElementById(`price-${crypto.id}`);
            if (priceEl) {
                priceEl.textContent = `$${formatPrice(price)}`;
            }
        });

        // Update last update time
        updateLastUpdateTime();

        // If a crypto is selected, update its details
        if (selectedCrypto) {
            updateCryptoDetails(selectedCrypto);
            await loadHistoricalData(selectedCrypto.id, currentDays);
        }
    } catch (error) {
        console.error('Error loading crypto data:', error);
        showError('Failed to load cryptocurrency data');
    }
}

// Fetch additional details for a specific crypto
async function loadCryptoDetails(cryptoId) {
    try {
        const response = await fetch(
            `${API_BASE}/coins/${cryptoId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false`
        );
        
        if (!response.ok) throw new Error('Failed to fetch details');
        
        return await response.json();
    } catch (error) {
        console.error('Error loading crypto details:', error);
        showError(`Failed to load details for ${cryptoId}`);
        return null;
    }
}

// Select a cryptocurrency to view details
async function selectCrypto(crypto, event) {
    selectedCrypto = crypto;
    
    // Update button states
    document.querySelectorAll('.crypto-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const btn = event.currentTarget;
    if (btn) btn.classList.add('active');
    
    // Load and display details
    const details = await loadCryptoDetails(crypto.id);
    if (details) {
        updateCryptoDetails(crypto, details);
    }

    // load historical prices for chart
    await loadHistoricalData(crypto.id, currentDays);
}

// Update crypto details display
function updateCryptoDetails(crypto, details = null) {
    const detailsCard = document.getElementById('detailsCard');
    const basicData = cryptoData[crypto.id] || {};

    if (!details) {
        // Use basic data only
        const price = basicData.usd || 0;
        const marketCap = basicData.usd_market_cap || 0;
        const volume24h = basicData.usd_24h_vol || 0;
        const change24h = basicData.usd_24h_change || 0;

        detailsCard.innerHTML = `
            <div class="details-content">
                <div class="detail-item">
                    <div class="detail-label">Current Price</div>
                    <div class="detail-value">$${formatPrice(price)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Market Cap</div>
                    <div class="detail-value">$${formatLargeNumber(marketCap)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">24h Volume</div>
                    <div class="detail-value">$${formatLargeNumber(volume24h)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">24h Change</div>
                    <div class="detail-value">
                        <span class="detail-change ${change24h >= 0 ? 'positive' : 'negative'}">
                            ${change24h >= 0 ? '📈' : '📉'} ${change24h.toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        updateMarketStats(crypto.id);
        updateChartDisplay(crypto.id, change24h);
        return;
    }

    // Use full details
    const price = details.market_data?.current_price?.usd || 0;
    const ath = details.market_data?.ath?.usd || 0;
    const atl = details.market_data?.atl?.usd || 0;
    const marketCap = details.market_data?.market_cap?.usd || 0;
    const volume24h = details.market_data?.total_volume?.usd || 0;
    const change24h = details.market_data?.price_change_percentage_24h || 0;
    const change7d = details.market_data?.price_change_percentage_7d || 0;
    const change30d = details.market_data?.price_change_percentage_30d || 0;
    const dominance = details.market_data?.market_cap_change_percentage_24h || 0;

    detailsCard.innerHTML = `
        <div class="details-content">
            <div class="detail-item">
                <div class="detail-label">Current Price</div>
                <div class="detail-value">$${formatPrice(price)}</div>
                <div class="detail-change ${change24h >= 0 ? 'positive' : 'negative'}">
                    ${change24h >= 0 ? '📈' : '📉'} ${change24h.toFixed(2)}%
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Market Cap</div>
                <div class="detail-value">$${formatLargeNumber(marketCap)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">24h Volume</div>
                <div class="detail-value">$${formatLargeNumber(volume24h)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">All-Time High</div>
                <div class="detail-value">$${formatPrice(ath)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">All-Time Low</div>
                <div class="detail-value">$${formatPrice(atl)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">7d Change</div>
                <div class="detail-value">
                    <span class="detail-change ${change7d >= 0 ? 'positive' : 'negative'}">
                        ${change7d.toFixed(2)}%
                    </span>
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-label">30d Change</div>
                <div class="detail-value">
                    <span class="detail-change ${change30d >= 0 ? 'positive' : 'negative'}">
                        ${change30d.toFixed(2)}%
                    </span>
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Market Dominance Change</div>
                <div class="detail-value">
                    <span class="detail-change ${dominance >= 0 ? 'positive' : 'negative'}">
                        ${dominance.toFixed(2)}%
                    </span>
                </div>
            </div>
        </div>
    `;

    updateMarketStats(crypto.id, details);
    updateChartDisplay(crypto.id, change24h, change7d, change30d);
}

// Update market overview stats
function updateMarketStats(cryptoId, details = null) {
    const statsGrid = document.getElementById('statsGrid');
    const basicData = cryptoData[cryptoId] || {};

    let html = '';

    if (details) {
        const marketData = details.market_data || {};
        const communityScore = details.community_data?.twitter_followers || 0;
        const sentiment = details.sentiment_votes_up_percentage || 0;

        html = `
            <div class="stat-box">
                <div class="stat-label">Circulating Supply</div>
                <div class="stat-value">${formatLargeNumber(marketData.circulating_supply)}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Total Supply</div>
                <div class="stat-value">${formatLargeNumber(marketData.total_supply)}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Max Supply</div>
                <div class="stat-value">${marketData.max_supply ? formatLargeNumber(marketData.max_supply) : 'Unlimited'}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Market Cap Rank</div>
                <div class="stat-value">#${details.market_cap_rank || 'N/A'}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Genesis Date</div>
                <div class="stat-value">${details.genesis_date ? new Date(details.genesis_date).getFullYear() : 'N/A'}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Community Score</div>
                <div class="stat-value">${communityScore ? Math.min(100, Math.floor(communityScore / 10000)) : 'N/A'}%</div>
            </div>
        `;
    } else {
        html = `
            <div class="stat-box">
                <div class="stat-label">Price (USD)</div>
                <div class="stat-value">$${formatPrice(basicData.usd || 0)}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Market Cap</div>
                <div class="stat-value">$${formatLargeNumber(basicData.usd_market_cap || 0)}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">24h Volume</div>
                <div class="stat-value">$${formatLargeNumber(basicData.usd_24h_vol || 0)}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">24h Change</div>
                <div class="stat-value">${(basicData.usd_24h_change || 0).toFixed(2)}%</div>
            </div>
        `;
    }

    statsGrid.innerHTML = html;
}

// Update chart display with price changes (small summary bars)
function updateChartDisplay(cryptoId, change24h, change7d = 0, change30d = 0) {
    const chartContainer = document.getElementById('chartContainer');
    const changes = [
        { label: '24h', value: change24h },
        { label: '7d', value: change7d || change24h },
        { label: '30d', value: change30d || change24h }
    ];

    const maxAbsChange = Math.max(...changes.map(c => Math.abs(c.value)));
    const scale = maxAbsChange > 0 ? 100 / maxAbsChange : 100;

    chartContainer.innerHTML = changes.map(change => {
        const height = Math.min(100, Math.abs(change.value) * scale);
        const isPositive = change.value >= 0;
        
        return `
            <div class="chart-bar">
                <div class="chart-bar-fill ${isPositive ? 'positive' : 'negative'}" style="height: ${height}%"></div>
                <div class="chart-label">
                    ${change.label}: ${change.value.toFixed(2)}%
                </div>
            </div>
        `;
    }).join('');
}

// Create an empty Chart.js line chart
function createEmptyChart() {
    const canvas = document.getElementById('priceChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Price (USD)',
                data: [],
                borderColor: '#ffd700',
                backgroundColor: 'rgba(255,215,0,0.08)',
                pointRadius: 0,
                fill: true,
                tension: 0.15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true },
                y: { display: true }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Load historical price data for chart
async function loadHistoricalData(cryptoId, days = 7) {
    try {
        const resp = await fetch(`${API_BASE}/coins/${cryptoId}/market_chart?vs_currency=usd&days=${days}`);
        if (!resp.ok) throw new Error('Failed to fetch historical prices');
        const json = await resp.json();
        const prices = json.prices || [];
        updateChartWithHistory(prices, days);
    } catch (err) {
        console.error('Historical data error', err);
    }
}

// Update Chart.js with historical prices
function updateChartWithHistory(prices, days) {
    if (!priceChart) return;
    const labels = prices.map(p => new Date(p[0]).toLocaleDateString());
    const data = prices.map(p => p[1]);

    priceChart.data.labels = labels;
    priceChart.data.datasets[0].data = data;
    priceChart.update();
}

// Setup timeframe buttons
function setupTimeframeButtons() {
    document.querySelectorAll('.tf-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentDays = parseInt(e.currentTarget.dataset.days, 10) || 7;
            if (selectedCrypto) await loadHistoricalData(selectedCrypto.id, currentDays);
        });
    });
}

// Setup analyze button
    function setupAnalyzeButton() {
        const analyzeBtn = document.getElementById('analyzeBtn');
        analyzeBtn.addEventListener('click', async () => {
            if (!selectedCrypto) {
                showTempMessage('Select a cryptocurrency before analyzing.');
                return;
            }
            analyzeCrypto(selectedCrypto.id, currentDays);
        });
    }

// --- Auth UI wiring ---
function setupAuthUI() {
    const email = document.getElementById('emailInput');
    const pass = document.getElementById('passwordInput');
    const registerBtn = document.getElementById('registerBtn');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const msg = document.getElementById('authMessage');
    const minerBox = document.getElementById('minerBox');
    const walletBalance = document.getElementById('walletBalance');
    const minerAccrued = document.getElementById('minerAccrued');
    const minerHash = document.getElementById('minerHash');
    const minerMessage = document.getElementById('minerMessage');
    const startMinerBtn = document.getElementById('startMinerBtn');
    const stopMinerBtn = document.getElementById('stopMinerBtn');
    const claimMinerBtn = document.getElementById('claimMinerBtn');

    registerBtn.addEventListener('click', async () => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.value, password: pass.value })
        });
        const json = await res.json();
        if (res.ok) {
            localStorage.setItem('token', json.token);
            msg.textContent = 'Registered and logged in';
            loginState(true);
            refreshMinerStatus();
        } else {
            msg.textContent = json.error || 'Register failed';
        }
    });

    loginBtn.addEventListener('click', async () => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.value, password: pass.value })
        });
        const json = await res.json();
        if (res.ok) {
            localStorage.setItem('token', json.token);
            msg.textContent = 'Logged in';
            loginState(true);
            refreshMinerStatus();
        } else {
            msg.textContent = json.error || 'Login failed';
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        loginState(false);
        msg.textContent = 'Logged out';
    });

    function loginState(loggedIn) {
        if (loggedIn) {
            registerBtn.style.display = 'none';
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'inline-block';
            if (minerBox) minerBox.style.display = 'block';
        } else {
            registerBtn.style.display = '';
            loginBtn.style.display = '';
            logoutBtn.style.display = 'none';
            if (minerBox) minerBox.style.display = 'none';
        }
    }

    // init state
    loginState(!!localStorage.getItem('token'));

    // miner actions wiring
    if (startMinerBtn) startMinerBtn.addEventListener('click', async () => {
        startMinerBtn.disabled = true;
        await startMiner();
        startMinerBtn.disabled = false;
    });
    if (stopMinerBtn) stopMinerBtn.addEventListener('click', async () => {
        stopMinerBtn.disabled = true;
        await stopMiner();
        stopMinerBtn.disabled = false;
    });
    if (claimMinerBtn) claimMinerBtn.addEventListener('click', async () => {
        claimMinerBtn.disabled = true;
        await claimMiner();
        claimMinerBtn.disabled = false;
    });
}

// call setupAuthUI after DOM ready
document.addEventListener('DOMContentLoaded', () => setupAuthUI());

// --- Miner client functions ---
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function refreshMinerStatus() {
    try {
        const res = await fetch('/api/miner/status', { headers: getAuthHeaders() });
        if (!res.ok) return;
        const json = await res.json();
        updateMinerUI(json);
    } catch (err) {
        console.error('Miner status error', err);
    }
}

function updateMinerUI(status) {
    const minerBox = document.getElementById('minerBox');
    if (!minerBox) return;
    const walletBalance = document.getElementById('walletBalance');
    const minerAccrued = document.getElementById('minerAccrued');
    const minerHash = document.getElementById('minerHash');
    const minerMessage = document.getElementById('minerMessage');

    const wallet = status.wallet || { balance: 0 };
    const miner = status.miner || { hash_rate: 1, is_active: false };
    const accrued = status.accrued || 0;

    walletBalance.textContent = Number(wallet.balance || 0).toFixed(6);
    minerAccrued.textContent = Number(accrued || 0).toFixed(6);
    minerHash.textContent = Number(miner.hash_rate || 1).toFixed(2);
    minerMessage.textContent = miner.is_active ? 'Miner running' : 'Miner stopped';

    // show miner box
    minerBox.style.display = 'block';
}

async function startMiner() {
    try {
        const res = await fetch('/api/miner/start', { method: 'POST', headers: getAuthHeaders() });
        if (!res.ok) {
            const j = await res.json();
            document.getElementById('minerMessage').textContent = j.error || 'Failed to start';
            return;
        }
        document.getElementById('minerMessage').textContent = 'Miner started';
        await refreshMinerStatus();
    } catch (err) {
        console.error(err);
    }
}

async function stopMiner() {
    try {
        const res = await fetch('/api/miner/stop', { method: 'POST', headers: getAuthHeaders() });
        const j = await res.json();
        if (!res.ok) {
            document.getElementById('minerMessage').textContent = j.error || 'Failed to stop';
            return;
        }
        document.getElementById('minerMessage').textContent = `Stopped — accrued ${Number(j.accrued || 0).toFixed(6)}`;
        await refreshMinerStatus();
    } catch (err) {
        console.error(err);
    }
}

async function claimMiner() {
    try {
        const res = await fetch('/api/miner/claim', { method: 'POST', headers: getAuthHeaders() });
        const j = await res.json();
        if (!res.ok) {
            document.getElementById('minerMessage').textContent = j.error || 'Claim failed';
            return;
        }
        document.getElementById('minerMessage').textContent = `Claimed ${Number(j.accrued || 0).toFixed(6)}`;
        await refreshMinerStatus();
    } catch (err) {
        console.error(err);
    }
}

    // Analyze crypto: volatility, avg return, max drawdown
    async function analyzeCrypto(cryptoId, days = 7) {
        try {
            const resp = await fetch(`${API_BASE}/coins/${cryptoId}/market_chart?vs_currency=usd&days=${days}`);
            if (!resp.ok) throw new Error('Failed to fetch historical prices for analysis');
            const json = await resp.json();
            const prices = (json.prices || []).map(p => p[1]);
            if (prices.length < 2) {
                showTempMessage('Not enough data to analyze.');
                return;
            }

            // compute daily returns
            const returns = [];
            for (let i = 0; i < prices.length - 1; i++) {
                returns.push((prices[i+1] / prices[i]) - 1);
            }

            const avgReturn = mean(returns);
            const stdDev = stdev(returns);
            const maxDD = maxDrawdown(prices);

            const resultsDiv = document.getElementById('analysisResults');
            resultsDiv.innerHTML = `
                <div class="analysis-item"><strong>Timeframe:</strong> ${days} days</div>
                <div class="analysis-item"><strong>Average Return:</strong> ${(avgReturn * 100).toFixed(2)}%</div>
                <div class="analysis-item"><strong>Volatility (std dev):</strong> ${(stdDev * 100).toFixed(2)}%</div>
                <div class="analysis-item"><strong>Max Drawdown:</strong> ${(maxDD * 100).toFixed(2)}%</div>
            `;

        } catch (err) {
            console.error('Analyze error', err);
            showTempMessage('Analysis failed.');
        }
    }

    // Utilities: mean, stdev, max drawdown
    function mean(arr) {
        if (!arr.length) return 0;
        return arr.reduce((s, v) => s + v, 0) / arr.length;
    }

    function stdev(arr) {
        if (!arr.length) return 0;
        const m = mean(arr);
        const variance = arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length;
        return Math.sqrt(variance);
    }

    function maxDrawdown(prices) {
        let peak = prices[0];
        let maxDD = 0;
        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > peak) peak = prices[i];
            const dd = (peak - prices[i]) / peak;
            if (dd > maxDD) maxDD = dd;
        }
        return maxDD;
    }

    function showTempMessage(msg) {
        const resultsDiv = document.getElementById('analysisResults');
        resultsDiv.innerHTML = `<div class="analysis-item">${msg}</div>`;
        setTimeout(() => { resultsDiv.innerHTML = ''; }, 4000);
    }

    // Format price for display
    function formatPrice(price) {
        if (price >= 1) {
            return price.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
        } else if (price > 0) {
            return price.toLocaleString('en-US', { maximumFractionDigits: 8, minimumFractionDigits: 2 });
        }
        return '0.00';
    }

    // Format large numbers for display
    function formatLargeNumber(num) {
        if (!num && num !== 0) return '0';
    
        if (num >= 1_000_000_000) {
            return (num / 1_000_000_000).toFixed(2) + 'B';
        } else if (num >= 1_000_000) {
            return (num / 1_000_000).toFixed(2) + 'M';
        } else if (num >= 1_000) {
            return (num / 1_000).toFixed(2) + 'K';
        }
        return Number(num).toFixed(2);
    }

    // Update last update timestamp
    function updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        document.getElementById('lastUpdate').textContent = `Last updated: ${timeString}`;
    }

    // Setup refresh button
    function setupRefreshButton() {
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="loading"></span> Refreshing...';
        
            await loadCryptoData();
        
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '🔄 Refresh Data';
        });
    }

    // Setup auto-refresh every 30 seconds
    function setupAutoRefresh() {
        autoRefreshInterval = setInterval(() => {
            loadCryptoData();
        }, 30000); // 30 seconds
    }

    // Show error message
    function showError(message) {
        const detailsCard = document.getElementById('detailsCard');
        detailsCard.innerHTML = `<div class="placeholder" style="color: #ff4444;">${message}</div>`;
    }

    // Cleanup on page unload
    window.addEventListener('unload', () => {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    });
