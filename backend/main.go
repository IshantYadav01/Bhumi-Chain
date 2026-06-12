package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-gonic/gin"

	"github.com/ndhack/backend/config"
	"github.com/ndhack/backend/fabric"
	"github.com/ndhack/backend/handlers"
)

func main() {
	cfg := config.Load()
	pool := fabric.NewPool(fabric.PoolConfig{
		PeerAddress:   cfg.GatewayPeer,
		PeerTLSCACert: cfg.PeerTLSCACert,
		SkipVerify:    cfg.TLSSkipVerify,
		ChannelID:     cfg.ChannelID,
		ChaincodeName: cfg.ChaincodeName,
		CryptoBase:    cfg.CryptoPath,
	})
	defer pool.Close()

	// Default identity — override via env FABRIC_ORG / FABRIC_USER,
	// per-request via X-Identity header.
	defOrg, defUser := config.DefaultIdentity()
	if defOrg == "" {
		defOrg = "province1"
	}
	if defUser == "" {
		defUser = "User1"
	}

	landH := handlers.NewLandHandler(pool, defOrg, defUser)

	// ── Routes ──────────────────────────────────────────────────
	r := gin.Default()

	// CORS — allow the Next.js frontend on :3000 (dev) or same-origin (prod).
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, X-Identity")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	api := r.Group("/api")
	{
		api.GET("/land", landH.QueryLand)
		api.POST("/land", landH.PostAction)
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// ── Graceful shutdown ───────────────────────────────────────
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("Shutting down...")
		pool.Close()
		os.Exit(0)
	}()

	log.Printf("🚀 Fabric Gateway backend listening on %s", cfg.ListenPort)
	log.Printf("   Peer:       %s", cfg.GatewayPeer)
	log.Printf("   Channel:    %s", cfg.ChannelID)
	log.Printf("   Chaincode:  %s", cfg.ChaincodeName)
	log.Printf("   Default ID: %s/%s", defOrg, defUser)

	if err := r.Run(cfg.ListenPort); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
