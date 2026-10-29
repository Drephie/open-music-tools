#!/usr/bin/env python3
"""Serve the hub over https on the home Wi-Fi, to try tools that use the
microphone on a phone before putting them online (phones only allow the
microphone on https pages, or on the computer itself).

    python3 .claude/serve-https.py        (port 8443, or $PORT)

Prints the address to open on the phone. The certificate is made here, for
this computer's Wi-Fi address (and kept while it stays the same), and is
not trusted by any phone: the first visit shows "This connection is not private"; tap Show Details, then "visit
this website". It is kept in ~/.open-music-tools-https/, outside the repo.
"""
import functools
import http.server
import os
import pathlib
import ssl
import subprocess
import sys

port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', 8443))
root = pathlib.Path(__file__).resolve().parent.parent


def wifi_address():
    for iface in ('en0', 'en1'):
        out = subprocess.run(['ipconfig', 'getifaddr', iface], capture_output=True, text=True).stdout.strip()
        if out:
            return out
    return '127.0.0.1'


ip = wifi_address()
folder = pathlib.Path.home() / '.open-music-tools-https'
folder.mkdir(exist_ok=True)
key, cert, made_for = folder / 'key.pem', folder / 'cert.pem', folder / 'address.txt'
# The certificate is kept while the Wi-Fi address stays the same (a new one
# means the phone warns again). iPhones refuse certificates without
# serverAuth or valid for over 825 days.
fresh = cert.exists() and made_for.exists() and made_for.read_text() == ip
if not fresh:
    subprocess.run([
        'openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '30',
        '-keyout', str(key), '-out', str(cert), '-subj', f'/CN={ip}',
        '-addext', f'subjectAltName=IP:{ip},IP:127.0.0.1,DNS:localhost',
        '-addext', 'extendedKeyUsage=serverAuth',
    ], check=True, capture_output=True)
    made_for.write_text(ip)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(str(cert), str(key))


class NoCache(http.server.SimpleHTTPRequestHandler):
    # The phone always gets the newest files while we change them.
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


handler = functools.partial(NoCache, directory=str(root))
server = http.server.ThreadingHTTPServer(('0.0.0.0', port), handler)
server.socket = context.wrap_socket(server.socket, server_side=True)
print(f'On the phone (same Wi-Fi): https://{ip}:{port}/', flush=True)
server.serve_forever()
