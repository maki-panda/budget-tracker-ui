import './style.css';
import { SaveTransaction, GetTransactions, UpdateTransaction, DeleteTransaction } from '../wailsjs/go/main/App';

// 초기 로드
window.addEventListener('load', async () => {
    const app = document.querySelector('#app');
    if (!app) return;

    app.innerHTML = `
        <div class="dashboard-container">
            <header class="dashboard-header">
                <div class="summary-card">
                    <span class="label">MONTHLY TOTAL</span>
                    <span class="total-amount" id="total-amount">0 원</span>
                </div>
                <div style="color: var(--text-muted); font-size: 13px; font-weight: 600; padding: 0 5px 10px;">RECENT ACTIVITY</div>
            </header>

            <main id="log-list" class="log-scroll">
            </main>

            <button id="open-modal-btn" class="floating-btn">+</button>

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

    window.addEventListener('click', (e) => {
        if (e.target === inputModal) inputModal.style.display = 'none';
        if (e.target === deleteModal) deleteModal.style.display = 'none';
    });

    // 💡 직접 입력 토글 로직 수정 (결제수단 포함)
    const bindToggle = (sId: string, cId: string) => {
        const s = document.getElementById(sId) as HTMLSelectElement;
        const c = document.getElementById(cId) as HTMLInputElement;
        s.addEventListener('change', () => {
            c.style.display = s.value === 'custom' ? 'block' : 'none';
            if (s.value === 'custom') {
                c.value = "";
                c.focus();
            }
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

async function updateList() {
    const listArea = document.getElementById('log-list');
    const totalElement = document.getElementById('total-amount');
    if (!listArea) return;

    try {
        const data = await GetTransactions();
        updateSelectOptions(data || []);

        const total = data?.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0;
        if (totalElement) totalElement.innerText = `${total.toLocaleString()} 원`;

        if (!data || data.length === 0) {
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
                        <div class="category-badges">
                            <span class="badge" style="background-color: ${t.color || '#8E8E93'} !important;">${t.category}</span>
                            <span class="badge sub-cat">${t.sub_category || '-'}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <div class="right-section">
                            <span class="pay-method">${t.payment || '미지정'}</span>
                            <span class="card-amount">${(t.amount || 0).toLocaleString()} 원</span>
                        </div>
                        <button onclick="event.stopPropagation(); window.deleteItem(${t.id})" class="delete-btn-mini">×</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

function updateSelectOptions(data: any[]) {
    const render = (id: string, key: string, label: string) => {
        const select = document.getElementById(id) as HTMLSelectElement;
        const currentVal = select.value;
        const items = [...new Set(data.map(t => t[key]))].filter(Boolean);
        
        select.innerHTML = `<option value="">${label}</option>` + 
                           items.map(i => `<option value="${i}">${i}</option>`).join('') +
                           `<option value="custom">+ 직접 입력</option>`;
        
        if (Array.from(select.options).some(opt => opt.value === currentVal)) {
            select.value = currentVal;
        }
    };
    render('category-select', 'category', '카테고리 선택');
    render('sub-category-select', 'sub_category', '소분류 선택');
    render('payment-select', 'payment', '결제 수단 선택');
}

function resetInputs() {
    (document.getElementById('date') as HTMLInputElement).value = new Date().toISOString().split('T')[0];
    ['category-select', 'sub-category-select', 'payment-select'].forEach(id => {
        (document.getElementById(id) as HTMLSelectElement).value = "";
    });
    ['category-custom', 'sub-category-custom', 'payment-custom'].forEach(id => {
        const el = document.getElementById(id) as HTMLElement;
        el.style.display = 'none';
        (el as HTMLInputElement).value = "";
    });
    (document.getElementById('description') as HTMLInputElement).value = "";
    (document.getElementById('amount') as HTMLInputElement).value = "";
}

// 💡 수정 모드 호출 시 셀렉트박스와 직접 입력창 처리 로직 보완
(window as any).editItem = (t: any) => {
    (document.getElementById('modal-title') as HTMLElement).innerText = "EDIT RECORD";
    (document.getElementById('edit-id') as HTMLInputElement).value = t.id;
    (document.getElementById('date') as HTMLInputElement).value = t.date;
    (document.getElementById('amount') as HTMLInputElement).value = t.amount;
    (document.getElementById('description') as HTMLInputElement).value = t.description || "";

    const setVal = (sId: string, cId: string, val: string) => {
        const s = document.getElementById(sId) as HTMLSelectElement;
        const c = document.getElementById(cId) as HTMLInputElement;
        
        // 기존 옵션에 값이 있는지 확인
        const options = Array.from(s.options).map(o => o.value);
        if (options.includes(val)) {
            s.value = val;
            c.style.display = 'none';
        } else if (val) {
            s.value = 'custom';
            c.value = val;
            c.style.display = 'block';
        } else {
            s.value = "";
            c.style.display = 'none';
        }
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