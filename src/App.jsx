import React, { useEffect, useRef, useState } from "react";
import BicycleSimulator from "./BicycleSimulator.jsx";
import { io } from "socket.io-client";

function BikeSVG({
    className = "",
    running = false,
    speedKmh = 0,
    torchOn = false,
}) {
    // Map speed (km/h) to rotation period (s). Faster speed => shorter period.
    const minPeriod = 0.3; // fastest
    const maxPeriod = 6; // slowest (including near zero)
    const calcTargetPeriod = (sKmh) => {
        const s = Math.max(0, Number(sKmh) || 0);
        const mapped = s > 0 ? Math.max(minPeriod, 8 / s) : maxPeriod;
        return Math.min(Math.max(mapped, minPeriod), maxPeriod);
    };
    const targetPeriodSec = calcTargetPeriod(speedKmh);

    // Exponential smoothing of period for smooth speed up/down
    const [smoothPeriod, setSmoothPeriod] = useState(targetPeriodSec);
    const [smoothIntensity, setSmoothIntensity] = useState(torchOn ? 1 : 0);
    const targetRef = useRef(targetPeriodSec);
    const targetIntensityRef = useRef(torchOn ? 1 : 0);
    const rafIdRef = useRef(null);
    const lastTsRef = useRef(null);
    const phaseRef = useRef(0);

    useEffect(() => {
        targetRef.current = targetPeriodSec;
    }, [targetPeriodSec]);
    useEffect(() => {
        targetIntensityRef.current = torchOn ? 1 : 0;
    }, [torchOn]);

    useEffect(() => {
        let mounted = true;
        const loop = (ts) => {
            if (!mounted) return;
            if (lastTsRef.current == null) lastTsRef.current = ts;
            const dt = Math.min(0.2, (ts - lastTsRef.current) / 1000);
            lastTsRef.current = ts;

            // Time-constant for smoothing (seconds). Smaller => snappier.
            const tau = 0.35;
            const alpha = 1 - Math.exp(-dt / tau);
            setSmoothPeriod((p) => p + (targetRef.current - p) * alpha);

            // Torch intensity smoothing + subtle flicker when on
            const tauI = 0.25;
            const alphaI = 1 - Math.exp(-dt / tauI);
            setSmoothIntensity(
                (i) => i + (targetIntensityRef.current - i) * alphaI
            );
            phaseRef.current += dt * 18; // flicker speed
            rafIdRef.current = requestAnimationFrame(loop);
        };
        rafIdRef.current = requestAnimationFrame(loop);
        return () => {
            mounted = false;
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
            lastTsRef.current = null;
        };
    }, []);

    // Run animation while running, or if we are still easing toward target (residual motion)
    const stillEasing = Math.abs(smoothPeriod - targetPeriodSec) > 0.01;
    const playState =
        running && (speedKmh > 0 || stillEasing) ? "running" : "paused";
    return (
        <svg
            className={className}
            width="360"
            height="200"
            viewBox="0 0 360 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Wheels */}
            <circle
                cx="80"
                cy="140"
                r="48"
                className="stroke-neon-blue/70"
                strokeWidth="4"
            />
            <circle
                cx="280"
                cy="140"
                r="48"
                className="stroke-neon-blue/70"
                strokeWidth="4"
            />

            {/* Spokes (rotate) */}
            <g
                className="origin-[80px_140px] animate-spin"
                style={{
                    animationDuration: `${smoothPeriod}s`,
                    animationTimingFunction: "linear",
                    animationIterationCount: "infinite",
                    animationPlayState: playState,
                }}
            >
                <line
                    x1="80"
                    y1="92"
                    x2="80"
                    y2="188"
                    className="stroke-neon-green/70"
                    strokeWidth="3"
                />
                <line
                    x1="32"
                    y1="140"
                    x2="128"
                    y2="140"
                    className="stroke-neon-green/70"
                    strokeWidth="3"
                />
            </g>
            <g
                className="origin-[280px_140px] animate-spin"
                style={{
                    animationDuration: `${smoothPeriod}s`,
                    animationTimingFunction: "linear",
                    animationIterationCount: "infinite",
                    animationPlayState: playState,
                }}
            >
                <line
                    x1="280"
                    y1="92"
                    x2="280"
                    y2="188"
                    className="stroke-neon-green/70"
                    strokeWidth="3"
                />
                <line
                    x1="232"
                    y1="140"
                    x2="328"
                    y2="140"
                    className="stroke-neon-green/70"
                    strokeWidth="3"
                />
            </g>

            {/* Frame */}
            <path
                d="M80 140 L140 100 L200 140 L280 140 L230 80 L160 80 L140 100"
                className="stroke-neon-pink/80"
                strokeWidth="4"
            />
            <circle cx="140" cy="100" r="6" className="fill-neon-blue" />
            <circle cx="200" cy="140" r="6" className="fill-neon-blue" />
            <circle cx="230" cy="80" r="6" className="fill-neon-blue" />

            {/* Handlebar and seat */}
            <line
                x1="230"
                y1="80"
                x2="255"
                y2="70"
                className="stroke-neon-pink"
                strokeWidth="4"
            />
            <line
                x1="140"
                y1="100"
                x2="130"
                y2="80"
                className="stroke-neon-pink"
                strokeWidth="4"
            />

            {/* Pedal crank */}
            <g
                className="origin-[200px_140px] animate-spin"
                style={{
                    animationDuration: `${smoothPeriod}s`,
                    animationTimingFunction: "linear",
                    animationIterationCount: "infinite",
                    animationPlayState: playState,
                }}
            >
                <line
                    x1="200"
                    y1="140"
                    x2="220"
                    y2="140"
                    className="stroke-neon-green"
                    strokeWidth="4"
                />
                <circle cx="220" cy="140" r="5" className="fill-neon-green" />
            </g>

            {/* Torch beam and glow (headlight near handlebar end ~ (255,70)) */}
            {smoothIntensity > 0.001 && (
                <g style={{ mixBlendMode: "screen" }}>
                    {(() => {
                        const flicker =
                            0.92 + 0.08 * Math.sin(phaseRef.current);
                        const a = Math.max(
                            0,
                            Math.min(1, smoothIntensity * flicker)
                        );
                        const beamAlpha = 0.55 * a;
                        const haloAlpha = 0.25 * a;
                        return (
                            <>
                                {/* Beam cone */}
                                <polygon
                                    points={`255,70 360,40 360,100`}
                                    fill="rgba(255, 240, 170, 1)"
                                    opacity={beamAlpha}
                                />
                                {/* Near lamp circular glow */}
                                <circle
                                    cx="255"
                                    cy="70"
                                    r="18"
                                    fill="rgba(255, 220, 150, 1)"
                                    opacity={haloAlpha}
                                />
                                <circle
                                    cx="255"
                                    cy="70"
                                    r="8"
                                    fill="rgba(255, 240, 180, 1)"
                                    opacity={Math.min(1, a)}
                                />
                            </>
                        );
                    })()}
                </g>
            )}
        </svg>
    );
}

function Modal({
    open,
    onClose,
    title,
    children,
    footer,
    dialogClassName = "",
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />
            <div
                className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-800/95 p-6 shadow-xl ring-1 ring-white/10 transition-all ${
                    dialogClassName || "max-w-md"
                }`}
            >
                <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-semibold text-white">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-md px-2 py-1 text-slate-300 hover:text-white"
                    >
                        ✕
                    </button>
                </div>
                <div className="mt-4 text-slate-200">{children}</div>
                {footer ? (
                    <div className="mt-6 flex justify-end gap-3">{footer}</div>
                ) : null}
            </div>
        </div>
    );
}

function Section({ id, className = "", children }) {
    return (
        <section id={id} className={`relative py-20 sm:py-28 ${className}`}>
            <div className="absolute inset-0 -z-10 neon-gradient bg-grid" />
            <div className="container mx-auto max-w-6xl px-6">{children}</div>
        </section>
    );
}

export default function App() {
    const heroRef = useRef(null);
    const headerRef = useRef(null);
    const [offset, setOffset] = useState(0);
    const [planModalOpen, setPlanModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [planPurchased, setPlanPurchased] = useState(false);
    const [planSuccess, setPlanSuccess] = useState(false);
    const [integrationModalOpen, setIntegrationModalOpen] = useState(false);
    const [ensyncLoading, setEnsyncLoading] = useState(false);
    const [ensyncUrl, setEnsyncUrl] = useState(null);
    const [sessionId, setSessionId] = useState("");
    const prevSelectedPlanRef = useRef(null);
    const bikeRef = useRef(null);
    const [simData, setSimData] = useState(null); // { x, y, speedKmh, speedMps, headingDeg, torchOn }
    const [simControls, setSimControls] = useState(null);
    const socketRef = useRef(null);
    const prevPosRef = useRef(null); // string key: "x,y" rounded
    const prevSpeedRef = useRef(null); // number rounded
    const prevTorchRef = useRef(null); // boolean
    const prevBatteryRef = useRef(null); // number rounded to 1dp
    const prevBatteryDistRef = useRef(null); // number rounded to 2dp
    const prevTyrePsiRef = useRef(null); // number rounded to 1dp

    // Plan helpers
    const planTier = planPurchased
        ? (selectedPlan || "").toLowerCase() === "pro"
            ? "pro"
            : "basic"
        : "demo"; // before purchase, show all as demo
    const showByPlan = {
        gps: planTier === "demo" || planTier === "pro" || planTier === "basic",
        speed:
            planTier === "demo" || planTier === "pro" || planTier === "basic",
        torch:
            planTier === "demo" || planTier === "pro" || planTier === "basic",
        battery: planTier === "demo" || planTier === "pro",
        batteryDistance: planTier === "demo" || planTier === "pro",
        tyrePressure: planTier === "demo" || planTier === "pro",
        simulator:
            planTier === "demo" || planTier === "pro" || planTier === "basic",
    };

    // Smooth scroll helper with header offset
    const scrollToId = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const headerH = headerRef.current?.offsetHeight ?? 72;
        const top =
            el.getBoundingClientRect().top + window.scrollY - headerH - 8;
        window.scrollTo({ top, behavior: "smooth" });
    };

    const scrollToBike = () => {
        const el = bikeRef.current;
        if (!el) return;
        const headerH = headerRef.current?.offsetHeight ?? 72;
        const rect = el.getBoundingClientRect();
        const top = rect.top + window.scrollY - headerH - 12;
        window.scrollTo({ top, behavior: "smooth" });
    };

    useEffect(() => {
        const onScroll = () => {
            const y = window.scrollY || 0;
            setOffset(y);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Socket.IO connection
    useEffect(() => {
        socketRef.current = io("http://localhost:4000");

        socketRef.current.on("connect", () => {
            console.log("Connected to server:", socketRef.current.id);
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    // Send position when it changes (rounded to 2dp to reduce noise)
    useEffect(() => {
        if (!socketRef.current || !simData) return;
        const x = Number.isFinite(simData.x)
            ? Number(simData.x.toFixed(2))
            : null;
        const y = Number.isFinite(simData.y)
            ? Number(simData.y.toFixed(2))
            : null;
        if (x == null || y == null) return;
        const key = `${x},${y}`;
        if (prevPosRef.current !== key) {
            prevPosRef.current = key;
            socketRef.current.emit("bike_gps", { x, y, timestamp: Date.now() });
        }
    }, [simData?.x, simData?.y]);

    // Send speed when it changes (rounded to 1dp)
    useEffect(() => {
        if (!socketRef.current || !simData) return;
        const speed = Number.isFinite(simData.speedKmh)
            ? Number(simData.speedKmh.toFixed(1))
            : null;
        if (speed == null) return;
        if (prevSpeedRef.current !== speed) {
            prevSpeedRef.current = speed;
            socketRef.current.emit("bike_speed", {
                speed,
                timestamp: Date.now(),
            });
        }
    }, [simData?.speedKmh]);

    // Send torch state when it changes
    useEffect(() => {
        if (!socketRef.current || !simData) return;
        if (!showByPlan.torch) return; // gate emit by plan
        const torchOn = !!simData.torchOn;
        if (prevTorchRef.current !== torchOn) {
            prevTorchRef.current = torchOn;
            socketRef.current.emit("bike_torch", {
                torchOn,
                timestamp: Date.now(),
            });
        }
    }, [simData?.torchOn, showByPlan.torch]);

    // Send battery level when it changes (rounded to 1dp)
    useEffect(() => {
        if (!socketRef.current || !simData) return;
        if (!showByPlan.battery) return; // gate emit by plan
        const battery = Number.isFinite(simData.batteryLevel)
            ? Number(simData.batteryLevel.toFixed(1))
            : null;
        if (battery == null) return;
        if (prevBatteryRef.current !== battery) {
            prevBatteryRef.current = battery;
            socketRef.current.emit("bike_battery", {
                battery,
                timestamp: Date.now(),
            });
        }
    }, [simData?.batteryLevel, showByPlan.battery]);

    // Send distance covered on current battery when it changes (rounded to 2dp km)
    useEffect(() => {
        if (!socketRef.current || !simData) return;
        if (!showByPlan.batteryDistance) return; // gate emit by plan
        const distKm = Number.isFinite(simData.distanceByBatteryKm)
            ? Number(simData.distanceByBatteryKm.toFixed(2))
            : null;
        if (distKm == null) return;
        if (prevBatteryDistRef.current !== distKm) {
            prevBatteryDistRef.current = distKm;
            socketRef.current.emit("bike_battery_distance", {
                distanceKm: distKm,
                timestamp: Date.now(),
            });
        }
    }, [simData?.distanceByBatteryKm, showByPlan.batteryDistance]);

    // Send tyre pressure changes (rounded to 1dp)
    useEffect(() => {
        if (!socketRef.current || !simData) return;
        if (!showByPlan.tyrePressure) return; // gate emit by plan
        const psi = Number.isFinite(simData.tyrePressurePsi)
            ? Number(simData.tyrePressurePsi.toFixed(1))
            : null;
        if (psi == null) return;
        if (prevTyrePsiRef.current !== psi) {
            prevTyrePsiRef.current = psi;
            socketRef.current.emit("bike_tyre_pressure", {
                psi,
                timestamp: Date.now(),
            });
        }
    }, [simData?.tyrePressurePsi, showByPlan.tyrePressure]);

    // Init session id & plan from localStorage
    useEffect(() => {
        const key = "trackpedal_session_id";
        const sid = localStorage.getItem(key);
        if (sid) setSessionId(sid);

        // restore plan info
        try {
            const storedPlan = localStorage.getItem("trackpedal_selected_plan");
            const storedPurchased = localStorage.getItem(
                "trackpedal_plan_purchased"
            );
            const storedSuccess = localStorage.getItem(
                "trackpedal_plan_success"
            );
            if (storedPlan) setSelectedPlan(storedPlan);
            if (storedPurchased != null)
                setPlanPurchased(storedPurchased === "true");
            if (storedSuccess != null) setPlanSuccess(storedSuccess === "true");
        } catch (e) {
            console.warn("Failed to restore plan from localStorage", e);
        }
    }, []);

    const generateSessionId = () => {
        // Simple random session id
        const rnd = Math.random().toString(36).slice(2);
        const ts = Date.now().toString(36);
        return `sess_${ts}_${rnd}`;
    };

    const regenerateSession = () => {
        const key = "trackpedal_session_id";
        const sid = generateSessionId();
        localStorage.setItem(key, sid);
        setSessionId(sid);
        setEnsyncUrl(null);
    };

    // Persist plan info when it changes
    useEffect(() => {
        try {
            if (selectedPlan != null)
                localStorage.setItem(
                    "trackpedal_selected_plan",
                    String(selectedPlan)
                );
            localStorage.setItem(
                "trackpedal_plan_purchased",
                String(!!planPurchased)
            );
            localStorage.setItem(
                "trackpedal_plan_success",
                String(!!planSuccess)
            );
        } catch (e) {
            console.warn("Failed to persist plan to localStorage", e);
        }
    }, [selectedPlan, planPurchased, planSuccess]);

    // Regenerate session when plan changes (ignore initial load)
    useEffect(() => {
        if (
            prevSelectedPlanRef.current !== null &&
            prevSelectedPlanRef.current !== selectedPlan
        ) {
            regenerateSession();
        }
        prevSelectedPlanRef.current = selectedPlan;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPlan]);

    // When a plan is purchased, auto-scroll to the bike section.
    useEffect(() => {
        if (planPurchased) {
            setTimeout(() => {
                scrollToBike();
            }, 100);
        }
    }, [planPurchased]);

    return (
        <div className="relative min-h-full">
            {/* Navigation */}
            <header
                ref={headerRef}
                className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur"
            >
                <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
                    <a
                        href="#hero"
                        className="text-lg font-semibold tracking-wide text-white"
                    >
                        <span className="text-neon-blue">Track</span>
                        <span className="text-neon-pink">Pedal</span>
                    </a>
                    <div className="hidden gap-6 sm:flex">
                        <a
                            href="#features"
                            className="text-slate-300 hover:text-white transition-colors"
                        >
                            Features
                        </a>
                        <a
                            href="#pricing"
                            className="text-slate-300 hover:text-white transition-colors"
                        >
                            Pricing
                        </a>
                        <a
                            href="#community"
                            className="text-slate-300 hover:text-white transition-colors"
                        >
                            Community
                        </a>
                    </div>
                    <div className="hidden sm:flex gap-3">
                        <a
                            href="#events"
                            className="rounded-md border border-neon-blue/50 px-4 py-2 text-neon-blue hover:shadow-glow transition-all"
                        >
                            Join an Event
                        </a>
                        <a
                            href="#pricing"
                            className="rounded-md bg-neon-pink/20 px-4 py-2 text-neon-pink ring-1 ring-neon-pink/40 hover:shadow-glow transition-all"
                        >
                            Subscribe
                        </a>
                    </div>
                </nav>
            </header>

            {/* Hero */}
            <Section
                id="hero"
                className="pt-36 pb-24 sm:pt-40 particles overflow-hidden"
                ref={heroRef}
            >
                <div className="mx-auto max-w-5xl text-center">
                    <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-tight">
                        Ride the <span className="text-neon-blue">Future</span>{" "}
                        of Cycling
                    </h1>
                    <p className="mt-4 text-slate-300 text-base sm:text-lg">
                        TrackPedal blends precision GPS, real-time speed
                        metrics, and live event integration into a seamless
                        cycling experience.
                    </p>

                    {/* Animated Bike */}
                    <div
                        className="relative mt-12 flex justify-center"
                        style={{
                            transform: `translateY(${-(offset * 0.05)}px)`,
                        }}
                    >
                        <div
                            className="absolute -inset-x-32 -top-32 -bottom-24 blur-3xl opacity-70"
                            aria-hidden
                        >
                            <div className="h-full w-full bg-gradient-to-r from-neon-blue/20 via-neon-pink/20 to-neon-green/20" />
                        </div>
                    </div>

                    {/* CTA Buttons */}
                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a
                            href="#events"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToId("events");
                            }}
                            className="w-full sm:w-auto rounded-lg bg-neon-blue/20 px-6 py-3 text-neon-blue ring-1 ring-neon-blue/40 hover:shadow-glow transition-all"
                        >
                            Join an Event
                        </a>
                        <a
                            href="#pricing"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToId("pricing");
                            }}
                            className="w-full sm:w-auto rounded-lg bg-neon-pink/20 px-6 py-3 text-neon-pink ring-1 ring-neon-pink/40 hover:shadow-glow transition-all"
                        >
                            Subscribe
                        </a>
                    </div>
                </div>
            </Section>

            {/* Features / Event Integration */}
            <Section id="features" className="pt-16">
                <div
                    id="events"
                    className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {/* GPS Coordinates */}
                    {showByPlan.gps && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 hover:translate-y-[-2px] hover:shadow-glow transition-all">
                            <div className="text-slate-400 text-sm">
                                GPS Coordinates
                            </div>
                            <div className="mt-2 text-2xl font-mono">
                                {simData
                                    ? `${simData.x.toFixed(
                                          2
                                      )}, ${simData.y.toFixed(2)}`
                                    : "--.----, --.----"}
                            </div>
                            <div className="mt-3 text-xs text-slate-400">
                                Torch: {simData?.torchOn ? "On" : "Off"}
                            </div>
                        </div>
                    )}
                    {/* Speed Monitor */}
                    {showByPlan.speed && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 hover:translate-y-[-2px] hover:shadow-glow transition-all">
                            <div className="text-slate-400 text-sm">Speed</div>
                            <div className="mt-2 text-2xl font-mono">
                                {simData
                                    ? `${simData.speedKmh.toFixed(1)} km/h`
                                    : "-- km/h"}
                            </div>
                            <div className="mt-1 text-sm font-mono text-slate-400">
                                {simData
                                    ? `${simData.speedMps.toFixed(2)} m/s`
                                    : ""}
                            </div>
                        </div>
                    )}
                    {/* Torch */}
                    {showByPlan.torch && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 hover:translate-y-[-2px] hover:shadow-glow transition-all">
                            <div className="text-slate-400 text-sm">Torch</div>
                            <div className="mt-2 text-2xl font-mono">
                                {simData?.torchOn ? "On" : "Off"}
                            </div>
                            <button
                                className={`mt-4 rounded-md px-3 py-2 ring-1 transition-all ${
                                    simData?.torchOn
                                        ? "bg-amber-300/20 text-amber-300 ring-amber-300/40"
                                        : "bg-slate-700/60 text-slate-300 ring-white/10"
                                }`}
                                onClick={() =>
                                    simControls?.setTorch?.(!simData?.torchOn)
                                }
                            >
                                Toggle Torch
                            </button>
                        </div>
                    )}
                    {/* Battery */}
                    {showByPlan.battery && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 hover:translate-y-[-2px] hover:shadow-glow transition-all">
                            <div className="text-slate-400 text-sm">
                                Battery
                            </div>
                            <div className="mt-2 text-2xl font-mono">
                                {simData
                                    ? `${simData.batteryLevel.toFixed(1)}%`
                                    : "--%"}
                            </div>
                            <button
                                className="mt-4 rounded-md px-3 py-2 text-slate-300 ring-1 ring-white/10 hover:text-white"
                                onClick={() => simControls?.resetBattery?.()}
                            >
                                Reset Battery
                            </button>
                        </div>
                    )}
                    {/* Distance on Battery */}
                    {showByPlan.batteryDistance && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 hover:translate-y-[-2px] hover:shadow-glow transition-all">
                            <div className="text-slate-400 text-sm">
                                Distance on Battery
                            </div>
                            <div className="mt-2 text-2xl font-mono">
                                {simData
                                    ? `${simData.distanceByBatteryKm.toFixed(
                                          2
                                      )} km`
                                    : "-- km"}
                            </div>
                        </div>
                    )}
                    {/* Tyre Pressure */}
                    {showByPlan.tyrePressure && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 hover:translate-y-[-2px] hover:shadow-glow transition-all">
                            <div className="text-slate-400 text-sm">
                                Tyre Pressure
                            </div>
                            <div className="mt-2 text-2xl font-mono">
                                {simData
                                    ? `${simData.tyrePressurePsi.toFixed(
                                          1
                                      )} psi`
                                    : "-- psi"}
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button
                                    className="rounded-md px-3 py-2 text-slate-300 ring-1 ring-white/10 hover:text-white"
                                    onClick={() =>
                                        simControls?.setTyrePressure?.(
                                            (simData?.tyrePressurePsi || 0) + 2
                                        )
                                    }
                                >
                                    +2 psi
                                </button>
                                <button
                                    className="rounded-md px-3 py-2 text-slate-300 ring-1 ring-white/10 hover:text-white"
                                    onClick={() =>
                                        simControls?.setTyrePressure?.(
                                            (simData?.tyrePressurePsi || 0) - 2
                                        )
                                    }
                                >
                                    -2 psi
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Simulator Control */}
                {showByPlan.simulator ? (
                    <div
                        ref={bikeRef}
                        className="mt-6 flex items-center justify-center"
                    >
                        <BikeSVG
                            className={`relative drop-shadow-[0_0_20px_rgba(0,229,255,0.35)] ${
                                simData?.running
                                    ? "animate-none"
                                    : "animate-none"
                            }`}
                            running={!!simData?.running}
                            speedKmh={simData?.speedKmh ?? 0}
                            torchOn={!!simData?.torchOn}
                        />
                        <BicycleSimulator
                            onTick={(d) => setSimData(d)}
                            tickMs={250}
                            initialSpeedKmh={18}
                            registerControls={(c) => setSimControls(c)}
                            showBatteryControls={showByPlan.battery}
                            showTyreControls={showByPlan.tyrePressure}
                            className="max-w-2xl mx-auto"
                        />
                    </div>
                ) : (
                    <div className="mt-8 flex flex-col items-center justify-center text-center rounded-xl border border-white/10 bg-white/5 p-8">
                        <div className="text-slate-300">
                            Simulator is available on the Pro plan.
                        </div>
                        <a
                            href="#pricing"
                            onClick={(e) => {
                                e.preventDefault();
                                const el = document.getElementById("pricing");
                                if (el)
                                    el.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="mt-3 rounded-md bg-neon-pink/20 px-4 py-2 text-neon-pink ring-1 ring-neon-pink/40 hover:shadow-glow"
                        >
                            Upgrade to Pro
                        </a>
                    </div>
                )}

                {/* Integration CTA (shown after plan purchase) */}
                {(planPurchased || !!sessionId) && (
                    <div className="mt-6 flex justify-center">
                        <button
                            className="rounded-md bg-neon-blue/20 px-5 py-2 text-neon-blue ring-1 ring-neon-blue/40 hover:shadow-glow transition-all"
                            onClick={() => setIntegrationModalOpen(true)}
                        >
                            Connect Integrations
                        </button>
                    </div>
                )}
            </Section>

            {/* Integrations Modal */}
            <Modal
                open={integrationModalOpen}
                onClose={() => {
                    setIntegrationModalOpen(false);
                    setEnsyncLoading(false);
                    setEnsyncUrl(null);
                }}
                title="Connect Integrations"
                dialogClassName="max-w-lg"
                footer={
                    <>
                        <button
                            className="rounded-md px-4 py-2 text-slate-200 ring-1 ring-white/10 hover:text-white"
                            onClick={() => {
                                setIntegrationModalOpen(false);
                                setEnsyncLoading(false);
                                setEnsyncUrl(null);
                            }}
                        >
                            Close
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    {!ensyncUrl ? (
                        <>
                            <p className="text-slate-300">
                                Connect EnSync to relay your simulated bike
                                events. Your plan:{" "}
                                {planPurchased
                                    ? (selectedPlan || "").toString()
                                    : ""}
                                .
                            </p>
                            <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 p-4">
                                <div>
                                    <div className="font-medium">EnSync</div>
                                    <div className="text-xs text-slate-400">
                                        Event-driven Synchronization Engine
                                    </div>
                                    <div className="mt-2 text-xs text-slate-400">
                                        Session:{" "}
                                        <span className="font-mono text-slate-300">
                                            {sessionId}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    className={`rounded-md px-4 py-2 ring-1 transition-all ${
                                        ensyncLoading
                                            ? "bg-slate-700/60 text-slate-400 ring-white/10 cursor-not-allowed"
                                            : "bg-neon-blue/20 text-neon-blue ring-neon-blue/40 hover:shadow-glow"
                                    }`}
                                    disabled={ensyncLoading}
                                    onClick={async () => {
                                        try {
                                            setEnsyncLoading(true);
                                            // Ensure we have a session id
                                            let sid = sessionId;
                                            if (!sid) {
                                                sid = generateSessionId();
                                                localStorage.setItem(
                                                    "trackpedal_session_id",
                                                    sid
                                                );
                                                setSessionId(sid);
                                            }
                                            const plan =
                                                planTier === "pro"
                                                    ? "pro"
                                                    : "basic";
                                            const res = await fetch(
                                                `http://localhost:4000/api/ensync/connect/${plan}?session=${encodeURIComponent(
                                                    sid
                                                )}`
                                            );
                                            const data = await res.json();
                                            setEnsyncUrl(data?.url || "");
                                        } catch (e) {
                                            console.error(
                                                "Failed to fetch EnSync URL",
                                                e
                                            );
                                        } finally {
                                            setEnsyncLoading(false);
                                        }
                                    }}
                                >
                                    {ensyncLoading
                                        ? "Connecting..."
                                        : "Connect"}
                                </button>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    className="mt-2 rounded-md px-3 py-1 text-slate-200 ring-1 ring-white/10 hover:text-white"
                                    onClick={regenerateSession}
                                >
                                    Regenerate Session
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-lg overflow-hidden border border-white/10 w-full">
                            <iframe
                                title="EnSync Connect"
                                src={ensyncUrl}
                                className="w-full"
                                style={{ height: 520}}
                            />
                        </div>
                    )}
                </div>
            </Modal>

            {/* Pricing */}
            <Section id="pricing" className="pt-10">
                <h2 className="text-2xl sm:text-4xl font-semibold text-center">
                    Pricing
                </h2>
                <p className="mt-3 text-center text-slate-300">
                    Choose the plan that fits your ride.
                </p>
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Basic */}
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8">
                        <div className="absolute -top-32 -right-20 h-56 w-56 rounded-full bg-neon-blue/10 blur-3xl" />
                        <h3 className="text-xl font-semibold">Basic</h3>
                        <p className="mt-2 text-slate-300">
                            Access to a few events.
                        </p>
                        <div className="mt-6 text-4xl font-bold">
                            $9
                            <span className="text-base font-normal text-slate-400">
                                /mo
                            </span>
                        </div>
                        <ul className="mt-6 space-y-2 text-slate-300">
                            <li>• GPS Coordinates</li>
                            <li>• Speed</li>
                            <li>• Torch</li>
                            <li>• Email support</li>
                        </ul>
                        <button
                            onClick={() => {
                                setSelectedPlan("Basic");
                                setPlanSuccess(false);
                                setPlanModalOpen(true);
                                // Send plan selection event
                                if (socketRef.current) {
                                    socketRef.current.emit("plan_selected", {
                                        plan: "Basic",
                                        price: 9,
                                        timestamp: Date.now(),
                                    });
                                }
                            }}
                            className="mt-8 inline-block rounded-md bg-neon-blue/20 px-4 py-2 text-neon-blue ring-1 ring-neon-blue/40 hover:shadow-glow transition-all"
                        >
                            Get Basic
                        </button>
                    </div>
                    {/* Pro */}
                    <div className="relative overflow-hidden rounded-2xl border border-neon-pink/30 bg-white/10 p-8 ring-1 ring-neon-pink/30">
                        <div className="absolute -top-32 -left-20 h-56 w-56 rounded-full bg-neon-pink/10 blur-3xl" />
                        <h3 className="text-xl font-semibold">Pro</h3>
                        <p className="mt-2 text-slate-300">
                            Full access to all events.
                        </p>
                        <div className="mt-6 text-4xl font-bold">
                            $19
                            <span className="text-base font-normal text-slate-400">
                                /mo
                            </span>
                        </div>
                        <ul className="mt-6 space-y-2 text-slate-300">
                            <li>• GPS Coordinates</li>
                            <li>• Speed</li>
                            <li>• Torch</li>
                            <li>• Battery</li>
                            <li>• Distance on Battery</li>
                            <li>• Tyre Pressure</li>
                            <li>• Simulator access</li>
                            <li>• Priority support</li>
                        </ul>
                        <button
                            onClick={() => {
                                setSelectedPlan("Pro");
                                setPlanSuccess(false);
                                setPlanModalOpen(true);
                                // Send plan selection event
                                if (socketRef.current) {
                                    socketRef.current.emit("plan_selected", {
                                        plan: "Pro",
                                        price: 19,
                                        timestamp: Date.now(),
                                    });
                                }
                            }}
                            className="mt-8 inline-block rounded-md bg-neon-pink/20 px-4 py-2 text-neon-pink ring-1 ring-neon-pink/40 hover:shadow-glow transition-all"
                        >
                            Get Pro
                        </button>
                    </div>
                </div>
            </Section>

            {/* Community / Testimonials */}
            <Section id="community">
                <h2 className="text-2xl sm:text-4xl font-semibold text-center">
                    Cyclists Love TrackPedal
                </h2>
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        {
                            quote: "The real-time metrics changed how I train. The UI feels like sci-fi.",
                            name: "Ava M.",
                        },
                        {
                            quote: "Seamless event integration. I always know where my team is.",
                            name: "Noah R.",
                        },
                        {
                            quote: "The glow aesthetics are gorgeous, and the data is spot on.",
                            name: "Liam P.",
                        },
                    ].map((t, i) => (
                        <div
                            key={i}
                            className="rounded-xl border border-white/10 bg-white/5 p-6 hover:translate-y-[-2px] hover:shadow-glow transition-all"
                        >
                            <p className="text-slate-200">“{t.quote}”</p>
                            <div className="mt-4 text-sm text-slate-400">
                                — {t.name}
                            </div>
                        </div>
                    ))}
                </div>
            </Section>

            {/* Footer */}
            <footer className="border-t border-white/10 py-10">
                <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-slate-400">
                        © {new Date().getFullYear()} TrackPedal
                    </div>
                    <div className="flex gap-6 text-slate-400">
                        <a
                            href="#features"
                            className="hover:text-white transition-colors"
                        >
                            Features
                        </a>
                        <a
                            href="#pricing"
                            className="hover:text-white transition-colors"
                        >
                            Pricing
                        </a>
                        <a
                            href="#community"
                            className="hover:text-white transition-colors"
                        >
                            Community
                        </a>
                    </div>
                </div>
            </footer>

            {/* Plan Modal */}
            <Modal
                open={planModalOpen}
                onClose={() => setPlanModalOpen(false)}
                title={
                    planSuccess
                        ? "Success"
                        : `Confirm ${selectedPlan || ""} Plan`
                }
                footer={
                    planSuccess ? (
                        <button
                            className="rounded-md bg-neon-green/20 px-4 py-2 text-neon-green ring-1 ring-neon-green/40 hover:shadow-glow"
                            onClick={() => {
                                setPlanModalOpen(false);
                                setTimeout(() => {
                                    scrollToBike();
                                }, 80);
                            }}
                        >
                            Continue
                        </button>
                    ) : (
                        <>
                            <button
                                className="rounded-md border border-white/20 px-4 py-2 text-slate-300 hover:text-white"
                                onClick={() => setPlanModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="rounded-md bg-neon-blue/20 px-4 py-2 text-neon-blue ring-1 ring-neon-blue/40 hover:shadow-glow"
                                onClick={() => {
                                    setPlanPurchased(true);
                                    setPlanSuccess(true);
                                    // Send plan purchase event
                                    if (socketRef.current) {
                                        socketRef.current.emit(
                                            "plan_purchased",
                                            {
                                                plan: selectedPlan,
                                                userId: socketRef.current.id,
                                                timestamp: Date.now(),
                                            }
                                        );
                                    }
                                }}
                            >
                                Confirm
                            </button>
                        </>
                    )
                }
            >
                {planSuccess ? (
                    <div className="flex flex-col items-center text-center">
                        <div className="relative mb-4 h-16 w-16">
                            <span className="absolute inset-0 rounded-full bg-neon-green/20 animate-ping" />
                            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-neon-green/20 ring-1 ring-neon-green/40 shadow-glow">
                                <svg
                                    width="28"
                                    height="28"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    className="text-neon-green"
                                >
                                    <path
                                        d="M20 6L9 17L4 12"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </span>
                        </div>
                        <h4 className="text-xl font-semibold">
                            {selectedPlan} plan activated
                        </h4>
                        <p className="mt-2 text-slate-300">
                            You now have access; proceed to integrations to
                            connect your data sources.
                        </p>
                    </div>
                ) : (
                    <>
                        <p>
                            You're about to subscribe to the{" "}
                            <span className="text-white font-semibold">
                                {selectedPlan}
                            </span>{" "}
                            plan.
                        </p>
                        <p className="mt-2 text-slate-400 text-sm">
                            This is a demo modal. No payment will be processed.
                        </p>
                    </>
                )}
            </Modal>

            {/* Integration removed */}
        </div>
    );
}
