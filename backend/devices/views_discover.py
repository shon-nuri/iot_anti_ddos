import os
import socket
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from scapy.all import ARP, Ether, srp


class NetworkDiscoveryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        target_ip = "192.168.0.1/24"  # ❗ заменишь на нужную тебе подсеть
        devices = []

        arp = ARP(pdst=target_ip)
        ether = Ether(dst="ff:ff:ff:ff:ff:ff")
        packet = ether / arp

        result = srp(packet, timeout=2, verbose=False)[0]

        for sent, received in result:
            ip = received.psrc
            mac = received.hwsrc

            # 🔍 Получаем hostname (если возможно)
            try:
                hostname = socket.gethostbyaddr(ip)[0]
            except socket.herror:
                hostname = None

            # 🔁 Пингуем
            response = os.system(f"ping -n 1 -w 100 {ip} > nul")  # Windows
            # response = os.system(f"ping -c 1 {ip} > /dev/null")  # Linux/Mac

            is_alive = response == 0

            devices.append({
                "ip": ip,
                "mac": mac,
                "hostname": hostname,
                "is_alive": is_alive
            })

        return Response(devices)
