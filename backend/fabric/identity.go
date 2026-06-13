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
	User  string
}

// LoadIdentity loads a user identity from MSP directory.
// Path: {base}/peerOrganizations/{domain}/users/{user}@{domain}/msp/
func LoadIdentity(basePath, domain, user string) (*Identity, error) {
	userDir := filepath.Join(basePath, "peerOrganizations",
		domain,
		"users",
		fmt.Sprintf("%s@%s", user, domain),
		"msp",
	)

	certPath, err := findCert(filepath.Join(userDir, "signcerts"), user, domain)
	if err != nil {
		return nil, fmt.Errorf("identity %s/%s: %w", domain, user, err)
	}
	keyPath, err := findKey(filepath.Join(userDir, "keystore"))
	if err != nil {
		return nil, fmt.Errorf("identity %s/%s: %w", domain, user, err)
	}

	certPEM, err := os.ReadFile(certPath)
	if err != nil {
		return nil, fmt.Errorf("read cert %s: %w", certPath, err)
	}
	cert, err := identity.CertificateFromPEM(certPEM)
	if err != nil {
		return nil, fmt.Errorf("parse cert %s: %w", certPath, err)
	}
	id, err := identity.NewX509Identity(mspID(domain), cert)
	if err != nil {
		return nil, fmt.Errorf("new x509 identity %s/%s: %w", domain, user, err)
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
		return nil, fmt.Errorf("sign func %s/%s: %w", domain, user, err)
	}

	return &Identity{
		MSPID: mspID(domain),
		ID:    id,
		Sign:  sign,
		User:  user,
		Cert:  cert,
	}, nil
}

// mspID derives the MSP ID from org domain (e.g. "landreg.com" → "LandRegMSP").
func mspID(domain string) string {
	parts := strings.SplitN(domain, ".", 2)
	if len(parts) == 0 || parts[0] == "" {
		return "MSP"
	}
	// Handle camelCase: "landreg" → "LandReg"
	s := parts[0]
	// Find capital letters in original to preserve them
	result := ""
	for i, r := range s {
		if i == 0 {
			result += strings.ToUpper(string(r))
		} else if r >= 'A' && r <= 'Z' {
			// Already capitalized, keep it
			result += string(r)
		} else {
			result += string(r)
		}
	}
	return result + "MSP"
}

// findCert finds the X.509 certificate PEM file in a signcerts directory.
func findCert(signcertsDir, user, domain string) (string, error) {
	entries, err := os.ReadDir(signcertsDir)
	if err != nil {
		return "", fmt.Errorf("read signcerts %s: %w", signcertsDir, err)
	}
	expected := fmt.Sprintf("%s@%s-cert.pem", user, domain)
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
