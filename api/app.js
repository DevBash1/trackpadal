const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { initSocket } = require("./socket.service");
const { default: axios } = require("axios");
require("dotenv").config({
    path: "../.env",
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

app.use(cors());
app.use(express.json());

// Initialize Socket.IO handlers
initSocket(io);

const createIntegrator = async (plan, session) => {
    const apikey =
        plan === "basic"
            ? process.env.BASIC_PLAN_ENSYNC_INTEGRATION_KEY
            : process.env.PRO_PLAN_ENSYNC_INTEGRATION_KEY;
    const url = process.env.ENYNC_INTEGRATION_URL;

    try {
        const result = await axios.post(
            url,
            {
                appName: "TrackPedal",
                appDescription: `TrackPedal ${
                    plan === "basic" ? "Basic" : "Pro"
                } Plan`,
                appIcon: "https://paydantic.io/Paydantic_Basic_Logo.svg",
                appColor: "#ffde59",
                metadata: {
                    session,
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apikey}`,
                },
            }
        );
    
        const integratorUrl = `${process.env.ENSYNC_EMBED_URL}/${result.data.data.id}`;
        return integratorUrl;
    } catch (error) {
        console.log(error);
    }
};

const sessions = new Map();

// EnSync connect endpoints (return dummy URLs per plan)
app.get("/api/ensync/connect/basic", async (req, res) => {
    const session = req.query.session || "dummy-basic";
    if (!sessions.has(session)) {
        sessions.set(session, await createIntegrator("basic", session));
    }
    res.json({ url: sessions.get(session) });
});

app.get("/api/ensync/connect/pro", async (req, res) => {
    const session = req.query.session || "dummy-pro";
    if (!sessions.has(session)) {
        sessions.set(session, await createIntegrator("pro", session));
    }
    res.json({ url: sessions.get(session) });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
