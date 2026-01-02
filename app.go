package main

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"time"

	_ "modernc.org/sqlite"
)

type Transaction struct {
	ID          int    `json:"id"`
	Date        string `json:"date"`
	Category    string `json:"category"`
	SubCategory string `json:"sub_category"`
	Payment     string `json:"payment"` // 결제 수단 추가
	Description string `json:"description"`
	Amount      int    `json:"amount"`
	Color       string `json:"color"`
}

type Budget struct {
	Total         int                       `json:"total"`
	Categories    map[string]int            `json:"categories"`
	SubCategories map[string]map[string]int `json:"subCategories"` // { "쇼핑": { "웹툰": 50000 } }
}

type App struct {
	ctx context.Context
	db  *sql.DB
}

var userBudget Budget = Budget{
	Total:         0,
	Categories:    make(map[string]int),
	SubCategories: make(map[string]map[string]int),
}

func NewApp() *App { return &App{} }

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	db, err := sql.Open("sqlite", "budget.db")
	if err != nil {
		fmt.Println("DB 연결 실패:", err)
		return
	}
	a.db = db

	// 1. 필수 테이블 생성
	a.db.Exec(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT, category TEXT, sub_category TEXT, payment TEXT, description TEXT, amount INTEGER, type TEXT
    );`)
	a.db.Exec(`CREATE TABLE IF NOT EXISTS categories (
		name TEXT PRIMARY KEY, color TEXT
	);`)

	// ⭐️ [중요] 기존 DB에 description 컬럼이 없는 경우를 대비해 강제로 추가 시도
	// 이미 컬럼이 있으면 에러가 나지만 무시하고 넘어갑니다.
	_, _ = a.db.Exec(`ALTER TABLE transactions ADD COLUMN payment TEXT;`)
	rand.Seed(time.Now().UnixNano())
	a.fixMissingColors()
}

func (a *App) getOrAssignColor(name string) string {
	if name == "" {
		return "#8E8E93"
	}
	var color string
	err := a.db.QueryRow("SELECT color FROM categories WHERE name = ?", name).Scan(&color)
	if err == sql.ErrNoRows {
		color = fmt.Sprintf("hsl(%d, 70%%, 50%%)", rand.Intn(360))
		_, _ = a.db.Exec("INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)", name, color)
	}
	return color
}

func (a *App) fixMissingColors() {
	rows, _ := a.db.Query("SELECT DISTINCT category FROM transactions")
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var name string
			if err := rows.Scan(&name); err == nil {
				a.getOrAssignColor(name)
			}
		}
	}
}

func (a *App) SaveTransaction(date, category, subCategory, payment, description string, amount int) string {
	a.getOrAssignColor(category)
	query := `INSERT INTO transactions (date, category, sub_category, payment, description, amount, type) VALUES (?, ?, ?, ?, ?, ?, 'OUT')`
	_, err := a.db.Exec(query, date, category, subCategory, payment, description, amount)
	if err != nil {
		return "저장 실패: " + err.Error()
	}
	return "✨ 기록 완료!"
}

func (a *App) GetTransactions() []Transaction {
	// 순서: id, date, category, sub_category, payment, description, amount, color (8개)
	query := `
        SELECT 
            t.id, t.date, t.category, t.sub_category, 
            IFNULL(t.payment, ''), 
            IFNULL(t.description, ''), 
            t.amount, 
            IFNULL(c.color, '#8E8E93')
        FROM transactions t
        LEFT JOIN categories c ON t.category = c.name
        ORDER BY t.date DESC, t.id DESC
    `
	rows, err := a.db.Query(query)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var results []Transaction = []Transaction{}
	for rows.Next() {
		var t Transaction
		// ⭐️ Scan 개수를 8개로 정확히 맞춰야 데이터가 뜹니다!
		err := rows.Scan(
			&t.ID, &t.Date, &t.Category, &t.SubCategory,
			&t.Payment, &t.Description, &t.Amount, &t.Color,
		)
		if err != nil {
			fmt.Println("Scan Error:", err)
			continue
		}
		results = append(results, t)
	}
	return results
}

func (a *App) DeleteTransaction(id int) string {
	_, err := a.db.Exec("DELETE FROM transactions WHERE id = ?", id)
	if err != nil {
		return "삭제 실패"
	}
	return "삭제 성공"
}

// app.go 파일에서 UpdateTransaction을 찾아서 아래와 같이 수정하세요.
func (a *App) UpdateTransaction(id int, date, category, subCategory, payment, description string, amount int) string {
	a.getOrAssignColor(category)

	// SQL 쿼리에도 payment=? 를 추가해야 합니다.
	query := `UPDATE transactions SET date=?, category=?, sub_category=?, payment=?, description=?, amount=? WHERE id=?`
	_, err := a.db.Exec(query, date, category, subCategory, payment, description, amount, id)
	if err != nil {
		return "수정 실패: " + err.Error()
	}
	return "수정이 완료되었습니다."
}

// SaveBudget: 프론트에서 예산 정보를 받아 저장
func (a *App) SaveBudget(total int, categories map[string]int, subs map[string]map[string]int) {
	userBudget.Total = total
	userBudget.Categories = categories
	userBudget.SubCategories = subs
}

// GetBudget: 저장된 예산 정보를 프론트로 반환
func (a *App) GetBudget() Budget {
	return userBudget
}
