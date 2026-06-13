FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY . .
RUN go mod vendor && CGO_ENABLED=0 go build -mod=vendor -o server .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates curl
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
RUN mkdir -p /app/data && chown -R appuser:appgroup /app
COPY --from=builder /src/server .
USER appuser
EXPOSE 8080
CMD ["./server"]
