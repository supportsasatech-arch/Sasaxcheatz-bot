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

// 🛒 ORDER STATES
const orderStates = {};

// 🍔 FETCH MENU
async function getMenuFromApp() {

    try {

        const response =
            await fetch(`${FIREBASE_URL}/dishes.json`);

        const data = await response.json();

        if (!data) return [];

        return Object.keys(data).map(key => ({
            id: key,
            name: data[key].name,
            price: data[key].price,
            imageUrl: data[key].imageUrl || ""
        }));

    } catch (error) {

        console.log("❌ Failed To Fetch Menu");
        console.log(error);

        return [];
    }
}

// 🚀 START BOT
async function startBot() {

    if (!FIREBASE_URL) {

        console.log("❌ FIREBASE_URL Missing!");
        process.exit(1);
    }

    // 💾 SESSION
    const { state, saveCreds } =
        await useMultiFileAuthState('./session');

    // 📦 VERSION
    const { version } =
        await fetchLatestBaileysVersion();

    // 🤖 SOCKET
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['SasaXCheatZ', 'Chrome', '1.0.0']
    });

    // 💾 SAVE SESSION
    sock.ev.on('creds.update', saveCreds);

    // 🔑 PAIRING CODE
    if (!state.creds.registered) {

        setTimeout(async () => {

            try {

                const code =
                    await sock.requestPairingCode("94784167385");

                console.log("\n==============================");
                console.log("🔑 PAIRING CODE:");
                console.log(code);
                console.log("==============================\n");

            } catch (err) {

                console.log("❌ Pairing Error:");
                console.log(err.message);
            }

        }, 15000);
    }

    // 🔄 CONNECTION UPDATE
    sock.ev.on('connection.update', async (update) => {

        const {
            connection,
            lastDisconnect
        } = update;

        console.log("📡 Status:", connection);

        // ✅ CONNECTED
        if (connection === 'open') {

            console.log("✅ BOT CONNECTED SUCCESSFULLY!");
        }

        // ❌ DISCONNECTED
        if (connection === 'close') {

            const reason =
                lastDisconnect?.error?.output?.statusCode;

            console.log("❌ Connection Closed:", reason);

            if (reason !== DisconnectReason.loggedOut) {

                console.log("🔄 Reconnecting...");
                startBot();
            }
        }
    });

    // 📩 MESSAGE LISTENER
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

        // 👋 AUTO REPLY
        if (text === "hi" || text === "hello") {

            await sock.sendMessage(sender, {
                text:
`👋 Hello!

Type:
🍔 menu

To view available items.`
            });
        }

        // 🍔 MENU COMMAND
        if (text === "menu") {

            const menu = await getMenuFromApp();

            if (!menu.length) {

                await sock.sendMessage(sender, {
                    text: "❌ Menu Not Available"
                });

                return;
            }

            let menuText = "🍔 *MENU LIST*\n\n";

            menu.forEach((item, index) => {

                menuText +=
`${index + 1}. ${item.name} - Rs.${item.price}
`;
            });

            await sock.sendMessage(sender, {
                text: menuText
            });
        }
    });
}

// 🚀 RUN BOT
startBot();
