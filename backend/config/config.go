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
	GatewayPeer   string // e.g. "localhost:7051"
	PeerTLSCACert string // path to peer org's TLS CA cert
	TLSSkipVerify bool   // skip hostname verification (dev only)

	// Crypto base path
	CryptoPath string // e.g. "../network/organizations"
}

// DefaultIdentity returns the default gateway identity (org, user).
func DefaultIdentity() (org, user string) {
	return os.Getenv("FABRIC_ORG"), os.Getenv("FABRIC_USER")
}

// Load returns a Config populated from environment variables with sensible defaults.
func Load() *Config {
	projRoot := findProjectRoot()
	return &Config{
		ListenPort:    envOrDefault("BACKEND_PORT", ":8080"),
		ChannelID:     envOrDefault("CHANNEL_ID", "mychannel"),
		ChaincodeName: envOrDefault("CHAINCODE_NAME", "landreg"),
		GatewayPeer:   envOrDefault("GATEWAY_PEER", "localhost:7051"),
		PeerTLSCACert: envOrDefault("PEER_TLS_CA_CERT", filepath.Join(projRoot, "network/organizations/peerOrganizations/province1.example.com/peers/peer0.province1.example.com/tls/ca.crt")),
		TLSSkipVerify: true, // dev: localhost ≠ peer0.province1.example.com
		CryptoPath:    envOrDefault("CRYPTO_PATH", filepath.Join(projRoot, "network/organizations")),
	}
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// findProjectRoot walks up from the working directory to find the
// project root (the directory containing backend/, network/, etc.).
func findProjectRoot() string {
	// Prefer env var
	if r := os.Getenv("PROJECT_ROOT"); r != "" {
		return r
	}
	// Assume we're running from backend/
	cwd, err := os.Getwd()
	if err != nil {
		return ".."
	}
	// If cwd ends with /backend, strip it
	if filepath.Base(cwd) == "backend" {
		return filepath.Dir(cwd)
	}
	return cwd
}
