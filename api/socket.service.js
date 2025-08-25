// socket.service.js
// Encapsulates Socket.IO event handlers for the Trackpadal API

const { default: axios } = require("axios");
const { EnSyncEngine } = require("ensync-client-sdk");

/**
 * Initialize all socket event handlers
 * @param {import('socket.io').Server} io
 */
async function initSocket(io) {
    const gpsEventName = "trackpedal/gps";
    const speedEventName = "trackpedal/speed";
    const torchEventName = "trackpedal/torch";
    const batteryEventName = "trackpedal/battery";
    const batteryDistanceEventName = "trackpedal/battery_distance";
    const tyrePressureEventName = "trackpedal/tyre_pressure";

    const receiversId = [process.env.RECEIVER_IDENTIFICATION_NUMBER];

    const ensyncClient = new EnSyncEngine("ws://localhost:8082", {
        accessKey: process.env.ENSYNC_CLIENT_ID,
    });

    const client = await ensyncClient.createClient(
        process.env.ENSYNC_CLIENT_ID
    );

    console.log(process.env.ENSYNC_CLIENT_ID);
    console.log(process.env.RECEIVER_IDENTIFICATION_NUMBER);

    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        // Event 1: Bike data (real-time cycling metrics)
        socket.on("bike_data", async (data) => {
            console.log("🚴 Bike Data Received:", {
                socketId: socket.id,
                position: data.position,
                speed: `${data.speed} km/h`,
                torchOn: data.torchOn,
                timestamp: new Date(data.timestamp).toISOString(),
            });
        });

        // New granular events
        socket.on("bike_gps", async ({ x, y, timestamp }) => {
            console.log("🗺️  Bike GPS:", {
                socketId: socket.id,
                x,
                y,
                timestamp: new Date(timestamp).toISOString(),
            });

            try {
                if (receiversId.length > 0) {
                    await client.publish(gpsEventName, receiversId, {
                        x,
                        y,
                        timestamp,
                    });
                }
            } catch (error) {
                console.log(error);
            }
        });

        socket.on("bike_speed", async ({ speed, timestamp }) => {
            console.log("⚡ Bike Speed:", {
                socketId: socket.id,
                speed: `${speed} km/h`,
                timestamp: new Date(timestamp).toISOString(),
            });

            try {
                if (receiversId.length > 0) {
                    await client.publish(speedEventName, receiversId, {
                        speed,
                        timestamp,
                    });
                }
            } catch (error) {
                console.log(error);
            }
        });

        socket.on("bike_torch", async ({ torchOn, timestamp }) => {
            console.log("🔦 Bike Torch:", {
                socketId: socket.id,
                torchOn,
                timestamp: new Date(timestamp).toISOString(),
            });

            try {
                if (receiversId.length > 0) {
                    await client.publish(torchEventName, receiversId, {
                        torchOn,
                        timestamp,
                    });
                }
            } catch (error) {
                console.log(error);
            }
        });

        // Battery level
        socket.on("bike_battery", async ({ battery, timestamp }) => {
            console.log("🔋 Bike Battery:", {
                socketId: socket.id,
                battery: `${battery}%`,
                timestamp: new Date(timestamp).toISOString(),
            });

            try {
                if (receiversId.length > 0) {
                    await client.publish(batteryEventName, receiversId, {
                        battery,
                        timestamp,
                    });
                }
            } catch (error) {
                console.log(error);
            }
        });

        // Distance covered on current battery
        socket.on(
            "bike_battery_distance",
            async ({ distanceKm, timestamp }) => {
                console.log("📏 Battery Distance:", {
                    socketId: socket.id,
                    distanceKm,
                    timestamp: new Date(timestamp).toISOString(),
                });

                try {
                    if (receiversId.length > 0) {
                        await client.publish(
                            batteryDistanceEventName,
                            receiversId,
                            {
                                distanceKm,
                                timestamp,
                            }
                        );
                    }
                } catch (error) {
                    console.log(error);
                }
            }
        );

        // Tyre pressure
        socket.on("bike_tyre_pressure", async ({ psi, timestamp }) => {
            console.log("🛞 Tyre Pressure:", {
                socketId: socket.id,
                psi,
                timestamp: new Date(timestamp).toISOString(),
            });

            try {
                if (receiversId.length > 0) {
                    await client.publish(tyrePressureEventName, receiversId, {
                        psi,
                        timestamp,
                    });
                }
            } catch (error) {
                console.log(error);
            }
        });

        // Event 2: Plan selection
        socket.on("plan_selected", (data) => {
            console.log("📋 Plan Selected:", {
                socketId: socket.id,
                plan: data.plan,
                price: `$${data.price}/mo`,
                timestamp: new Date(data.timestamp).toISOString(),
            });
        });

        // Event 3: Plan purchase
        socket.on("plan_purchased", (data) => {
            console.log("💳 Plan Purchased:", {
                socketId: socket.id,
                plan: data.plan,
                userId: data.userId,
                timestamp: new Date(data.timestamp).toISOString(),
            });
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });
}

module.exports = { initSocket };
