import asyncio
import json
import socket

import flet as ft
from flet_webview import WebView

DISCOVERY_PORT = 9999
DISCOVERY_MESSAGE = "LOWORKSHOP_DISCOVER"
DEFAULT_PORT = 8000


def discover_server(timeout=3.0):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(timeout)

    try:
        sock.sendto(DISCOVERY_MESSAGE.encode("utf-8"), ("255.255.255.255", DISCOVERY_PORT))
        data, _ = sock.recvfrom(4096)
        payload = json.loads(data.decode("utf-8", errors="ignore"))
        host = payload.get("host") or "127.0.0.1"
        port = int(payload.get("port", DEFAULT_PORT))
        return f"http://{host}:{port}"
    except (socket.timeout, OSError, ValueError, json.JSONDecodeError):
        return None
    finally:
        sock.close()


def main(page: ft.Page):
    page.title = "LoworkShop móvil"
    page.padding = 0
    page.spacing = 0
    page.theme = ft.Theme(
        system_overlay_style=ft.SystemOverlayStyle(
            status_bar_color="#1e5aa8",
            status_bar_brightness=ft.Brightness.DARK,
            status_bar_icon_brightness=ft.Brightness.LIGHT,
        )
    )

    root = ft.Container(
        content=ft.Column(
            controls=[
                ft.Image(
                    src="icon.png",
                    width=160,
                    height=160,
                    fit=ft.BoxFit.CONTAIN,
                ),
                ft.Text(
                    "LoworkShop",
                    size=28,
                    weight=ft.FontWeight.W_700,
                ),
                ft.Text(
                    "Buscando el servidor local...",
                    size=16,
                    color=ft.Colors.ON_SURFACE_VARIANT,
                ),
                ft.ProgressBar(
                    width=220,
                    color="#1e5aa8",
                ),
            ],
            alignment=ft.MainAxisAlignment.CENTER,
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            spacing=20,
            expand=True,
        ),
        alignment=ft.Alignment(0, 0),
        expand=True,
        padding=0,
    )
    page.add(root)

    async def connect():
        while True:
            found = await asyncio.to_thread(discover_server)
            if found:
                root.content = ft.SafeArea(
                    content=WebView(url=found, expand=True),
                    expand=True,
                )
                page.update()
                return
            await asyncio.sleep(0.5)

    page.run_task(connect)

if __name__ == "__main__":
    ft.run(main)