package models

// ── Request types ────────────────────────────────────────────────────

type RegisterRequest struct {
	PlotID       string  `json:"plotId" binding:"required"`
	SurveyNumber string  `json:"surveyNumber"`
	Owner        string  `json:"owner" binding:"required"`
	Location     string  `json:"location"`
	Province     string  `json:"province"`
	Area         float64 `json:"area"`
	LandType     string  `json:"landType"`
}

type TransferRequest struct {
	PlotID string  `json:"plotId" binding:"required"`
	Buyer  string  `json:"buyer" binding:"required"`
	Price  float64 `json:"price"`
}

type SplitRequest struct {
	PlotID   string      `json:"plotId" binding:"required"`
	Children []ChildSpec `json:"children" binding:"required"`
}

type ChildSpec struct {
	PlotID string  `json:"plotId"`
	Owner  string  `json:"owner"`
	Area   float64 `json:"area"`
}

type MortgageRequest struct {
	PlotID    string  `json:"plotId" binding:"required"`
	Bank      string  `json:"bank" binding:"required"`
	Amount    float64 `json:"amount"`
	StartDate string  `json:"startDate"`
	EndDate   string  `json:"endDate"`
}

type ClearMortgageRequest struct {
	PlotID string `json:"plotId" binding:"required"`
}

type DisputeRequest struct {
	PlotID      string `json:"plotId" binding:"required"`
	CaseNumber  string `json:"caseNumber" binding:"required"`
	Court       string `json:"court"`
	Description string `json:"description"`
}

type ResolveDisputeRequest struct {
	PlotID string `json:"plotId" binding:"required"`
}

// Unified POST body — action field dispatched by handler.
type ActionRequest struct {
	Action string `json:"action" binding:"required"`

	// Register
	PlotID       string  `json:"plotId"`
	SurveyNumber string  `json:"surveyNumber"`
	Owner        string  `json:"owner"`
	Location     string  `json:"location"`
	Province     string  `json:"province"`
	Area         float64 `json:"area"`
	LandType     string  `json:"landType"`

	// Transfer
	Buyer string  `json:"buyer"`
	Price float64 `json:"price"`

	// Split
	Children []ChildSpec `json:"children"`

	// Mortgage
	Bank      string  `json:"bank"`
	Amount    float64 `json:"amount"`
	StartDate string  `json:"startDate"`
	EndDate   string  `json:"endDate"`

	// Dispute
	CaseNumber  string `json:"caseNumber"`
	Court       string `json:"court"`
	Description string `json:"description"`
}

// ── Response envelope ────────────────────────────────────────────────

type APIResponse struct {
	Success bool        `json:"success,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}
