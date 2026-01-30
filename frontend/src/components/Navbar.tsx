import { Search, Menu, HelpCircle } from 'lucide-react';
import { ConnectButton } from '@mysten/dapp-kit';

export function Navbar() {
    return (
        <nav className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-[#1a1d26]">
            {/* Left: Logo & Search */}
            <div className="flex items-center gap-8 flex-1">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
                    {/* Logo Icon (Simple Shape) */}
                    <div className="w-8 h-8 md:w-8 md:h-8 bg-white text-black flex items-center justify-center font-bold rounded-lg text-lg">
                        S
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white hidden md:block">PlaySui</span>
                </div>

                <div className="relative max-w-lg w-full hidden md:block group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-white transition-colors" />
                    <input
                        type="text"
                        placeholder="Search markets..."
                        className="w-full bg-[#242832] border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 focus:bg-[#2c303b] transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs border border-gray-700 px-1.5 py-0.5 rounded">/</div>
                </div>
            </div>

            {/* Right: Links & Auth */}
            <div className="flex items-center gap-6">
                <a href="#" className="hidden lg:flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
                    <HelpCircle className="w-4 h-4" />
                    How it works
                </a>

                <div className="flex items-center gap-3">
                    <ConnectButton
                        className="!bg-blue-600 hover:!bg-blue-500 !text-white !font-semibold !py-2 !px-4 !rounded-lg !text-sm !transition-colors !border-none"
                    />
                    {/* Mobile Menu */}
                    <button className="md:hidden text-gray-400 hover:text-white">
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </nav>
    );
}
