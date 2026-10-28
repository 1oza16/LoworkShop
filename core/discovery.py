import json
import socket
import socketserver

DISCOVERY_PORT = 9999
DISCOVERY_MESSAGE = "LOWORKSHOP_DISCOVER"


def get_local_ip():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]


class LoworkShopDiscoveryHandler(socketserver.BaseRequestHandler):

    def handle(self):
        request = self.request[0].decode("utf-8", errors="ignore").strip()

        if request != DISCOVERY_MESSAGE:
            return

        payload = json.dumps({
            "host": get_local_ip(),
            "port": self.server.http_port,
        }).encode("utf-8")

        self.request[1].sendto(payload, self.client_address)


class LoworkShopDiscoveryServer(socketserver.ThreadingUDPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, server_address, handler_cls, http_port):
        super().__init__(server_address, handler_cls)
        self.http_port = http_port


def start_discovery_server(http_port, udp_port=DISCOVERY_PORT):
    return LoworkShopDiscoveryServer(
        ("", udp_port),
        LoworkShopDiscoveryHandler,
        http_port,
    )


def discover_server(timeout=4.0, udp_port=DISCOVERY_PORT, http_port=8000):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(timeout)

    try:
        sock.sendto(DISCOVERY_MESSAGE.encode("utf-8"), ("255.255.255.255", udp_port))
        data, _ = sock.recvfrom(4096)
        response = json.loads(data.decode("utf-8", errors="ignore"))
        host = response.get("host") or "127.0.0.1"
        port = int(response.get("port", http_port))
        return f"http://{host}:{port}"
    except (socket.timeout, OSError, ValueError, json.JSONDecodeError):
        return None
    finally:
        sock.close()
