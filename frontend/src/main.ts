import './style.css';
import { SaveTransaction, GetTransactions, UpdateTransaction, DeleteTransaction } from '../wailsjs/go/main/App';

// 초기 로드
window.addEventListener('load', async () => {
    const app = document.querySelector('#app');
    if (!app) return;

    // HTML 구조 렌더링 (삭제 모달 추가)
    app.innerHTML = `
        <div class="dashboard-container">
            <header class="dashboard-header">
                <div class="summary-card">
                    <span class="label">MONTHLY TOTAL</span>
                    <span class="total-amount" id="total-amount">0 원</span>
                </div>
            </header>

            <main class="dashboard-content" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                <div class="panel-header" style="padding: 20px 40px 10px;">RECENT ACTIVITY</div>
                <div id="log-list" class="log-scroll" style="padding: 0 40px; flex: 1;"></div>
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
                        
                        <input type="text" id="description" placeholder="상세 내역 (예: 점심 식사, 편의점)" class="app-input">
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

    // 입력 모달 열기/닫기
    document.getElementById('open-modal-btn')?.addEventListener('click', () => {
        document.getElementById('modal-title')!.innerText = "NEW RECORD";
        (document.getElementById('edit-id') as HTMLInputElement).value = "";
        resetInputs();
        inputModal.style.display = 'flex';
    });

    document.getElementById('close-modal-btn')?.addEventListener('click', () => inputModal.style.display = 'none');
    
    // 삭제 모달 닫기
    document.getElementById('close-delete-btn')?.addEventListener('click', () => deleteModal.style.display = 'none');

    // 모달 바깥 배경 클릭 시 닫기
    window.addEventListener('click', (e) => {
        if (e.target === inputModal) inputModal.style.display = 'none';
        if (e.target === deleteModal) deleteModal.style.display = 'none';
    });

    // 직접 입력 토글 로직
    const bindToggle = (sId: string, cId: string) => {
        const s = document.getElementById(sId) as HTMLSelectElement;
        const c = document.getElementById(cId) as HTMLInputElement;
        s.addEventListener('change', () => {
            c.style.display = s.value === 'custom' ? 'block' : 'none';
            if (s.value === 'custom') c.focus();
        });
    };
    bindToggle('category-select', 'category-custom');
    bindToggle('sub-category-select', 'sub-category-custom');

    // 저장 및 삭제 확인 버튼
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

    if (!date || !category || isNaN(amount)) return alert("필수 항목을 입력하세요.");

    try {
        if (editId) {
            await UpdateTransaction(parseInt(editId), date, category, subCategory, description, amount);
        } else {
            await SaveTransaction(date, category, subCategory, description, amount);
        }
        (document.getElementById('input-modal') as HTMLElement).style.display = 'none';
        await updateList();
    } catch (err) { alert(err); }
}

// 실제 삭제 처리 함수
async function handleConfirmDelete() {
    const id = (document.getElementById('delete-id') as HTMLInputElement).value;
    if (!id) return;

    try {
        await DeleteTransaction(parseInt(id));
        (document.getElementById('delete-modal') as HTMLElement).style.display = 'none';
        await updateList();
    } catch (err) {
        alert("삭제 실패: " + err);
    }
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
            listArea.innerHTML = `<div style="text-align:center; padding:50px; color:#ccc;">내역이 없습니다.</div>`;
            return;
        }

        listArea.innerHTML = data.map((t: any) => `
            <div class="log-card">
                <div class="card-edge" style="background-color: ${t.color || '#8E8E93'} !important;"></div>
                <div class="card-content">
                    <div class="card-info">
                        <div style="display: flex; align-items: baseline; gap: 10px;">
                            <span class="card-date">${t.date}</span>
                            <span class="card-description" title="${t.description || ''}">${t.description || ''}</span>
                        </div>
                        <div class="category-badges">
                            <span class="badge" style="background-color: ${t.color || '#8E8E93'} !important;">${t.category}</span>
                            <span class="badge sub-cat">${t.sub_category || '-'}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span class="card-amount">${(t.amount || 0).toLocaleString()} 원</span>
                        <div class="card-actions">
                            <button onclick="window.editItem(${JSON.stringify(t).replace(/"/g, '&quot;')})" class="action-btn">✎</button>
                            <button onclick="window.deleteItem(${t.id})" class="action-btn">×</button>
                        </div>
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
}

function resetInputs() {
    (document.getElementById('date') as HTMLInputElement).value = new Date().toISOString().split('T')[0];
    ['category-select', 'sub-category-select'].forEach(id => (document.getElementById(id) as HTMLSelectElement).value = "");
    ['category-custom', 'sub-category-custom'].forEach(id => {
        const el = document.getElementById(id) as HTMLElement;
        el.style.display = 'none';
        (el as HTMLInputElement).value = "";
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
    (document.getElementById('category-select') as HTMLSelectElement).value = t.category;
    (document.getElementById('sub-category-select') as HTMLSelectElement).value = t.sub_category || "";
    (document.getElementById('input-modal') as HTMLElement).style.display = 'flex';
};

// 기존 confirm 대신 커스텀 모달 띄우기
(window as any).deleteItem = (id: number) => {
    (document.getElementById('delete-id') as HTMLInputElement).value = id.toString();
    (document.getElementById('delete-modal') as HTMLElement).style.display = 'flex';
};