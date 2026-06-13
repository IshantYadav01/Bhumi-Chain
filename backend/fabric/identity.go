package fabric

import (
	"crypto/x509"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/hyperledger/fabric-gateway/pkg/identity"
)

// Identity bundles a Fabric X.509 identity with its signing function.
type Identity struct {
	MSPID string
	ID    *identity.X509Identity
	Sign  identity.Sign
	Cert  *x509.Certificate
	Org   string
	User  string
}

// LoadIdentity loads a user identity from an MSP directory.
// Base path: {base}/peerOrganizations/{org}.example.com/users/{user}@{org}.example.com/msp/
func LoadIdentity(basePath, org, user string) (*Identity, error) {
	userDir := filepath.Join(basePath, "peerOrganizations",
		fmt.Sprintf("%s.example.com", org),
		"users",
		fmt.Sprintf("%s@%s.example.com", user, org),
		"msp",
	)

	certPath, err := findCert(filepath.Join(userDir, "signcerts"), user, org)
	if err != nil {
		return nil, fmt.Errorf("identity %s/%s: %w", org, user, err)
	}
	keyPath, err := findKey(filepath.Join(userDir, "keystore"))
	if err != nil {
		return nil, fmt.Errorf("identity %s/%s: %w", org, user, err)
	}

	certPEM, err := os.ReadFile(certPath)
	if err != nil {
		return nil, fmt.Errorf("read cert %s: %w", certPath, err)
	}
	cert, err := identity.CertificateFromPEM(certPEM)
	if err != nil {
		return nil, fmt.Errorf("parse cert %s: %w", certPath, err)
	}
	id, err := identity.NewX509Identity(mspID(org), cert)
	if err != nil {
		return nil, fmt.Errorf("new x509 identity %s/%s: %w", org, user, err)
	}

	keyPEM, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("read key %s: %w", keyPath, err)
	}
	privKey, err := identity.PrivateKeyFromPEM(keyPEM)
	if err != nil {
		return nil, fmt.Errorf("parse key %s: %w", keyPath, err)
	}
	sign, err := identity.NewPrivateKeySign(privKey)
	if err != nil {
		return nil, fmt.Errorf("sign func %s/%s: %w", org, user, err)
	}

	return &Identity{
		MSPID: mspID(org),
		ID:    id,
		Sign:  sign,
		Org:   org,
		User:  user,
		Cert:  cert,
	}, nil
}

// mspID derives the MSP ID from org name (e.g. "org1" → "Org1MSP").
func mspID(org string) string {
	if len(org) == 0 {
		return "MSP"
	}
	return strings.ToUpper(org[:1]) + org[1:] + "MSP"
}

// findCert finds the X.509 certificate PEM file in a signcerts directory.
func findCert(signcertsDir, user, org string) (string, error) {
	entries, err := os.ReadDir(signcertsDir)
	if err != nil {
		return "", fmt.Errorf("read signcerts %s: %w", signcertsDir, err)
	}
	expected := fmt.Sprintf("%s@%s.example.com-cert.pem", user, org)
	for _, e := range entries {
		if !e.IsDir() && e.Name() == expected {
			return filepath.Join(signcertsDir, e.Name()), nil
		}
	}
	for _, e := range entries {
		if !e.IsDir() && e.Name() == "cert.pem" {
			return filepath.Join(signcertsDir, e.Name()), nil
		}
	}
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".pem") {
			return filepath.Join(signcertsDir, e.Name()), nil
		}
	}
	return "", fmt.Errorf("no .pem cert found in %s", signcertsDir)
}

// findKey returns the path to the private key file in a keystore directory.
func findKey(keystoreDir string) (string, error) {
	entries, err := os.ReadDir(keystoreDir)
	if err != nil {
		return "", fmt.Errorf("read keystore %s: %w", keystoreDir, err)
	}
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), "_sk") {
			return filepath.Join(keystoreDir, e.Name()), nil
		}
	}
	for _, e := range entries {
		if !e.IsDir() {
			return filepath.Join(keystoreDir, e.Name()), nil
		}
	}
	return "", fmt.Errorf("no key file found in %s", keystoreDir)
}
