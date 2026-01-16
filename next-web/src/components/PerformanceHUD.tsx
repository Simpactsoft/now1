"use client";

import { useEffect, useState, useRef } from "react";
import { Zap, Database, Activity } from "lucide-react";

interface PerformanceHUDProps {
    latency: number;
    totalRows: number;
}

export default function PerformanceHUD({ latency, totalRows }: PerformanceHUDProps) {
    const [fps, setFps] = useState(0);
    const frames = useRef(0);
    const lastTime = useRef(performance.now());

    useEffect(() => {
        let animationId: number;

        const loop = () => {
            frames.current++;
            const now = performance.now();
            if (now >= lastTime.current + 1000) {
                setFps(Math.round((frames.current * 1000) / (now - lastTime.current)));
                frames.current = 0;
                lastTime.current = now;
            }
            animationId = requestAnimationFrame(loop);
        };

        animationId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationId);
    }, []);

    const fpsColor = fps < 30 ? "text-red-500" : fps < 55 ? "text-yellow-500" : "text-green-500";

    return (
        <div className="fixed top-6 right-6 z-50 flex flex-col gap-3">
            <div className="bg-black/80 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-2xl min-w-[220px]">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Database size={16} />
                            <span className="text-sm font-medium">Total Rows</span>
                        </div>
                        <span className="text-white font-mono font-bold">
                            {totalRows.toLocaleString()}
                        </span>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Zap size={16} />
                            <span className="text-sm font-medium">DB Latency</span>
                        </div>
                        <span className={`font-mono font-bold ${latency > 500 ? "text-yellow-400" : "text-blue-400"}`}>
                            {latency}ms
                        </span>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Activity size={16} />
                            <span className="text-sm font-medium">FPS</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold ${fpsColor}`}>
                                {fps}
                            </span>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${fpsColor.replace('text', 'bg')}`} />
                        </div>
                    </div>
                </div>

                {fps < 30 && (
                    <div className="mt-4 p-2 bg-red-500/20 border border-red-500/50 rounded text-[10px] text-red-500 uppercase font-bold text-center tracking-tighter animate-bounce">
                        Performance Alert: Low FPS
                    </div>
                )}
            </div>

            <div className="text-[10px] text-zinc-600 text-right font-mono uppercase tracking-[0.2em]">
                God Mode HUD v1.0
            </div>
        </div>
    );
}
