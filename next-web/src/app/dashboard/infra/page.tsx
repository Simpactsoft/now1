export default function InfraPage() {
    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-1 pb-6 border-b border-white/10">
                <h1 className="text-4xl font-extrabold tracking-tight gradient-text">Infrastructure</h1>
                <p className="text-zinc-500 text-sm">Resource utilization and instance management.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass p-6 rounded-2xl border border-white/5">
                    <h3 className="font-bold mb-4">Compute Instance</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm"><span>Tier</span><span className="text-blue-400">Small</span></div>
                        <div className="flex justify-between text-sm"><span>CPU</span><span>2-Core ARM</span></div>
                        <div className="flex justify-between text-sm"><span>RAM</span><span>2GB</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
