// Package auth provides JWT-based authentication with SQLite user store.
// Each user is identified by their NID (National ID number).
package auth

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

// Claims are embedded in every JWT.
type Claims struct {
	NID  string `json:"nid"`
	Role string `json:"role"`
	jwt.RegisteredClaims
}

// UserInfo returned after login.
type UserInfo struct {
	NID  string `json:"nid"`
	Name string `json:"name"`
	Role string `json:"role"`
}

type Store struct{ db *sql.DB }

var globalStore *Store

// InitDB initializes SQLite and seeds dummy users.
func InitDB(dbPath string) error {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	if err := db.Ping(); err != nil {
		return fmt.Errorf("ping db: %w", err)
	}
	_, _ = db.Exec("PRAGMA journal_mode=WAL")

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			nid        TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			display_name TEXT NOT NULL DEFAULT '',
			role       TEXT NOT NULL DEFAULT 'customer',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("create users table: %w", err)
	}

	globalStore = &Store{db: db}
	return seedDummyData()
}

func seedDummyData() error {
	type s struct{ nid, pass, name, role string }
	users := []s{
		{"admin", "admin123", "System Admin", "admin"},
		{"NID-001", "pass123", "Alice Sharma", "customer"},
		{"NID-002", "pass123", "Bob Verma", "customer"},
		{"NID-003", "pass123", "Carol Singh", "customer"},
		{"NID-004", "pass123", "Dave Patel", "customer"},
		{"NID-005", "pass123", "Eve Gupta", "customer"},
		{"NID-006", "pass123", "Frank Das", "customer"},
	}
	for _, u := range users {
		var c int
		_ = globalStore.db.QueryRow("SELECT COUNT(*) FROM users WHERE nid = ?", u.nid).Scan(&c)
		if c > 0 {
			continue
		}
		h, _ := bcrypt.GenerateFromPassword([]byte(u.pass), bcrypt.DefaultCost)
		_, _ = globalStore.db.Exec(
			"INSERT INTO users (nid, password_hash, display_name, role) VALUES (?,?,?,?)",
			u.nid, string(h), u.name, u.role,
		)
	}
	return nil
}

func jwtSecret() []byte {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return []byte(s)
	}
	return []byte("landreg-dev-secret-change-in-production")
}

// Authenticate checks NID + password, returns JWT + user info.
func Authenticate(nid, password string) (token string, info *UserInfo, err error) {
	if globalStore == nil {
		return "", nil, fmt.Errorf("auth store not initialized")
	}
	var hash, name, role string
	err = globalStore.db.QueryRow(
		"SELECT password_hash, display_name, role FROM users WHERE nid = ?", nid,
	).Scan(&hash, &name, &role)
	if err != nil {
		return "", nil, fmt.Errorf("invalid credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return "", nil, fmt.Errorf("invalid credentials")
	}
	claims := Claims{
		NID:  nid,
		Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(12 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "landreg-backend",
		},
	}
	token, err = jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret())
	if err != nil {
		return "", nil, err
	}
	return token, &UserInfo{NID: nid, Name: name, Role: role}, nil
}

// Signup creates a new user with NID as the identity.
func Signup(nid, password, name, role string) (*UserInfo, error) {
	if globalStore == nil {
		return nil, fmt.Errorf("auth store not initialized")
	}
	if role == "" {
		role = "customer"
	}
	if role != "admin" && role != "customer" {
		return nil, fmt.Errorf("invalid role: %s", role)
	}
	var c int
	_ = globalStore.db.QueryRow("SELECT COUNT(*) FROM users WHERE nid = ?", nid).Scan(&c)
	if c > 0 {
		return nil, fmt.Errorf("NID already registered")
	}
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}
	_, err = globalStore.db.Exec(
		"INSERT INTO users (nid, password_hash, display_name, role) VALUES (?,?,?,?)",
		nid, string(h), name, role,
	)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return &UserInfo{NID: nid, Name: name, Role: role}, nil
}

// Validate parses and validates a JWT.
func Validate(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{},
		func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return jwtSecret(), nil
		},
	)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}
	return claims, nil
}
