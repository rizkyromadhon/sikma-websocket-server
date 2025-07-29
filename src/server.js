import { WebSocketServer } from "ws";
import { createServer } from "http";
import prisma from "./lib/prisma.ts";
import { isAktifSekarang } from "./lib/schedule-helper.js";

const SOCKET_PORT = 3001;
const server = createServer();
const wss = new WebSocketServer({ server });
const alatConnections = new Map();

server.on("listening", () => {
  console.log(`🚀 WebSocket server berjalan dan mendengarkan di port ${SOCKET_PORT}`);
});

wss.on("connection", (ws) => {
  console.log(`🔌 Client terhubung! Total koneksi: ${wss.clients.size}`);

  ws.on("message", async (message) => {
    try {
      const msgString = message.toString();
      const parsedMessage = JSON.parse(msgString);
      console.log("Server menerima pesan:", parsedMessage);

      if (parsedMessage.event === "request-config") {
        const { alatId } = parsedMessage;
        if (alatId) {
          alatConnections.set(alatId, ws);
          const alat = await prisma.alatPresensi.findUnique({ where: { id: alatId } });
          if (alat) {
            const configData = {
              event: "config-update",
              alatId: alat.id,
              mode: alat.mode,
              status: isAktifSekarang(alat) ? "AKTIF" : "NONAKTIF",
            };
            ws.send(JSON.stringify(configData));
            console.log(`Mengirim config ke ${alatId}:`, configData);
          }
        }
      } else if (parsedMessage.event === "broadcast") {
        console.log("Menyiarkan pesan ke semua client:", parsedMessage.data);
        wss.clients.forEach((client) => {
          if (client.readyState === ws.OPEN) {
            client.send(JSON.stringify(parsedMessage.data));
          }
        });
      }
    } catch (error) {
      console.error("Gagal memproses pesan:", error);
    }
  });

  ws.on("close", () => {
    for (const [id, conn] of alatConnections.entries()) {
      if (conn === ws) {
        alatConnections.delete(id);
        console.log(`🛑 Koneksi alat ${id} diputus`);
      }
    }
    console.log(`🔌 Client terputus. Sisa koneksi: ${wss.clients.size}`);
  });

  ws.on("error", (error) => {
    console.error("WebSocket Error:", error);
  });
});

server.listen(SOCKET_PORT, "0.0.0.0");

const previousStatuses = {};

setInterval(async () => {
  const semuaAlat = await prisma.alatPresensi.findMany({
    select: {
      id: true,
      name: true,
      mode: true,
      jadwal_nyala: true,
      jadwal_mati: true,
    },
  });

  for (const alat of semuaAlat) {
    const statusBaru = isAktifSekarang(alat) ? "AKTIF" : "NONAKTIF";

    if (alat.mode === "REGISTRASI") {
      continue;
    }

    if (previousStatuses[alat.id] !== statusBaru) {
      previousStatuses[alat.id] = statusBaru;

      const alatTerbaru = await prisma.alatPresensi.findUnique({ where: { id: alat.id } });

      if (alatTerbaru?.mode === "REGISTRASI") {
        continue;
      }

      if (statusBaru === "AKTIF") {
        const configData = {
          event: "config-update",
          alatId: alatTerbaru.id,
          nama: alatTerbaru.name,
          mode: alatTerbaru.mode,
          status: statusBaru,
        };

        console.log(`✅ [AUTO-BROADCAST] Alat AKTIF: "${alat.name}" (ID: ${alat.id})`);

        const targetWS = alatConnections.get(alat.id);
        if (targetWS && targetWS.readyState === targetWS.OPEN) {
          targetWS.send(JSON.stringify(configData));
        } else {
          console.warn(`⚠️ Tidak bisa kirim ke alatId ${alat.id}, tidak terhubung.`);
        }
      } else {
        const configData = {
          event: "config-update",
          alatId: alatTerbaru.id,
          nama: alatTerbaru.name,
          mode: alatTerbaru.mode,
          status: statusBaru,
        };

        const targetWS = alatConnections.get(alat.id);
        if (targetWS && targetWS.readyState === targetWS.OPEN) {
          targetWS.send(JSON.stringify(configData));
        } else {
          console.warn(`⚠️ Tidak bisa kirim ke alatId ${alat.id}, tidak terhubung.`);
        }
        console.log(`ℹ️ Alat "${alat.name}" (ID: ${alat.id}) kini NONAKTIF (tidak dikirim).`);
      }
    }
  }
}, 1000);
