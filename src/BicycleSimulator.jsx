import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

/**
 * BicycleSimulator
 * - Start/Stop simulation
 * - Adjustable speed (km/h)
 * - Torch On/Off
 * - Emits frequent x,y coordinates via onTick while running
 * - Provides realistic-ish motion: smooth heading drift + slight noise
 */
export default function BicycleSimulator({
    onTick,
    tickMs = 250,
    initialSpeedKmh = 18,
    className = "",
    registerControls,
    autoStart = true,
    showBatteryControls = true,
    showTyreControls = true,
}) {
    const [running, setRunning] = useState(!!autoStart);
    const [speedKmh, setSpeedKmh] = useState(initialSpeedKmh);
    const [torchOn, setTorchOn] = useState(false);
    const [headingDeg, setHeadingDeg] = useState(0); // 0 = east
    const [pos, setPos] = useState({ x: 0, y: 0 });
    // New simulated metrics
    const [batteryLevel, setBatteryLevel] = useState(100); // percent
    const [distanceByBatteryKm, setDistanceByBatteryKm] = useState(0); // km since last full battery
    const [tyrePressurePsi, setTyrePressurePsi] = useState(85); // psi

    const lastTickRef = useRef(performance.now());
    const driftRef = useRef({ target: 0, t: 0 });
    const headingRef = useRef(0);
    const posRef = useRef({ x: 0, y: 0 });
    const speedKmhRef = useRef(initialSpeedKmh);
    const torchRef = useRef(false);
    const runningRef = useRef(!!autoStart);
    const batteryRef = useRef(100);
    const distanceBatteryRef = useRef(0);
    const tyrePressureRef = useRef(85);

    // Convert km/h to m/s
    const speedMps = useMemo(() => (speedKmh * 1000) / 3600, [speedKmh]);
    const onTickRef = useRef(onTick);
    useEffect(() => {
        onTickRef.current = onTick;
    }, [onTick]);

    // Keep refs in sync so the loop reads the latest values without re-subscribing
    useEffect(() => {
        headingRef.current = headingDeg;
    }, [headingDeg]);
    useEffect(() => {
        posRef.current = pos;
    }, [pos]);
    useEffect(() => {
        speedKmhRef.current = speedKmh;
    }, [speedKmh]);
    useEffect(() => {
        torchRef.current = torchOn;
    }, [torchOn]);
    useEffect(() => {
        batteryRef.current = batteryLevel;
    }, [batteryLevel]);
    useEffect(() => {
        distanceBatteryRef.current = distanceByBatteryKm;
    }, [distanceByBatteryKm]);
    useEffect(() => {
        tyrePressureRef.current = tyrePressurePsi;
    }, [tyrePressurePsi]);
    useEffect(() => {
        runningRef.current = running;
        // Emit a snapshot immediately when running state changes so parent can react (e.g., pause bike anim)
        onTickRef.current?.({
            x: posRef.current.x,
            y: posRef.current.y,
            speedKmh: speedKmhRef.current,
            speedMps: (speedKmhRef.current * 1000) / 3600,
            headingDeg: headingRef.current,
            torchOn: torchRef.current,
            running: runningRef.current,
            batteryLevel: batteryRef.current,
            distanceByBatteryKm: distanceBatteryRef.current,
            tyrePressurePsi: tyrePressureRef.current,
            timestamp: Date.now(),
        });
    }, [running]);

    const reset = useCallback(() => {
        setPos({ x: 0, y: 0 });
        setHeadingDeg(0);
    }, []);

    const randomizeDrift = useCallback(() => {
        // pick a new drift target for heading (-8..+8 deg) every few seconds
        driftRef.current.target = Math.random() * 16 - 8;
        driftRef.current.t = 0;
    }, []);

    useEffect(() => {
        const id = setInterval(randomizeDrift, 4000);
        randomizeDrift();
        return () => clearInterval(id);
    }, [randomizeDrift]);

    // Expose controls to parent if requested
    useEffect(() => {
        if (!registerControls) return;
        const controls = {
            setTorch: (on) => setTorchOn(!!on),
            resetBattery: () => {
                setBatteryLevel(100);
                setDistanceByBatteryKm(0);
            },
            setTyrePressure: (psi) => {
                const v = Math.max(40, Math.min(120, Number(psi) || 0));
                setTyrePressurePsi(v);
            },
        };
        registerControls(controls);
        // no cleanup necessary; parent can overwrite on re-render
    }, [registerControls]);

    useEffect(() => {
        if (!running) return;

        let cancelled = false;

        const loop = () => {
            if (cancelled) return;
            const now = performance.now();
            const dt = Math.min(1, (now - lastTickRef.current) / 1000); // seconds, clamped
            lastTickRef.current = now;

            // Smoothly approach drift target
            driftRef.current.t = Math.min(1, driftRef.current.t + dt / 3); // ~3s ease
            const drift = driftRef.current.target * easeInOutCubic(driftRef.current.t);

            // Add tiny noise to mimic wobble
            const noise = (Math.random() - 0.5) * 0.8;

            const currentHeading = headingRef.current;
            const newHeading = wrapDeg(currentHeading + drift * dt + noise * dt);
            const currentSpeedMps = (speedKmhRef.current * 1000) / 3600;
            const distance = currentSpeedMps * dt; // meters
            const rad = (newHeading * Math.PI) / 180;
            const dx = Math.cos(rad) * distance;
            const dy = Math.sin(rad) * distance;

            // Battery consumption proportional to distance; accumulate distance on current battery
            // 0.001% per meter => ~10% per 10km
            const batteryDropPct = distance * 0.001;
            setBatteryLevel((b) => {
                const nb = Math.max(0, Math.min(100, b - batteryDropPct));
                batteryRef.current = nb;
                return nb;
            });
            setDistanceByBatteryKm((d) => {
                const nd = d + distance / 1000;
                distanceBatteryRef.current = nd;
                return nd;
            });

            setHeadingDeg(newHeading);
            setPos((p) => {
                const next = { x: p.x + dx, y: p.y + dy };
                posRef.current = next;
                // Emit with fresh values
                onTickRef.current?.({
                    x: next.x,
                    y: next.y,
                    speedKmh: speedKmhRef.current,
                    speedMps: currentSpeedMps,
                    headingDeg: newHeading,
                    torchOn: torchRef.current,
                    running: runningRef.current,
                    batteryLevel: batteryRef.current,
                    distanceByBatteryKm: distanceBatteryRef.current,
                    tyrePressurePsi: tyrePressureRef.current,
                    timestamp: Date.now(),
                });
                return next;
            });

            headingRef.current = newHeading;
            setTimeout(loop, tickMs);
        };

        const id = setTimeout(loop, tickMs);
        return () => {
            cancelled = true;
            clearTimeout(id);
        };
    }, [running, tickMs])

    return (
        <div
            className={`rounded-xl border border-white/10 bg-white/5 w-full p-4 ${className}`}
        >
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm text-slate-400">
                        Bicycle Simulator
                    </div>
                    <div className="text-lg font-semibold">
                        {running ? "Running" : "Stopped"}
                    </div>
                </div>
                <button
                    className={`rounded-md px-3 py-2 ring-1 transition-all ${
                        running
                            ? "bg-neon-pink/20 text-neon-pink ring-neon-pink/40 hover:shadow-glow"
                            : "bg-neon-green/20 text-neon-green ring-neon-green/40 hover:shadow-glow"
                    }`}
                    onClick={() => {
                        if (!running) {
                            lastTickRef.current = performance.now();
                        }
                        setRunning((r) => !r);
                    }}
                >
                    {running ? "Stop" : "Start"}
                </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-slate-300 text-sm">
                <div className="col-span-2">
                    <label className="mb-1 block text-xs text-slate-400">
                        Speed (km/h)
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={0}
                            max={50}
                            step={1}
                            value={Math.round(speedKmh)}
                            onChange={(e) =>
                                setSpeedKmh(Number(e.target.value))
                            }
                            className="w-full"
                        />
                        <div className="w-12 text-right tabular-nums">
                            {Math.round(speedKmh)}
                        </div>
                    </div>
                </div>
                <div>
                    <div className="text-xs text-slate-400">Heading</div>
                    <div className="font-mono tabular-nums">
                        {headingDeg.toFixed(1)}°
                    </div>
                </div>
                <div>
                    <div className="text-xs text-slate-400">Speed</div>
                    <div className="font-mono tabular-nums">
                        {speedMps.toFixed(2)} m/s
                    </div>
                </div>
                <div>
                    <div className="text-xs text-slate-400">X</div>
                    <div className="font-mono tabular-nums">
                        {pos.x.toFixed(2)} m
                    </div>
                </div>
                <div>
                    <div className="text-xs text-slate-400">Y</div>
                    <div className="font-mono tabular-nums">
                        {pos.y.toFixed(2)} m
                    </div>
                </div>
                <div>
                    <div className="text-xs text-slate-400">Battery</div>
                    <div className="font-mono tabular-nums">
                        {batteryLevel.toFixed(1)}%
                    </div>
                </div>
                <div>
                    <div className="text-xs text-slate-400">Distance on Battery</div>
                    <div className="font-mono tabular-nums">
                        {distanceByBatteryKm.toFixed(2)} km
                    </div>
                </div>
                <div>
                    <div className="text-xs text-slate-400">Tyre Pressure</div>
                    <div className="font-mono tabular-nums">
                        {tyrePressurePsi.toFixed(1)} psi
                    </div>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                    className={`rounded-md px-3 py-2 ring-1 transition-all ${
                        torchOn
                            ? "bg-amber-300/20 text-amber-300 ring-amber-300/40 hover:shadow-glow"
                            : "bg-slate-700/60 text-slate-300 ring-white/10 hover:shadow-glow"
                    }`}
                    onClick={() => setTorchOn((t) => !t)}
                >
                    {torchOn ? "Torch: On" : "Torch: Off"}
                </button>
                <button
                    className="rounded-md px-3 py-2 text-slate-300 ring-1 ring-white/10 hover:text-white"
                    onClick={reset}
                >
                    Reset
                </button>
                {showBatteryControls && (
                    <button
                        className="rounded-md px-3 py-2 text-slate-300 ring-1 ring-white/10 hover:text-white"
                        onClick={() => {
                            setBatteryLevel(100);
                            setDistanceByBatteryKm(0);
                        }}
                    >
                        Battery: Reset
                    </button>
                )}
                {showTyreControls && (
                    <div className="flex items-center gap-2">
                        <button
                            className="rounded-md px-3 py-2 text-slate-300 ring-1 ring-white/10 hover:text-white"
                            onClick={() => setTyrePressurePsi((p) => Math.min(120, p + 2))}
                        >
                            + Tyre
                        </button>
                        <button
                            className="rounded-md px-3 py-2 text-slate-300 ring-1 ring-white/10 hover:text-white"
                            onClick={() => setTyrePressurePsi((p) => Math.max(40, p - 2))}
                        >
                            - Tyre
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function wrapDeg(d) {
    let x = d % 360;
    if (x < 0) x += 360;
    return x;
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
