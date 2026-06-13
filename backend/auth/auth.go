// Package auth provides JWT-based authentication for the land-registry API.
//
// Users authenticate with username/password.  On success the server
// returns a signed JWT that encodes the user's MSP identity
// (org + user).  Protected endpoints extract the identity from the
// JWT instead of trusting a client-supplied X-Identity header.
//
// Credentials are hard-coded for the demo.  In production you would
// replace the userStore with a database or an external IdP.

package auth

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// ── Token claims ──────────────────────────────────────────────────────

// Claims are embedded in every JWT issued by this service.
type Claims struct {
	Org  string `json:"org"`  // e.g. "province1"
	User string `json:"user"` // e.g. "Admin"
	jwt.RegisteredClaims
}

// Identity returns the (org, user) tuple for MSP resolution.
func (c Claims) Identity() (org, user string) {
	return c.Org, c.User
}

// ── Credential store ──────────────────────────────────────────────────

type credential struct {
	PasswordHash string   // bcrypt hash
	Org          string   // MSP org
	User         string   // MSP user
	Name         string   // display name
	Roles        []string // on-chain roles (mirrored for UI)
}

// UserInfo is returned to the frontend after successful login.
type UserInfo struct {
	Username string   `json:"username"`
	Name     string   `json:"name"`
	Org      string   `json:"org"`
	Roles    []string `json:"roles"`
}

// userStore maps login usernames to credentials.
// All passwords are demo/test values — see comments.
var userStore = map[string]credential{
	// ── Admin (full access) ─────────────────────────────────────────
	"admin": {
		// password: admin123
		PasswordHash: "$2a$10$40zfif4h6M8TpbnC46Q5zeP8Jx8kbY/eiRjmxMo0f8R5d5pivCoKu",
		Org:          "province1",
		User:         "Admin",
		Name:         "System Admin",
		Roles:        []string{"admin"},
	},

	// ── Malpot / Official (register land, view all) ────────────────
	"malpot1": {
		// password: malpot123
		PasswordHash: "$2a$10$HahUs//nDvYWOQn.lYK1Ku0ZBHLt1HXEFPK3lsc5r/ikK0BTuCoXe",
		Org:          "province1",
		User:         "User1",
		Name:         "Province Malpot",
		Roles:        []string{"malpot"},
	},
	"official1": {
		// password: official123
		PasswordHash: "$2a$10$SUTHC2nTaD.0H.gpKd9qRu10bEeGjeZdQJ9puD7Cj9FMc7cdmEajq",
		Org:          "province1",
		User:         "User1",
		Name:         "Province Official",
		Roles:        []string{"official"},
	},

	// ── Bank / Court ────────────────────────────────────────────────
	"bank1": {
		// password: bank123
		PasswordHash: "$2a$10$j5vaJZdanRbCdq4Xyb4jq.N6JnWM9NQ3bKknx9NzfDnX99RIx5W7G",
		Org:          "province1",
		User:         "User2",
		Name:         "State Bank",
		Roles:        []string{"bank", "seller", "buyer"},
	},
	"court1": {
		// password: court123
		PasswordHash: "$2a$10$kBYBywz7kr9TK053xuTCvOZNDRjTfRmG8TusrvK.wu2ZNaBFccRh.",
		Org:          "province1",
		User:         "User2",
		Name:         "High Court",
		Roles:        []string{"court", "seller", "buyer"},
	},

	// ── Individual sellers / buyers ─────────────────────────────────
	"seller1": {
		// password: seller123
		PasswordHash: "$2a$10$gzYCRsOXKEo7WkDcdl9RM.3OHYNwAoNq1WUcpO1cD9EGpdIjrWKc.",
		Org:          "province1",
		User:         "User1",
		Name:         "Land Owner (Seller)",
		Roles:        []string{"seller", "buyer"},
	},
	"buyer1": {
		// password: buyer123
		PasswordHash: "$2a$10$12WFyxmCK3RmtVX4yrZNkexJqCjGATDAYgQw2tEYbcRlLCWL5HS/y",
		Org:          "province1",
		User:         "User1",
		Name:         "Property Buyer",
		Roles:        []string{"buyer"},
	},

	// ── Simple demo users ───────────────────────────────────────────
	"user1": {
		// password: land123
		PasswordHash: "$2a$10$uJJKqNtpJnfR1wwL/5Kmn.or2kzJDrBaDrnyXduxqY27n4MqOZpn2",
		Org:          "province1",
		User:         "User1",
		Name:         "User One",
		Roles:        []string{"admin", "malpot", "official", "seller", "buyer"},
	},
	"user2": {
		// password: land123
		PasswordHash: "$2a$10$uJJKqNtpJnfR1wwL/5Kmn.or2kzJDrBaDrnyXduxqY27n4MqOZpn2",
		Org:          "province1",
		User:         "User2",
		Name:         "User Two",
		Roles:        []string{"court", "bank", "seller", "buyer"},
	},
}

// secret is the HMAC key used to sign JWTs.  Override via JWT_SECRET env.
func jwtSecret() []byte {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return []byte(s)
	}
	return []byte("landreg-dev-secret-change-in-production")
}

// ── Public API ────────────────────────────────────────────────────────

// Authenticate checks username + password and returns a signed JWT plus user info.
func Authenticate(username, password string) (token string, info *UserInfo, err error) {
	cred, ok := userStore[username]
	if !ok {
		return "", nil, fmt.Errorf("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(cred.PasswordHash), []byte(password)); err != nil {
		// Password mismatch — log a warning in production.
		return "", nil, fmt.Errorf("invalid credentials")
	}

	claims := Claims{
		Org:  cred.Org,
		User: cred.User,
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

	info = &UserInfo{
		Username: username,
		Name:     cred.Name,
		Org:      cred.Org,
		Roles:    cred.Roles,
	}
	return token, info, nil
}

// Validate parses and validates a JWT, returning the embedded claims.
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
