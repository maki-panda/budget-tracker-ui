import './style.css';
import Chart from 'chart.js/auto';
import { 
    SaveTransaction, 
    GetTransactions, 
    UpdateTransaction, 
    DeleteTransaction, 
    SaveBudget, 
    GetBudget 
} from '../wailsjs/go/main/App';

// 차트 객체 전역 관리
let categoryChart: any = null;
let paymentChart: any = null;
let trendChart: any = null;

// --- [공용] 이번 달 데이터 필터링 헬퍼 ---
function getThisMonthData(data: any[]) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return data.filter(t => t.date.startsWith(currentMonth));
}

window.addEventListener('load', async () => {
    const app = document.querySelector('#app');
    if (!app) return;

    app.innerHTML = `
        <div class="dashboard-container">
            <nav class="sidebar">
                <div class="sidebar-logo">Budget Tracker</div>
                <div class="nav-group">
                    <div class="nav-item active" id="menu-dashboard">
                        <span class="nav-icon">📊</span> 대시보드
                    </div>
                    <div class="nav-item" id="menu-budget">
                        <span class="nav-icon">🎯</span> 예산 설정
                    </div>
                </div>
                <div class="nav-group bottom">
                    <div class="nav-item"><span class="nav-icon">⚙️</span> 설정</div>
                </div>
            </nav>

            <main id="view-dashboard" class="main-content">
                <section class="stats-panel">
                    <header class="summary-card">
                        <span class="label">TOTAL AMOUNT</span>
                        <span class="total-amount" id="total-amount">0 원</span>
                    </header>
                    <div class="chart-card">
                        <h4>카테고리별 비중</h4>
                        <div class="chart-container"><canvas id="categoryChart"></canvas></div>
                    </div>
                    <div class="chart-card">
                        <h4>결제 수단별 현황</h4>
                        <div class="chart-container"><canvas id="paymentChart"></canvas></div>
                    </div>
                    <div class="chart-card" style="grid-column: span 2;">
                        <h4>일별 지출 추이</h4>
                        <div class="chart-container"><canvas id="trendChart"></canvas></div>
                    </div>
                    <div class="chart-card">
                        <h4>지출 Top 5 내역</h4>
                        <div id="ranking-list" class="chart-container" style="overflow-y: auto;"></div>
                    </div>
                    <div class="chart-card" style="height: auto; min-height: 300px;">
                        <h4>카테고리별 예산 사용률</h4>
                        <div id="dashboard-budget-usage-list" class="budget-usage-container"></div>
                    </div>
                </section>
                <section class="list-panel">
                    <div class="list-header">RECENT ACTIVITY</div>
                    <div id="log-list" class="log-scroll"></div>
                    <button id="open-modal-btn" class="floating-btn">+</button>
                </section>
            </main>

            <main id="view-budget" class="main-content" style="display:none; flex-direction:column;">
                <div id="budget-view-content"></div>
            </main>

            <div id="input-modal" class="modal-overlay" style="display: none;">
                <div class="modal-content" style="padding-top: 20px;">
                    <h3 id="modal-title" style="margin-top: 0;">NEW RECORD</h3>
                    <div class="input-group">
                        <input type="hidden" id="edit-id"> 
                        <input type="date" id="date" class="app-input">
                        <select id="category-select" class="custom-select"></select>
                        <input type="text" id="category-custom" placeholder="새 카테고리명" class="app-input" style="display:none;">
                        <select id="sub-category-select" class="custom-select"></select>
                        <input type="text" id="sub-category-custom" placeholder="새 소분류명" class="app-input" style="display:none;">
                        <select id="payment-select" class="custom-select"></select>
                        <input type="text" id="payment-custom" placeholder="결제 수단 직접 입력" class="app-input" style="display:none;">
                        <input type="text" id="description" placeholder="상세 내역" class="app-input">
                        <input type="number" id="amount" placeholder="금액 입력" class="app-input primary">
                    </div>
                    <div class="modal-btns">
                        <button id="close-modal-btn" class="btn btn-secondary">CLOSE</button>
                        <button id="save-btn" class="btn btn-primary">SAVE</button>
                    </div>
                </div>
            </div>

            <div id="delete-modal" class="modal-overlay" style="display: none;">
                <div class="modal-content" style="text-align: center;">
                    <h3 style="color: #ff3b30;">DELETE RECORD</h3>
                    <p style="margin: 20px 0; color: #8e8e93;">이 기록을 정말 삭제하시겠습니까?</p>
                    <input type="hidden" id="delete-id">
                    <div class="modal-btns">
                        <button id="close-delete-btn" class="btn btn-secondary">CANCEL</button>
                        <button id="confirm-delete-btn" class="btn" style="background-color: #ff3b30; color: white;">DELETE</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupNavigation();
    setupEventListeners();
    await updateList();
});

function setupNavigation() {
    const btnDashboard = document.getElementById('menu-dashboard');
    const btnBudget = document.getElementById('menu-budget');
    const viewDashboard = document.getElementById('view-dashboard') as HTMLElement;
    const viewBudget = document.getElementById('view-budget') as HTMLElement;

    btnDashboard?.addEventListener('click', async () => {
        btnDashboard.classList.add('active');
        btnBudget?.classList.remove('active');
        viewDashboard.style.display = 'flex';
        viewBudget.style.display = 'none';
        await updateList();
    });

    btnBudget?.addEventListener('click', async () => {
        btnBudget.classList.add('active');
        btnDashboard?.classList.remove('active');
        viewDashboard.style.display = 'none';
        viewBudget.style.display = 'flex';
        await renderBudgetSettings();
    });
}

async function renderUsageWidget(transactions: any[], targetId: string) {
    const listContainer = document.getElementById(targetId);
    if (!listContainer) return;

    const budgetData = await GetBudget();
    const thisMonthData = getThisMonthData(transactions);
    
    const spendingMap: { [key: string]: number } = {};
    thisMonthData.forEach((t: any) => {
        spendingMap[t.category] = (spendingMap[t.category] || 0) + (Number(t.amount) || 0);
    });

    const allCategories = new Set([
        ...Object.keys(budgetData.categories || {}),
        ...Object.keys(spendingMap)
    ]);

    if (allCategories.size === 0) {
        listContainer.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:40px; font-size:13px;">데이터가 없습니다.</div>`;
        return;
    }

    listContainer.innerHTML = Array.from(allCategories).map(cat => {
        const budget = budgetData.categories?.[cat] || 0;
        const spent = spendingMap[cat] || 0;
        const diff = budget - spent;
        
        let percent = 0;
        let displayPercent = "";

        if (budget > 0) {
            percent = (spent / budget) * 100;
            displayPercent = (percent < 1 && percent > 0) ? percent.toFixed(1) + "%" : Math.round(percent).toLocaleString() + "%";
        } else {
            if (spent > 0) {
                percent = 100;
                displayPercent = spent.toLocaleString() + "%"; 
            } else {
                percent = 0;
                displayPercent = "0%";
            }
        }

        const barWidth = Math.min(percent, 100);
        const isOverLimit = budget === 0 ? spent > 0 : percent >= 100;
        let statusClass = isOverLimit ? 'status-danger' : (percent >= 80 ? 'status-warning' : 'status-safe');

        return `
            <div class="usage-item" style="margin-bottom: 18px;">
                <div class="usage-info">
                    <span class="usage-label" style="font-weight:700;">${cat}</span>
                    <span class="usage-percent" style="font-weight:800; color:${isOverLimit ? '#ff3b30' : 'inherit'}">
                        ${displayPercent}
                    </span>
                </div>
                <div class="progress-bar-bg" style="height: 8px; background: #eee; border-radius: 4px; overflow: hidden; margin: 6px 0;">
                    <div class="progress-bar-fill ${statusClass}" style="width: ${barWidth}%; height:100%; transition: width 0.5s ease;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                    <span style="color:#888;">${spent.toLocaleString()} / ${budget.toLocaleString()}원</span>
                    <span style="font-weight:700; color:${diff > 0 ? '#007aff' : '#ff3b30'}">
                        ${diff > 0 ? formatComma(diff) + '원 남음' : (diff === 0 && budget > 0 ? '딱 맞음' : formatComma(Math.abs(diff)) + '원 초과')}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

async function renderBudgetSettings() {
    const viewContent = document.getElementById('budget-view-content');
    if (!viewContent) return;

    const data = await GetTransactions() || [];
    const budgetData = await GetBudget();

    viewContent.innerHTML = `
        <div class="budget-sticky-header">
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:12px;">
                <h2 style="font-weight:800; margin:0; font-size: 20px; color:#1c1c1e;">🎯 예산 관리</h2>
                <button id="save-budgets-btn" style="font-size: 16px;">저장</button>
            </div>
            <div style="background: #ffffff; padding:14px 20px; border-radius:14px; border: 1px solid #f2f2f7; display:flex; align-items:center; justify-content:space-between; box-shadow: 0 2px 8px rgba(0,0,0,0.02); margin-bottom:20px;">
                <span style="font-size: 12px; color: #8e8e93; font-weight: 600;">TOTAL BUDGET</span>
                <div style="display:flex; align-items:center; gap:4px;">
                    <input type="text" id="total-budget-input" 
                        oninput="window.handleInputComma(this)"
                        style="border:none; color:#007aff; font-size: 22px; font-weight:800; width:150px; text-align:right; outline:none; background:transparent;" placeholder="0">
                    <span style="font-size:15px; font-weight:700; color:#1c1c1e;">원</span>
                </div>
            </div>
        </div>

        <div class="budget-split-container">
            <div class="budget-settings-left">
                <h4 style="margin:0 0 20px 0; font-size:15px; color:#1c1c1e; font-weight:700;">카테고리별 예산</h4>
                <div id="budget-category-list"></div>
            </div>
            <div class="budget-status-right">
                <h4 style="margin:0 0 20px 0; font-size:15px; color:#1c1c1e; font-weight:700;">지출 현황</h4>
                <div id="side-budget-usage-list"></div>
            </div>
        </div>
    `;

    const container = document.getElementById('budget-category-list');
    const structure: { [key: string]: Set<string> } = {};
    data.forEach((t: any) => {
        if (!structure[t.category]) structure[t.category] = new Set();
        if (t.sub_category) structure[t.category].add(t.sub_category);
    });

    const categories = Object.keys(structure);
    const arrowSvg = `<svg class="arrow-icon" style="width:14px; height:14px; color:#c7c7cc;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

    if (container) {
        container.innerHTML = categories.map(cat => {
            const subCats = Array.from(structure[cat]);
            const savedCatVal = formatComma(budgetData.categories?.[cat] || "");
            return `
                <div class="budget-group">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px;">
                        <div style="cursor:pointer; display:flex; align-items:center; gap:6px; flex:1;" onclick="window.toggleAccordion(this)">
                            ${subCats.length > 0 ? arrowSvg : '<div style="width:14px;"></div>'}
                            <span style="font-weight:700; font-size:14px; color:#3a3a3c;">${cat}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <input type="text" class="main-cat-input" data-category="${cat}" 
                                oninput="window.handleInputComma(this)"
                                style="width:100px; border:none; text-align:right; font-weight:700; font-size:15px; color:#007aff; outline:none; background:transparent;" 
                                placeholder="0" value="${savedCatVal}"> 
                            <span style="color:#8e8e93; font-size:12px;">원</span>
                        </div>
                    </div>
                    <div class="sub-budget-list"> 
                        ${subCats.map(sub => {
                            const savedSubVal = formatComma(budgetData.subCategories?.[cat]?.[sub] || "");
                            return `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 16px 6px 36px;">
                                    <span style="font-size:12px; color:#8e8e93;">└ ${sub}</span>
                                    <div style="display:flex; align-items:center; gap:4px;">
                                        <input type="text" class="sub-budget-input" data-parent="${cat}" data-sub="${sub}" 
                                               oninput="window.handleInputComma(this)"
                                               style="width:80px; border:none; background:transparent; text-align:right; font-size:12px; color:#3a3a3c; outline:none;" 
                                               placeholder="0" value="${savedSubVal}">
                                        <span style="color:#c7c7cc; font-size:10px;">원</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    const totalInput = document.getElementById('total-budget-input') as HTMLInputElement;
    if (totalInput) totalInput.value = formatComma(budgetData.total || "");
    await renderUsageWidget(data, 'side-budget-usage-list');

    document.getElementById('save-budgets-btn')?.addEventListener('click', async () => {
        const total = parseNum((document.getElementById('total-budget-input') as HTMLInputElement).value);
        const catBudgets: any = {};
        const subBudgets: any = {};
        document.querySelectorAll('.main-cat-input').forEach((el: any) => {
            catBudgets[(el as any).dataset.category] = parseNum((el as any).value);
        });
        document.querySelectorAll('.sub-budget-input').forEach((el: any) => {
            const p = (el as any).dataset.parent, s = (el as any).dataset.sub, v = parseNum((el as any).value);
            if (v > 0) { if (!subBudgets[p]) subBudgets[p] = {}; subBudgets[p][s] = v; }
        });
        await SaveBudget(total, catBudgets, subBudgets);
        alert("🎯 예산이 저장되었습니다.");
        await renderUsageWidget(data, 'side-budget-usage-list');
    });
}

async function updateList() {
    const listArea = document.getElementById('log-list');
    const totalElement = document.getElementById('total-amount');
    if (!listArea) return;

    try {
        const data = await GetTransactions() || [];
        updateSelectOptions(data);

        const thisMonthData = getThisMonthData(data);
        const totalSpending = thisMonthData.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        
        // "(이번 달)" 제거
        if (totalElement) totalElement.innerText = `${totalSpending.toLocaleString()} 원`;

        renderCharts(data); 
        renderRanking(thisMonthData);
        await renderUsageWidget(data, 'dashboard-budget-usage-list');

        if (data.length === 0) {
            listArea.innerHTML = `<div style="text-align:center; padding:50px; color:#666;">내역이 없습니다.</div>`;
            return;
        }

        listArea.innerHTML = data.map((t: any) => `
            <div class="log-card" onclick="window.editItem(${JSON.stringify(t).replace(/"/g, '&quot;')})">
                <div class="card-content">
                    <div class="card-info">
                        <span class="card-date">${t.date}</span>
                        <span class="card-description">${t.description || '내역 없음'}</span>
                        <div class="category-badges" style="margin-top:5px;">
                            <span class="badge" style="background-color: ${t.color || '#8E8E93'} !important;">${t.category}</span>
                            <span class="badge sub-cat">${t.sub_category || '-'}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <div style="text-align: right;">
                            <span class="pay-method" style="display:block; margin-bottom:2px;">${t.payment || '미지정'}</span>
                            <span class="card-amount">${(Number(t.amount) || 0).toLocaleString()} 원</span>
                        </div>
                        <button onclick="event.stopPropagation(); window.deleteItem(${t.id})" class="delete-btn-mini">×</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

function renderCharts(data: any[]) {
    if (!data || data.length === 0) return;
    Chart.defaults.color = '#8e8e93';
    Chart.defaults.font.size = 11;

    const catMap = data.reduce((acc: any, t: any) => {
        const cat = t.category || '기타';
        if (!acc[cat]) acc[cat] = { amount: 0, color: t.color || '#8E8E93' };
        acc[cat].amount += (Number(t.amount) || 0);
        return acc;
    }, {});

    const catLabels = Object.keys(catMap);
    const ctx1 = document.getElementById('categoryChart') as HTMLCanvasElement;
    if (ctx1) {
        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: catLabels,
                datasets: [{
                    data: catLabels.map(l => catMap[l].amount),
                    backgroundColor: catLabels.map(l => catMap[l].color),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { position: 'right', labels: { boxWidth: 8, padding: 10, usePointStyle: true } } }
            }
        });
    }

    const payMap = data.reduce((acc: any, t: any) => {
        const pay = t.payment || '미지정';
        acc[pay] = (acc[pay] || 0) + (Number(t.amount) || 0);
        return acc;
    }, {});

    const ctx2 = document.getElementById('paymentChart') as HTMLCanvasElement;
    if (ctx2) {
        if (paymentChart) paymentChart.destroy();
        paymentChart = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: Object.keys(payMap),
                datasets: [{
                    label: '금액',
                    data: Object.values(payMap),
                    backgroundColor: '#007aff',
                    borderRadius: 5,
                    barThickness: 15
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { grid: { display: false } } }
            }
        });
    }

    const trendMap = data.reduce((acc: any, t: any) => {
        acc[t.date] = (acc[t.date] || 0) + (Number(t.amount) || 0);
        return acc;
    }, {});
    const sortedDates = Object.keys(trendMap).sort();

    const ctx3 = document.getElementById('trendChart') as HTMLCanvasElement;
    if (ctx3) {
        if (trendChart) trendChart.destroy();
        trendChart = new Chart(ctx3, {
            type: 'line',
            data: {
                labels: sortedDates,
                datasets: [{
                    data: sortedDates.map(d => trendMap[d]),
                    borderColor: '#007aff',
                    borderWidth: 3,
                    fill: true,
                    backgroundColor: 'rgba(0,122,255,0.05)',
                    tension: 0.4,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { maxTicksLimit: 5 } } }
            }
        });
    }
}

function renderRanking(data: any[]) {
    const rankEl = document.getElementById('ranking-list');
    if (!rankEl) return;
    const categorySum = data.reduce((acc: any, t: any) => {
        const cat = t.category || '기타';
        if (!acc[cat]) acc[cat] = { amount: 0, color: t.color || '#8E8E93' };
        acc[cat].amount += (Number(t.amount) || 0);
        return acc;
    }, {});

    const sorted = Object.entries(categorySum)
        .map(([name, info]: any) => ({ name, ...info }))
        .filter((item: any) => item.amount > 0)
        .sort((a: any, b: any) => b.amount - a.amount)
        .slice(0, 5);

    if (sorted.length === 0) {
        // "이번 달" 문구 제거
        rankEl.innerHTML = `<div style="color:#8e8e93; text-align:center; padding-top:40px; font-size:13px;">기록이 없습니다.</div>`;
        return;
    }

    rankEl.innerHTML = sorted.map((item: any, i: number) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #f2f2f7;">
            <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
                <span style="font-weight:800; color:#007aff; flex-shrink:0; width:15px;">${i + 1}</span>
                <div style="width:8px; height:8px; border-radius:50%; background-color:${item.color}; flex-shrink:0;"></div>
                <span style="font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</span>
            </div>
            <span style="font-weight:700; font-size:13px; flex-shrink:0; margin-left:10px;">${item.amount.toLocaleString()}원</span>
        </div>
    `).join('');
}

function setupEventListeners() {
    const inputModal = document.getElementById('input-modal') as HTMLElement;
    const deleteModal = document.getElementById('delete-modal') as HTMLElement;

    document.getElementById('open-modal-btn')?.addEventListener('click', () => {
        (document.getElementById('modal-title') as HTMLElement).innerText = "NEW RECORD";
        (document.getElementById('edit-id') as HTMLInputElement).value = "";
        resetInputs();
        inputModal.style.display = 'flex';
    });

    document.getElementById('close-modal-btn')?.addEventListener('click', () => inputModal.style.display = 'none');
    document.getElementById('close-delete-btn')?.addEventListener('click', () => deleteModal.style.display = 'none');

    const bindToggle = (sId: string, cId: string) => {
        const s = document.getElementById(sId) as HTMLSelectElement;
        const c = document.getElementById(cId) as HTMLInputElement;
        s?.addEventListener('change', () => {
            c.style.display = s.value === 'custom' ? 'block' : 'none';
            if (s.value === 'custom') { c.value = ""; c.focus(); }
        });
    };
    bindToggle('category-select', 'category-custom');
    bindToggle('sub-category-select', 'sub-category-custom');
    bindToggle('payment-select', 'payment-custom');

    document.getElementById('save-btn')?.addEventListener('click', handleSave);
    document.getElementById('confirm-delete-btn')?.addEventListener('click', handleConfirmDelete);
}

async function handleSave() {
    const editId = (document.getElementById('edit-id') as HTMLInputElement).value;
    const date = (document.getElementById('date') as HTMLInputElement).value;
    const amount = parseInt((document.getElementById('amount') as HTMLInputElement).value);
    const description = (document.getElementById('description') as HTMLInputElement).value;

    const getVal = (sId: string, cId: string) => {
        const s = document.getElementById(sId) as HTMLSelectElement;
        return s.value === 'custom' ? (document.getElementById(cId) as HTMLInputElement).value : s.value;
    };

    const category = getVal('category-select', 'category-custom');
    const subCategory = getVal('sub-category-select', 'sub-category-custom');
    const payment = getVal('payment-select', 'payment-custom');

    if (!date || !category || isNaN(amount)) return alert("필수 항목을 입력하세요.");

    try {
        if (editId) {
            await UpdateTransaction(parseInt(editId), date, category, subCategory, payment, description, amount);
        } else {
            await SaveTransaction(date, category, subCategory, payment, description, amount);
        }
        (document.getElementById('input-modal') as HTMLElement).style.display = 'none';
        await updateList();
    } catch (err) { alert(err); }
}

async function handleConfirmDelete() {
    const id = (document.getElementById('delete-id') as HTMLInputElement).value;
    if (!id) return;
    try {
        await DeleteTransaction(parseInt(id));
        (document.getElementById('delete-modal') as HTMLElement).style.display = 'none';
        await updateList();
    } catch (err) { alert("삭제 실패: " + err); }
}

function updateSelectOptions(data: any[]) {
    const render = (id: string, key: string, label: string) => {
        const select = document.getElementById(id) as HTMLSelectElement;
        if (!select) return;
        const currentVal = select.value;
        const items = [...new Set(data.map(t => t[key]))].filter(Boolean);
        select.innerHTML = `<option value="">${label}</option>` + 
                            items.map(i => `<option value="${i}">${i}</option>`).join('') +
                            `<option value="custom">+ 직접 입력</option>`;
        if (Array.from(select.options).some(opt => opt.value === currentVal)) select.value = currentVal;
    };
    render('category-select', 'category', '카테고리 선택');
    render('sub-category-select', 'sub_category', '소분류 선택');
    render('payment-select', 'payment', '결제 수단 선택');
}

function resetInputs() {
    (document.getElementById('date') as HTMLInputElement).value = new Date().toISOString().split('T')[0];
    ['category-select', 'sub-category-select', 'payment-select'].forEach(id => {
        const el = document.getElementById(id) as HTMLSelectElement;
        if (el) el.value = "";
    });
    ['category-custom', 'sub-category-custom', 'payment-custom'].forEach(id => {
        const el = document.getElementById(id) as HTMLElement;
        if (el) { el.style.display = 'none'; (el as HTMLInputElement).value = ""; }
    });
    (document.getElementById('description') as HTMLInputElement).value = "";
    (document.getElementById('amount') as HTMLInputElement).value = "";
}

// 창 전역 함수 등록
(window as any).editItem = (t: any) => {
    (document.getElementById('modal-title') as HTMLElement).innerText = "EDIT RECORD";
    (document.getElementById('edit-id') as HTMLInputElement).value = t.id;
    (document.getElementById('date') as HTMLInputElement).value = t.date;
    (document.getElementById('amount') as HTMLInputElement).value = t.amount;
    (document.getElementById('description') as HTMLInputElement).value = t.description || "";

    const setVal = (sId: string, cId: string, val: string) => {
        const s = document.getElementById(sId) as HTMLSelectElement;
        const c = document.getElementById(cId) as HTMLInputElement;
        const options = Array.from(s.options).map(o => o.value);
        if (options.includes(val)) { s.value = val; c.style.display = 'none'; }
        else if (val) { s.value = 'custom'; c.value = val; c.style.display = 'block'; }
        else { s.value = ""; c.style.display = 'none'; }
    };
    setVal('category-select', 'category-custom', t.category);
    setVal('sub-category-select', 'sub-category-custom', t.sub_category);
    setVal('payment-select', 'payment-custom', t.payment);
    (document.getElementById('input-modal') as HTMLElement).style.display = 'flex';
};

(window as any).deleteItem = (id: number) => {
    (document.getElementById('delete-id') as HTMLInputElement).value = id.toString();
    (document.getElementById('delete-modal') as HTMLElement).style.display = 'flex';
};

(window as any).toggleAccordion = (el: HTMLElement) => {
    const group = el.closest('.budget-group') as HTMLElement;
    const content = group.querySelector('.sub-budget-list') as HTMLElement;
    const arrow = el.querySelector('.arrow-icon');
    
    // 클래스 기반 토글 (CSS 애니메이션 작동)
    const isOpen = content.classList.contains('open');
    
    if (isOpen) {
        content.classList.remove('open');
        arrow?.classList.remove('rotate');
    } else {
        content.classList.add('open');
        arrow?.classList.add('rotate');
        
        // 부드럽게 스크롤 이동
        setTimeout(() => { 
            group.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); 
        }, 300);
    }
};

const formatComma = (n: string | number) => {
    const num = n.toString().replace(/\D/g, "");
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const parseNum = (s: string) => parseInt(s.replace(/,/g, "")) || 0;

(window as any).handleInputComma = (el: HTMLInputElement) => {
    const pos = el.selectionStart;
    const prevLen = el.value.length;
    el.value = formatComma(el.value);
    const newPos = pos ? pos + (el.value.length - prevLen) : 0;
    el.setSelectionRange(newPos, newPos);
};