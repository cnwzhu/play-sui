import { Trophy, Gift, TrendingUp, Star, CheckCircle } from 'lucide-react';

interface Contract {
    id: number;
    name: string;
    address: string;
    description?: string;
    options?: string;
    total_volume: number;
    outcome_odds?: string;
    resolved?: boolean;
    winner?: number;
}

interface MarketCardProps {
    contract: Contract;
    onClick: (contract: Contract, initialOutcomeIndex?: number) => void;
    isFavorite?: boolean;
    onToggleFavorite?: (e: React.MouseEvent) => void;
}

export function MarketCard({ contract, onClick, isFavorite = false, onToggleFavorite }: MarketCardProps) {
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

    const isResolved = contract.resolved === true;
    const winnerIndex = contract.winner;

    return (
        <div
            onClick={() => onClick(contract)}
            className={`group bg-[#1e212b] border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col justify-between ${isResolved ? 'border-green-700/50 opacity-80' : 'border-gray-800 hover:border-gray-600 hover:shadow-xl hover:shadow-blue-900/10 hover:-translate-y-1'}`}
        >
            <div className="p-4 space-y-4">
                {/* Header / Icon */}
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 shrink-0 border rounded-lg flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform ${isResolved ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                        {isResolved ? <CheckCircle className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
                    </div>
                    <div className="flex-1">
                        {isResolved && (
                            <span className="text-xs font-bold uppercase tracking-wider text-green-400 bg-green-500/10 px-2 py-0.5 rounded mb-1 inline-block">
                                Resolved
                            </span>
                        )}
                        <h3 className="text-white font-medium leading-snug line-clamp-2 h-[3rem]">
                            {contract.name}
                        </h3>
                    </div>
                </div>

                {/* Outcomes / Odds */}
                <div className="space-y-2 mt-4">
                    {isBinary ? (
                        // Binary Layout (Yes/No rows)
                        <>
                            <div className="flex items-center justify-between group/row">
                                <span className={`text-sm font-medium flex items-center gap-1 ${winnerIndex === 0 ? 'text-green-400' : 'text-gray-300'}`}>
                                    {winnerIndex === 0 && <CheckCircle className="w-4 h-4" />}
                                    {options[0]}
                                    {winnerIndex === 0 && <span className="text-xs">(Winner)</span>}
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className="text-green-400 font-bold">{percentages[0]}%</span>
                                    {!isResolved && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onClick(contract, 0);
                                            }}
                                            className="px-3 py-1.5 rounded bg-[#1a3a3a] text-[#00c99b] text-xs font-bold uppercase tracking-wider group-hover/row:bg-[#00c99b] group-hover/row:text-black transition-colors"
                                        >
                                            Buy Yes
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-between group/row">
                                <span className={`text-sm font-medium flex items-center gap-1 ${winnerIndex === 1 ? 'text-green-400' : 'text-gray-300'}`}>
                                    {winnerIndex === 1 && <CheckCircle className="w-4 h-4" />}
                                    {options[1]}
                                    {winnerIndex === 1 && <span className="text-xs">(Winner)</span>}
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className="text-red-400 font-bold">{percentages[1]}%</span>
                                    {!isResolved && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onClick(contract, 1);
                                            }}
                                            className="px-3 py-1.5 rounded bg-[#3a1a1a] text-[#ff4d4d] text-xs font-bold uppercase tracking-wider group-hover/row:bg-[#ff4d4d] group-hover/row:text-white transition-colors"
                                        >
                                            Buy No
                                        </div>
                                    )}
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

                                const isWinner = winnerIndex === idx;
                                return (
                                    <div key={idx} className="flex items-center justify-between group/row">
                                        <span className={`text-sm font-medium truncate max-w-[50%] flex items-center gap-1 ${isWinner ? 'text-green-400' : 'text-gray-300'}`}>
                                            {isWinner && <CheckCircle className="w-4 h-4 shrink-0" />}
                                            {opt}
                                            {isWinner && <span className="text-xs">(Winner)</span>}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className={`${isWinner ? 'text-green-400' : textColor} font-bold text-sm`}>
                                                {percentages[idx] || 0}%
                                            </span>
                                            {!isResolved && (
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onClick(contract, idx);
                                                    }}
                                                    className={`px-3 py-1.5 rounded bg-[#2c303b] ${textColor} text-xs font-bold uppercase tracking-wider ${hoverBg} group-hover/row:text-white transition-colors`}
                                                >
                                                    Buy {opt}
                                                </div>
                                            )}
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
                    <div
                        onClick={(e) => {
                            if (onToggleFavorite) {
                                e.stopPropagation();
                                onToggleFavorite(e);
                            }
                        }}
                        className={`transition-colors p-1 -m-1 rounded-full hover:bg-white/5 ${isFavorite ? 'text-yellow-500 hover:text-yellow-400' : 'hover:text-white'}`}
                    >
                        <Star
                            className={`w-4 h-4 ${isFavorite ? 'fill-yellow-500' : ''}`}
                            style={isFavorite ? {} : { fill: 'none' }}
                        />
                        {/* Actually Trophy is not a star. Wait, I should use Star. I will import Star from lucide-react first. */}
                    </div>
                </div>
            </div>
        </div>
    );
}
