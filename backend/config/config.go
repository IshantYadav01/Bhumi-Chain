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
	GatewayPeer   string // e.g. "peer0.province1.example.com:7051" (Docker) or "localhost:7051" (host)
	PeerTLSCACert string // path to peer org's TLS CA cert
	TLSSkipVerify bool   // skip hostname verification (host mode: localhost != peer0.province1.example.com)

	// Crypto base path
	CryptoPath string // e.g. "/organizations" (Docker) or "../network/organizations" (host)
}

// DefaultIdentity returns the default gateway identity (org, user).
func DefaultIdentity() (org, user string) {
	return os.Getenv("FABRIC_ORG"), os.Getenv("FABRIC_USER")
}

// Load returns a Config populated from environment variables with sensible defaults.
// Detects Docker vs host mode automatically.
func Load() *Config {
	inDocker := isDocker()
	projRoot := findProjectRoot()

	cfg := &Config{
		ListenPort:    envOrDefault("BACKEND_PORT", ":8080"),
		ChannelID:     envOrDefault("CHANNEL_ID", "mychannel"),
		ChaincodeName: envOrDefault("CHAINCODE_NAME", "landreg"),
	}

	if inDocker {
		cfg.GatewayPeer = envOrDefault("GATEWAY_PEER", "peer0.province1.example.com:7051")
		cfg.PeerTLSCACert = envOrDefault("PEER_TLS_CA_CERT",
			"/organizations/peerOrganizations/province1.example.com/peers/peer0.province1.example.com/tls/ca.crt")
		cfg.TLSSkipVerify = false // hostname matches cert SAN in Docker
		cfg.CryptoPath = envOrDefault("CRYPTO_PATH", "/organizations")
	} else {
		cfg.GatewayPeer = envOrDefault("GATEWAY_PEER", "localhost:7051")
		cfg.PeerTLSCACert = envOrDefault("PEER_TLS_CA_CERT",
			filepath.Join(projRoot, "network/organizations/peerOrganizations/province1.example.com/peers/peer0.province1.example.com/tls/ca.crt"))
		cfg.TLSSkipVerify = true // localhost != peer0.province1.example.com
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

// isDocker returns true if running inside a Docker container.
func isDocker() bool {
	if os.Getenv("DOCKER_ENV") == "1" {
		return true
	}
	if _, err := os.Stat("/.dockerenv"); err == nil {
		return true
	}
	return false
}

// findProjectRoot walks up from the working directory to find the
// project root (the directory containing backend/, network/, etc.).
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
