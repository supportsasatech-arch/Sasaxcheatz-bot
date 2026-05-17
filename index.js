const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const fetch = require('node-fetch');

// 🌟 FIREBASE URL 🌟
const FIREBASE_URL = process.env.FIREBASE_URL;

const orderStates = {};

async function getMenuFromApp() {
    try {
        const response = await fetch(`${FIREBASE_URL}/dishes.json`);
        const data = await response.json();

        if (!data) return [];

        return Object.keys(data).map(key => ({
            id: key,
            name: data[key].name,
            price: data[key].price,
            imageUrl: data[key].imageUrl
        }));

    } catch (error) {
        console.error("❌ Failed to fetch menu:", error);
        return [];
    }
}

async function startBot() {

    if (!FIREBASE_URL) {
        console.log("❌ FIREBASE_URL Missing!");
        process.exit(1);
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["SasaXCheatZ", "Chrome", "1.0.0"]
    });

    // 🔑 PAIRING CODE LOGIN
    if (!state.creds.registered) {

        const phoneNumber = "94784167385"; // Replace with your WhatsApp number

        const code = await sock.requestPairingCode(phoneNumber);

        console.log("\n=================================");
        console.log("🔑 YOUR PAIRING CODE:");
        console.log(code);
        console.log("=================================\n");
    }

    sock.ev.on('connection.update', async (update) => {

        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log("✅ BOT CONNECTED SUCCESSFULLY!");
        }

        if (connection === 'close') {

            const reason = lastDisconnect?.error?.output?.statusCode;

            console.log("❌ Connection Closed:", reason);

            if (reason !== DisconnectReason.loggedOut) {
                startBot();
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {

        const msg = m.messages[0];

        if (!msg.message) return;
        if (msg.key.remoteJid === 'status@broadcast') return;
        if (msg.key.fromMe) return;

        const sender = msg.key.remoteJid;

        const text = (
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            ""
        ).toLowerCase();

        console.log(`📩 Message: ${text}`);

        // 👾 MENU COMMAND
        if (text === "menu") {

            const menu = await getMenuFromApp();

            if (!menu.length) {
                await sock.sendMessage(sender, {
                    text: "❌ Menu Not Available"
                });
                return;
            }

            let menuText = "👾 *PANEL MENU LIST * 👾\n\n";

            menu.forEach((item, index) => {
                menuText += `${index + 1}. ${item.name} - Rs.${item.price}\n`;
            });

            await sock.sendMessage(sender, {
                text: menuText
            });
        }
    });
}

startBot();
