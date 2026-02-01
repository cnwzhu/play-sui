import { Trophy, Gift, Bookmark, TrendingUp } from 'lucide-react';

interface Contract {
    id: number;
    name: string;
    address: string;
    description?: string;
    options?: string;
    total_volume: number;
    outcome_odds?: string;
}

interface MarketCardProps {
    contract: Contract;
    onClick: (contract: Contract) => void;
}

export function MarketCard({ contract, onClick }: MarketCardProps) {
    // Parse options or default
    const options = contract.options
        ? JSON.parse(contract.options)
        : ["Yes", "No"];

    // Real data from backend
    // total_volume is in SUI, convert to MIST for display
    const volumeInMist = contract.total_volume * 1_000_000_000;
    const volume = volumeInMist >= 1000
        ? `${(volumeInMist / 1000).toFixed(1)}K MIST`
        : `${volumeInMist.toFixed(0)} MIST`;

    // Parse odds directly from backend or calculate default
    let prices: number[] = [];
    if (contract.outcome_odds) {
        try {
            prices = JSON.parse(contract.outcome_odds);
        } catch (e) {
            console.error("Failed to parse odds", e);
        }
    }

    // Fallback if no odds: Equal probability
    if (prices.length !== options.length) {
        prices = new Array(options.length).fill(1.0 / options.length);
    }

    // Convert price (0.0-1.0) to percentage (0-100)
    const percentages = prices.map(p => Math.round(p * 100));

    const isBinary = options.length === 2 && options.includes("Yes") && options.includes("No");

    return (
        <div
            onClick={() => onClick(contract)}
            className="group bg-[#1e212b] border border-gray-800 hover:border-gray-600 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-blue-900/10 hover:-translate-y-1 flex flex-col justify-between"
        >
            <div className="p-4 space-y-4">
                {/* Header / Icon */}
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 shrink-0 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 font-bold text-xl group-hover:scale-105 transition-transform">
                        {/* Placeholder Icon based on first letter or generic */}
                        <Trophy className="w-6 h-6" />
                    </div>
                    <h3 className="text-white font-medium leading-snug line-clamp-2 h-[3rem]">
                        {contract.name}
                    </h3>
                </div>

                {/* Outcomes / Odds */}
                <div className="space-y-2 mt-4">
                    {isBinary ? (
                        // Binary Layout (Yes/No rows)
                        <>
                            <div className="flex items-center justify-between group/row">
                                <span className="text-sm text-gray-300 font-medium">{options[0]}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-green-400 font-bold">{percentages[0]}%</span>
                                    <div className="px-3 py-1.5 rounded bg-[#1a3a3a] text-[#00c99b] text-xs font-bold uppercase tracking-wider group-hover/row:bg-[#00c99b] group-hover/row:text-black transition-colors">
                                        Buy Yes
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between group/row">
                                <span className="text-sm text-gray-300 font-medium">{options[1]}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-red-400 font-bold">{percentages[1]}%</span>
                                    <div className="px-3 py-1.5 rounded bg-[#3a1a1a] text-[#ff4d4d] text-xs font-bold uppercase tracking-wider group-hover/row:bg-[#ff4d4d] group-hover/row:text-white transition-colors">
                                        Buy No
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        // Multi-option layout (Scrollable list - unified styling with dynamic colors)
                        <div className="max-h-[80px] overflow-y-auto pr-2 space-y-2">
                            {options.map((opt: string, idx: number) => {
                                const textColors = ["text-blue-400", "text-red-400", "text-green-400", "text-yellow-400", "text-purple-400", "text-pink-400", "text-cyan-400", "text-orange-400"];
                                const bgHoverColors = ["group-hover/row:bg-blue-600", "group-hover/row:bg-red-600", "group-hover/row:bg-green-600", "group-hover/row:bg-yellow-600", "group-hover/row:bg-purple-600", "group-hover/row:bg-pink-600", "group-hover/row:bg-cyan-600", "group-hover/row:bg-orange-600"];
                                const textColor = textColors[idx % textColors.length];
                                const hoverBg = bgHoverColors[idx % bgHoverColors.length];

                                return (
                                    <div key={idx} className="flex items-center justify-between group/row">
                                        <span className="text-sm text-gray-300 font-medium truncate max-w-[50%]">{opt}</span>
                                        <div className="flex items-center gap-3">
                                            <span className={`${textColor} font-bold text-sm`}>
                                                {percentages[idx] || 0}%
                                            </span>
                                            <div className={`px-3 py-1.5 rounded bg-[#2c303b] ${textColor} text-xs font-bold uppercase tracking-wider ${hoverBg} group-hover/row:text-white transition-colors`}>
                                                Trade
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between bg-[#242832]/50">
                <span className="text-xs text-gray-500 font-medium font-mono flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" />
                    {volume}
                </span>
                <div className="flex gap-3 text-gray-600">
                    <Gift className="w-4 h-4 hover:text-white transition-colors" />
                    <Bookmark className="w-4 h-4 hover:text-white transition-colors" />
                </div>
            </div>
        </div>
    );
}
