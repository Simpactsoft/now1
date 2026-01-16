export default function LogsPage() {
    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-1 pb-6 border-b border-white/10">
                <h1 className="text-4xl font-extrabold tracking-tight gradient-text">System Logs</h1>
                <p className="text-zinc-500 text-sm">Real-time audit trail of all platform activities.</p>
            </header>
            <div className="flex flex-col items-center justify-center min-h-[400px] glass rounded-3xl border border-dashed border-white/10">
                <p className="text-zinc-500 italic">No logs recorded in the current session.</p>
            </div>
        </div>
    );
}
