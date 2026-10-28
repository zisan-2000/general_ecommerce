LOCAL TEST FIXTURE ONLY

localhost-cert.pem is a self-signed certificate for localhost / 127.0.0.1.
localhost-key.pem is its intentionally public, disposable test private key.
Neither file contains application credentials or a real merchant identity.
Never install this certificate into an OS/browser trust store or use this key
outside the isolated local test server. Tests trust it only on their own Agent.

The local test process rejects non-loopback TCP destinations. It injects a local
origin allowlist into a VM copy of the actual connector and sanitizer source;
the production gateway allowlist and instrumentation flags remain unchanged.

Regenerate only if this fixture expires, using a local OpenSSL installation:
openssl req -x509 -newkey rsa:2048 -nodes -keyout localhost-key.pem -out localhost-cert.pem -days 3650 -subj /CN=localhost -addext subjectAltName=DNS:localhost,IP:127.0.0.1
