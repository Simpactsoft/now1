export default function SettingsPage() {
    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-1 pb-6 border-b border-white/10">
                <h1 className="text-4xl font-extrabold tracking-tight gradient-text">Settings</h1>
                <p className="text-zinc-500 text-sm">Global platform configuration and security.</p>
            </header>
            <div className="glass p-8 rounded-3xl border border-white/5 max-w-2xl">
                <p className="text-zinc-500">Configuration panel is locked for the current research phase.</p>
            </div>
        </div>
    );
}
