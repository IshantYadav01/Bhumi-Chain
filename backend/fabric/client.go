package fabric

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/hyperledger/fabric-gateway/pkg/client"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

// Client wraps a Fabric Gateway connection for a single identity.
// It is safe for concurrent use.
type Client struct {
	gw       *client.Gateway
	network  *client.Network
	contract *client.Contract
	conn     *grpc.ClientConn
}

// Pool manages gateway clients keyed by "{org}/{user}".
type Pool struct {
	mu      sync.RWMutex
	clients map[string]*Client
	cfg     PoolConfig
}

// PoolConfig holds parameters shared by all clients.
type PoolConfig struct {
	PeerAddress   string // e.g. "localhost:7051"
	PeerTLSCACert string // path to TLS CA cert
	SkipVerify    bool   // dev: skip hostname check
	ChannelID     string
	ChaincodeName string
	CryptoBase    string // base path to organizations/
	Domain        string // org domain, e.g. "landreg.com"
}

// NewPool creates a client pool.
func NewPool(cfg PoolConfig) *Pool {
	return &Pool{
		clients: make(map[string]*Client),
		cfg:     cfg,
	}
}

// Get returns a client for the given identity.  Clients are lazily
// created and cached; the underlying gRPC connection is shared.
func (p *Pool) Get(org, user string) (*Client, error) {
	key := org + "/" + user

	// Fast path — read lock.
	p.mu.RLock()
	if c, ok := p.clients[key]; ok {
		p.mu.RUnlock()
		return c, nil
	}
	p.mu.RUnlock()

	// Slow path — create.
	p.mu.Lock()
	defer p.mu.Unlock()

	// Double-check.
	if c, ok := p.clients[key]; ok {
		return c, nil
	}

	id, err := LoadIdentity(p.cfg.CryptoBase, p.cfg.Domain, user)
	if err != nil {
		return nil, fmt.Errorf("pool: load identity %s: %w", key, err)
	}

	c, err := newClient(p.cfg, id)
	if err != nil {
		return nil, fmt.Errorf("pool: connect %s: %w", key, err)
	}

	p.clients[key] = c
	return c, nil
}

// Close shuts down all pooled clients.
func (p *Pool) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	for k, c := range p.clients {
		c.Close()
		delete(p.clients, k)
	}
}

// ── Client ──────────────────────────────────────────────────────────

func newClient(cfg PoolConfig, id *Identity) (*Client, error) {
	tlsCfg, err := loadTLS(cfg.PeerTLSCACert, cfg.SkipVerify)
	if err != nil {
		return nil, err
	}
	creds := credentials.NewTLS(tlsCfg)

	conn, err := grpc.Dial(
		cfg.PeerAddress,
		grpc.WithTransportCredentials(creds),
		grpc.WithBlock(),
		grpc.WithTimeout(10*time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("grpc dial: %w", err)
	}

	gw, err := client.Connect(
		id.ID,
		client.WithSign(id.Sign),
		client.WithClientConnection(conn),
		client.WithEvaluateTimeout(10*time.Second),
		client.WithEndorseTimeout(30*time.Second),
		client.WithSubmitTimeout(30*time.Second),
		client.WithCommitStatusTimeout(2*time.Minute),
	)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("gateway connect: %w", err)
	}

	network := gw.GetNetwork(cfg.ChannelID)
	contract := network.GetContract(cfg.ChaincodeName)

	return &Client{
		gw:       gw,
		network:  network,
		contract: contract,
		conn:     conn,
	}, nil
}

func (c *Client) Close() {
	if c.gw != nil {
		c.gw.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}
}

// ── Public operations ───────────────────────────────────────────────

// Evaluate runs a read-only chaincode query.
func (c *Client) Evaluate(fcn string, args ...string) ([]byte, error) {
	return c.contract.EvaluateTransaction(fcn, args...)
}

// Submit submits a chaincode invocation.
func (c *Client) Submit(fcn string, args ...string) ([]byte, error) {
	return c.contract.SubmitTransaction(fcn, args...)
}

// SubmitFresh creates a completely new gateway connection for each Submit.
func (p *Pool) SubmitFresh(org, user string, fcn string, args ...string) ([]byte, error) {
	id, err := LoadIdentity(p.cfg.CryptoBase, p.cfg.Domain, user)
	if err != nil {
		return nil, fmt.Errorf("pool: load identity: %w", err)
	}
	tlsCfg, err := loadTLS(p.cfg.PeerTLSCACert, p.cfg.SkipVerify)
	if err != nil {
		return nil, err
	}
	creds := credentials.NewTLS(tlsCfg)
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	conn, err := grpc.DialContext(ctx, p.cfg.PeerAddress,
		grpc.WithTransportCredentials(creds), grpc.WithBlock())
	if err != nil {
		return nil, fmt.Errorf("grpc dial: %w", err)
	}
	defer conn.Close()
	gw, err := client.Connect(id.ID, client.WithSign(id.Sign),
		client.WithClientConnection(conn),
		client.WithEvaluateTimeout(30*time.Second),
		client.WithEndorseTimeout(60*time.Second),
		client.WithSubmitTimeout(60*time.Second))
	if err != nil {
		return nil, fmt.Errorf("gateway connect: %w", err)
	}
	defer gw.Close()
	contract := gw.GetNetwork(p.cfg.ChannelID).GetContract(p.cfg.ChaincodeName)
	return contract.SubmitTransaction(fcn, args...)
}

// EvaluateQSCC evaluates a query on the QSCC system chaincode (block explorer).
func (c *Client) EvaluateQSCC(fcn string, args ...string) ([]byte, error) {
	qscc := c.network.GetContract("qscc")
	return qscc.EvaluateTransaction(fcn, args...)
}

// ── TLS helpers ─────────────────────────────────────────────────────

func loadTLS(certPath string, skipVerify bool) (*tls.Config, error) {
	pool, err := x509.SystemCertPool()
	if err != nil {
		pool = x509.NewCertPool()
	}
	if certPath != "" {
		pem, err := os.ReadFile(certPath)
		if err != nil {
			return nil, fmt.Errorf("read TLS cert %s: %w", certPath, err)
		}
		if !pool.AppendCertsFromPEM(pem) {
			return nil, fmt.Errorf("no certs parsed from %s", certPath)
		}
	}
	return &tls.Config{
		RootCAs:            pool,
		InsecureSkipVerify: skipVerify,
	}, nil
}
