package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/gin-gonic/gin"

	"github.com/ndhack/backend/auth"
	"github.com/ndhack/backend/config"
	"github.com/ndhack/backend/fabric"
	"github.com/ndhack/backend/handlers"
)

func main() {
	cfg := config.Load()

	// ── Initialize SQLite auth store ────────────────────────────────
	// Ensure data directory exists
	if err := os.MkdirAll("data", 0755); err != nil {
		log.Fatalf("Create data dir: %v", err)
	}
	if err := auth.InitDB(cfg.DBPath); err != nil {
		log.Fatalf("Init auth DB: %v", err)
	}
	log.Printf("Auth DB: %s", cfg.DBPath)

	// ── Fabric gateway pool ─────────────────────────────────────────
	pool := fabric.NewPool(fabric.PoolConfig{
		PeerAddress:   cfg.GatewayPeer,
		PeerTLSCACert: cfg.PeerTLSCACert,
		SkipVerify:    cfg.TLSSkipVerify,
		ChannelID:     cfg.ChannelID,
		ChaincodeName: cfg.ChaincodeName,
		CryptoBase:    cfg.CryptoPath,
	})
	defer pool.Close()

	landH := handlers.NewLandHandler(pool, cfg.Org)

	// ── Routes ──────────────────────────────────────────────────────
	r := gin.Default()

	// CORS
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Auth endpoints (no JWT required)
	r.POST("/api/login", func(c *gin.Context) {
		var body struct {
			NID      string `json:"nid"`
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.NID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nid and password required"})
			return
		}
		token, info, err := auth.Authenticate(body.NID, body.Password)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"token": token,
			"user":  info,
		})
	})

	r.POST("/api/signup", func(c *gin.Context) {
		var body struct {
			NID      string `json:"nid"`
			Password string `json:"password"`
			Name     string `json:"name"`
			Role     string `json:"role"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.NID == "" || body.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nid and password required"})
			return
		}
		userInfo, err := auth.Signup(body.NID, body.Password, body.Name, body.Role)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{
			"user": userInfo,
		})
	})

	// Protected API group — requires valid JWT.
	api := r.Group("/api")
	api.Use(jwtMiddleware())
	{
		api.GET("/land", landH.QueryLand)
		api.POST("/land", landH.PostAction)
		api.GET("/me", func(c *gin.Context) {
			nid, _ := c.Get("msp_nid")
			c.JSON(http.StatusOK, gin.H{"nid": nid})
		})
	}

	// ── Graceful shutdown ───────────────────────────────────────────
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("Shutting down...")
		pool.Close()
		os.Exit(0)
	}()

	log.Printf("🚀 Land Registry backend listening on %s", cfg.ListenPort)
	log.Printf("   Peer:      %s", cfg.GatewayPeer)
	log.Printf("   Channel:   %s", cfg.ChannelID)
	log.Printf("   Chaincode: %s", cfg.ChaincodeName)

	if err := r.Run(cfg.ListenPort); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

// jwtMiddleware extracts and validates the JWT from the Authorization header.
func jwtMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := auth.Validate(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}
		c.Set("msp_nid", claims.NID)
		c.Next()
	}
}
