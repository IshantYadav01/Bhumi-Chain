package config

import (
	"os"
	"path/filepath"
)

// Config holds all backend configuration.
type Config struct {
	ListenPort string // e.g. ":8080"

	// Fabric network
	ChannelID     string // e.g. "mychannel"
	ChaincodeName string // e.g. "landreg"

	// Gateway peer connection
	GatewayPeer   string // e.g. "peer0.org1.example.com:7051" (Docker) or "localhost:7051" (host)
	PeerTLSCACert string // path to peer org's TLS CA cert
	TLSSkipVerify bool   // skip hostname verification (host mode)

	// Crypto base path
	CryptoPath string // e.g. "/organizations" (Docker) or "../network/organizations" (host)

	// Single org
	Org string

	// SQLite database path
	DBPath string
}

// Load returns a Config populated from environment variables with sensible defaults.
func Load() *Config {
	inDocker := isDocker()
	projRoot := findProjectRoot()

	cfg := &Config{
		ListenPort:    envOrDefault("BACKEND_PORT", ":8080"),
		ChannelID:     envOrDefault("CHANNEL_ID", "mychannel"),
		ChaincodeName: envOrDefault("CHAINCODE_NAME", "landreg"),
		DBPath:        envOrDefault("DB_PATH", filepath.Join(projRoot, "backend/data/landreg.db")),
	}

	cfg.Org = envOrDefault("FABRIC_ORG", "landreg")

	if inDocker {
		cfg.GatewayPeer = envOrDefault("GATEWAY_PEER", "peer0.landreg.com:7051")
		cfg.PeerTLSCACert = envOrDefault("PEER_TLS_CA_CERT",
			"/organizations/peerOrganizations/landreg.com/peers/peer0.landreg.com/tls/ca.crt")
		cfg.TLSSkipVerify = false
		cfg.CryptoPath = envOrDefault("CRYPTO_PATH", "/organizations")
	} else {
		cfg.GatewayPeer = envOrDefault("GATEWAY_PEER", "localhost:7051")
		cfg.PeerTLSCACert = envOrDefault("PEER_TLS_CA_CERT",
			filepath.Join(projRoot, "network/organizations/peerOrganizations/landreg.com/peers/peer0.landreg.com/tls/ca.crt"))
		cfg.TLSSkipVerify = true
		cfg.CryptoPath = envOrDefault("CRYPTO_PATH", filepath.Join(projRoot, "network/organizations"))
	}

	return cfg
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func isDocker() bool {
	if os.Getenv("DOCKER_ENV") == "1" {
		return true
	}
	if _, err := os.Stat("/.dockerenv"); err == nil {
		return true
	}
	return false
}

func findProjectRoot() string {
	if r := os.Getenv("PROJECT_ROOT"); r != "" {
		return r
	}
	cwd, err := os.Getwd()
	if err != nil {
		return ".."
	}
	if filepath.Base(cwd) == "backend" {
		return filepath.Dir(cwd)
	}
	return cwd
}
