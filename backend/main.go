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
	pool := fabric.NewPool(fabric.PoolConfig{
		PeerAddress:   cfg.GatewayPeer,
		PeerTLSCACert: cfg.PeerTLSCACert,
		SkipVerify:    cfg.TLSSkipVerify,
		ChannelID:     cfg.ChannelID,
		ChaincodeName: cfg.ChaincodeName,
		CryptoBase:    cfg.CryptoPath,
	})
	defer pool.Close()

	// Fallback identity used when no JWT is present (for health checks, etc.).
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

	// CORS — allow the Next.js frontend on :3000.
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Identity")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Health check (no auth required).
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Login endpoint (no auth required).
	r.POST("/api/login", func(c *gin.Context) {
		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "username and password required"})
			return
		}
		token, info, err := auth.Authenticate(body.Username, body.Password)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"token": token,
			"user":  info,
		})
	})

	// Protected API group — requires valid JWT.
	api := r.Group("/api")
	api.Use(jwtMiddleware())
	{
		api.GET("/land", landH.QueryLand)
		api.POST("/land", landH.PostAction)
		api.GET("/users", landH.QueryLand)
		api.POST("/users", landH.PostAction)
		api.GET("/me", func(c *gin.Context) {
			org, _ := c.Get("msp_org")
			user, _ := c.Get("msp_user")
			c.JSON(http.StatusOK, gin.H{
				"org":  org,
				"user": user,
			})
		})
	}

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

	if err := r.Run(cfg.ListenPort); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

// jwtMiddleware extracts and validates the JWT from the Authorization
// header, then stores the MSP identity in the Gin context for handlers.
//
// Also supports the legacy X-Identity header for backward compatibility
// during development (lower priority than JWT).
func jwtMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Try Bearer token first.
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := auth.Validate(tokenStr)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
				return
			}
			org, user := claims.Identity()
			c.Set("msp_org", org)
			c.Set("msp_user", user)
			c.Next()
			return
		}

		// 2. Fallback: X-Identity header (legacy, for seed script).
		if xid := c.GetHeader("X-Identity"); xid != "" {
			org, user, _ := strings.Cut(xid, "/")
			if org != "" && user != "" {
				c.Set("msp_org", org)
				c.Set("msp_user", user)
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
	}
}
