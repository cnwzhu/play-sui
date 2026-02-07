import { Trophy, Gift, TrendingUp, Star, CheckCircle, Calendar } from 'lucide-react';

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
    end_date?: string;
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

    // Formatting End Date
    const endDateDisplay = contract.end_date
        ? new Date(contract.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : null;

    // Helper to format large numbers
    const formatMist = (val: number) => {
        if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
        if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
        if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
        return val.toFixed(0);
    };

    return (
        <div
            onClick={() => onClick(contract)}
            className={`group cyber-card cursor-pointer transition-all duration-200 flex flex-col justify-between ${isResolved ? 'cyber-card--resolved' : 'cyber-card--active'}`}
        >
            <div className="p-4 space-y-4 relative z-10">
                {/* Header / Icon */}
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 shrink-0 rounded-lg flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform cyber-badge ${isResolved ? 'cyber-badge--resolved' : 'cyber-badge--active'}`}>
                        {isResolved ? <CheckCircle className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
                    </div>
                    <div className="flex-1">
                        {isResolved && (
                            <span className="text-xs font-bold uppercase tracking-wider text-green-400 bg-green-500/10 px-2 py-0.5 rounded mb-1 inline-block">
                                Resolved
                            </span>
                        )}
                        <h3 className="text-white font-semibold leading-snug line-clamp-2 h-[3rem] tracking-wide">
                            {contract.name}
                        </h3>
                    </div>
                </div>

                {/* Outcomes / Odds */}
                <div className="space-y-3 mt-4">
                    {isBinary ? (
                        // Binary Layout (Yes/No rows)
                        <>
                            <div className="flex items-center justify-between group/row">
                                <span className={`text-sm font-medium flex items-center gap-2 ${winnerIndex === 0 ? 'text-emerald-300' : 'text-slate-200'}`}>
                                    {winnerIndex === 0 && <CheckCircle className="w-4 h-4" />}
                                    {options[0]}
                                    {winnerIndex === 0 && <span className="text-xs font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-300">WIN</span>}
                                </span>
                                <div className="flex items-center gap-4">
                                    <div className="min-w-[120px] flex items-center justify-end gap-2">
                                        <span className="text-emerald-300 font-bold text-base font-mono tabular-nums text-right min-w-[42px]">
                                            {percentages[0]}%
                                        </span>
                                        <span className="h-3 w-px bg-slate-600/70" />
                                        <span className="text-[11px] text-slate-400 font-mono opacity-80 tabular-nums text-left min-w-[52px]">
                                            {formatMist(prices[0] * volumeInMist)}
                                        </span>
                                    </div>
                                    {!isResolved && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onClick(contract, 0);
                                            }}
                                            className="cyber-cta cyber-cta--yes"
                                        >
                                            Buy Yes
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-between group/row">
                                <span className={`text-sm font-medium flex items-center gap-2 ${winnerIndex === 1 ? 'text-emerald-300' : 'text-slate-200'}`}>
                                    {winnerIndex === 1 && <CheckCircle className="w-4 h-4" />}
                                    {options[1]}
                                    {winnerIndex === 1 && <span className="text-xs font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-300">WIN</span>}
                                </span>
                                <div className="flex items-center gap-4">
                                    <div className="min-w-[120px] flex items-center justify-end gap-2">
                                        <span className="text-rose-300 font-bold text-base font-mono tabular-nums text-right min-w-[42px]">
                                            {percentages[1]}%
                                        </span>
                                        <span className="h-3 w-px bg-slate-600/70" />
                                        <span className="text-[11px] text-slate-400 font-mono opacity-80 tabular-nums text-left min-w-[52px]">
                                            {formatMist(prices[1] * volumeInMist)}
                                        </span>
                                    </div>
                                    {!isResolved && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onClick(contract, 1);
                                            }}
                                            className="cyber-cta cyber-cta--no"
                                        >
                                            Buy No
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        // Multi-option layout (Scrollable list - unified styling with dynamic colors)
                        <div className="max-h-[140px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {options.map((opt: string, idx: number) => {
                                const textColors = ["text-cyan-300", "text-rose-300", "text-emerald-300", "text-amber-300", "text-fuchsia-300", "text-pink-300", "text-sky-300", "text-orange-300"];
                                const bgHoverColors = ["hover:bg-cyan-500", "hover:bg-rose-500", "hover:bg-emerald-500", "hover:bg-amber-500", "hover:bg-fuchsia-500", "hover:bg-pink-500", "hover:bg-sky-500", "hover:bg-orange-500"];
                                const textColor = textColors[idx % textColors.length];
                                const hoverBg = bgHoverColors[idx % bgHoverColors.length];

                                const isWinner = winnerIndex === idx;
                                return (
                                    <div key={idx} className="flex items-center justify-between group/row">
                                        <span className={`text-sm font-medium truncate max-w-[50%] flex items-center gap-2 ${isWinner ? 'text-emerald-300' : 'text-slate-200'}`}>
                                            {isWinner && <CheckCircle className="w-4 h-4 shrink-0" />}
                                            {opt}
                                            {isWinner && <span className="text-xs font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-300">WIN</span>}
                                        </span>
                                        <div className="flex items-center gap-4">
                                            <div className="min-w-[120px] flex items-center justify-end gap-2">
                                                <span className={`${isWinner ? 'text-emerald-300' : textColor} font-bold text-base font-mono tabular-nums text-right min-w-[42px]`}>
                                                    {percentages[idx] || 0}%
                                                </span>
                                                <span className="h-3 w-px bg-slate-600/70" />
                                                <span className="text-[11px] text-slate-400 font-mono opacity-80 tabular-nums text-left min-w-[52px]">
                                                    {formatMist((prices[idx] || 0) * volumeInMist)}
                                                </span>
                                            </div>
                                            {!isResolved && (
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onClick(contract, idx);
                                                    }}
                                                    className={`cyber-cta cyber-cta--multi ${textColor} ${hoverBg}`}
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
            <div className="px-4 py-3 border-t border-slate-800/80 flex items-center justify-between bg-[#1a1f2a]/60 relative z-10">
                <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400 font-medium font-mono flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3" />
                        {volume}
                    </span>
                    {!isResolved && endDateDisplay && (
                        <span className="text-xs text-slate-400 font-medium font-mono flex items-center gap-1.5 border-l border-slate-700 pl-4">
                            <Calendar className="w-3 h-3" />
                            {endDateDisplay}
                        </span>
                    )}
                </div>
                <div className="flex gap-3 text-slate-500">
                    <Gift className="w-4 h-4 hover:text-cyan-200 transition-colors" />
                    <div
                        onClick={(e) => {
                            if (onToggleFavorite) {
                                e.stopPropagation();
                                onToggleFavorite(e);
                            }
                        }}
                        className={`transition-colors p-1 -m-1 rounded-full hover:bg-cyan-500/10 ${isFavorite ? 'text-amber-300 hover:text-amber-200' : 'hover:text-cyan-200'}`}
                    >
                        <Star
                            className={`w-4 h-4 ${isFavorite ? 'fill-amber-300' : ''}`}
                            style={isFavorite ? {} : { fill: 'none' }}
                        />
                        {/* Actually Trophy is not a star. Wait, I should use Star. I will import Star from lucide-react first. */}
                    </div>
                </div>
            </div>
        </div>
    );
}
