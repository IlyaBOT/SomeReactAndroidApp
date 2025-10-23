# ========== SSL сертификаты ========== (run this once to generate cert.pem + key.pem)
# generate_cert.sh
#!/bin/sh
openssl req \
-newkey rsa:2048 -nodes -keyout key.pem \
-x509 -days 365 -out cert.pem \
-subj "/C=RU/ST=Moscow/L=Moscow/O=MyApp/OU=Dev/CN=localhost"
chmod 600 key.pem cert.pem