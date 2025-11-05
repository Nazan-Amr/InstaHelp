#!/bin/bash
# Generate RSA-2048 keys for encryption
# Run from backend directory

mkdir -p keys

echo "Generating RSA-2048 private key..."
openssl genrsa -out keys/private_key.pem 2048

echo "Generating RSA-2048 public key..."
openssl rsa -in keys/private_key.pem -pubout -out keys/public_key.pem

echo "Keys generated successfully!"
echo "Private key: keys/private_key.pem"
echo "Public key: keys/public_key.pem"
echo ""
echo "⚠️  Keep these keys secure and never commit them to version control!"

