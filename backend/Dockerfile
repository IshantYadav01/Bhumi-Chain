FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o server .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates curl
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder /src/server .
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 8080
CMD ["./server"]
