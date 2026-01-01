import './style.css';
import Chart from 'chart.js/auto';
import { SaveTransaction, GetTransactions, UpdateTransaction, DeleteTransaction } from '../wailsjs/go/main/App';

// 차트 객체 관리
let categoryChart: any = null;
let paymentChart: any = null;
let trendChart: any = null;

window.addEventListener('load', async () => {
    const app = document.querySelector('#app');
    if (!app) return;

    app.innerHTML = `
        <div class="dashboard-container">
            <section class="stats-panel">
                <header class="summary-card">
                    <span class="label">MONTHLY TOTAL</span>
                    <span class="total-amount" id="total-amount">0 원</span>
                </header>

                <div class="chart-card">
                    <h4>카테고리별 비중</h4>
                    <div class="chart-container">
                        <canvas id="categoryChart"></canvas>
                    </div>
                </div>
                
                <div class="chart-card">
                    <h4>결제 수단별 현황</h4>
                    <div class="chart-container">
                        <canvas id="paymentChart"></canvas>
                    </div>
                </div>

                <div class="chart-card" style="grid-column: span 2;">
                    <h4>일별 지출 추이</h4>
                    <div class="chart-container">
                        <canvas id="trendChart"></canvas>
                    </div>
                </div>
                
                <div class="chart-card">
                    <h4>지출 Top 5 내역</h4>
                    <div id="ranking-list" class="chart-container" style="overflow-y: auto;">
                        <div style="color:#ccc; text-align:center; padding-top:40px;">데이터를 불러오는 중...</div>
                    </div>
                </div>

                <div class="chart-card">
                    <h4>예산 사용률</h4>
                    <div id="budget-info" style="display:flex; flex-direction:column; justify-content:center; height:100%; text-align:center;">
                        <div style="font-size: 24px; font-weight:800; color:var(--accent-blue);" id="budget-percent">0%</div>
                        <div style="font-size: 12px; color:var(--text-muted); margin-top:5px;">권장 예산 대비</div>
                    </div>
                </div>
            </section>

            <section class="list-panel">
                <div class="list-header">RECENT ACTIVITY</div>
                <main id="log-list" class="log-scroll"></main>
                <button id="open-modal-btn" class="floating-btn">+</button>
            </section>

            <div id="input-modal" class="modal-overlay" style="display: none;">
                <div class="modal-content">
                    <h3 id="modal-title">NEW RECORD</h3>
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

    setupEventListeners();
    await updateList();
});

// --- 리스트 및 차트 업데이트 로직 ---
async function updateList() {
    const listArea = document.getElementById('log-list');
    const totalElement = document.getElementById('total-amount');
    if (!listArea) return;

    try {
        const data = await GetTransactions() || [];
        updateSelectOptions(data);

        const total = data.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        if (totalElement) totalElement.innerText = `${total.toLocaleString()} 원`;

        // 모든 시각화 함수 호출
        renderCharts(data);
        renderRanking(data);
        renderBudget(total);

        if (data.length === 0) {
            listArea.innerHTML = `<div style="text-align:center; padding:50px; color:#666;">내역이 없습니다.</div>`;
            return;
        }

        listArea.innerHTML = data.map((t: any) => `
            <div class="log-card" onclick="window.editItem(${JSON.stringify(t).replace(/"/g, '&quot;')})">
                <div class="card-edge" style="background-color: ${t.color || '#8E8E93'} !important;"></div>
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

    // 1. 카테고리별 비중
    const catMap = data.reduce((acc: { [key: string]: number }, t: any) => {
        const cat = t.category || '기타';
        acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0);
        return acc;
    }, {});

    const ctx1 = document.getElementById('categoryChart') as HTMLCanvasElement;
    if (ctx1) {
        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: Object.keys(catMap),
                datasets: [{
                    data: Object.values(catMap),
                    backgroundColor: ['#007aff', '#34c759', '#ff9500', '#ff2d55', '#5856d6', '#af52de'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { position: 'right', labels: { boxWidth: 8, padding: 10 } } }
            }
        });
    }

    // 2. 결제 수단별 현황
    const payMap = data.reduce((acc: { [key: string]: number }, t: any) => {
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
                scales: {
                    x: { display: false },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    // 3. 일별 지출 추이
    const trendMap = data.reduce((acc: { [key: string]: number }, t: any) => {
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
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, ticks: { maxTicksLimit: 5 } }
                }
            }
        });
    }
}

function renderRanking(data: any[]) {
    // 1. 요소 찾기
    const rankEl = document.getElementById('ranking-list');
    if (!rankEl) {
        console.error("ranking-list 요소를 찾을 수 없습니다.");
        return;
    }

    // 2. 데이터 정렬 (숫자 변환 확실히)
    const sorted = [...data]
        .filter(t => t.amount > 0)
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 5);

    // 3. 데이터가 없을 때 처리
    if (sorted.length === 0) {
        rankEl.innerHTML = `<div style="color:#8e8e93; text-align:center; padding-top:40px; font-size:13px;">기록이 없습니다.</div>`;
        return;
    }

    // 4. HTML 생성 및 삽입
    rankEl.innerHTML = sorted.map((t, i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #f2f2f7;">
            <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
                <span style="font-weight:800; color:var(--accent-blue); flex-shrink:0;">${i + 1}</span>
                <span style="font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${t.description || t.category}
                </span>
            </div>
            <span style="font-weight:700; font-size:13px; flex-shrink:0; margin-left:10px;">
                ${Number(t.amount).toLocaleString()}원
            </span>
        </div>
    `).join('');
}

function renderBudget(total: number) {
    const el = document.getElementById('budget-percent');
    if (!el) return;
    const mockBudget = 2000000; 
    const percent = Math.round((total / mockBudget) * 100);
    el.innerText = `${percent}%`;
    el.style.color = percent > 100 ? 'var(--danger-red)' : 'var(--accent-blue)';
}

// --- 이벤트 리스너 및 기존 헬퍼 함수 (그대로 유지) ---
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