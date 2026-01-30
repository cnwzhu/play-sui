import { Trophy, Gift, Bookmark, TrendingUp } from 'lucide-react';

interface Contract {
    id: number;
    name: string;
    address: string;
    description?: string;
    options?: string;
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

    // Mock data for visuals (since backend doesn't store live odds in the list view yet)
    const volume = "$1.2m Vol.";

    // Create mock percentages for the first 2 options to look like the design
    // In a real app, pass this data in
    const mockPercent1 = Math.floor(Math.random() * 60) + 20;
    const mockPercent2 = 100 - mockPercent1;

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
                                    <span className="text-green-400 font-bold">{mockPercent1}%</span>
                                    <div className="px-3 py-1.5 rounded bg-[#1a3a3a] text-[#00c99b] text-xs font-bold uppercase tracking-wider group-hover/row:bg-[#00c99b] group-hover/row:text-black transition-colors">
                                        Buy Yes
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between group/row">
                                <span className="text-sm text-gray-300 font-medium">{options[1]}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-red-400 font-bold">{mockPercent2}%</span>
                                    <div className="px-3 py-1.5 rounded bg-[#3a1a1a] text-[#ff4d4d] text-xs font-bold uppercase tracking-wider group-hover/row:bg-[#ff4d4d] group-hover/row:text-white transition-colors">
                                        Buy No
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        // Multi-option layout (List top 2)
                        options.slice(0, 2).map((opt: string, idx: number) => (
                            <div key={idx} className="flex items-center justify-between">
                                <span className="text-sm text-gray-300 font-medium truncate max-w-[60%]">{opt}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-blue-400 font-bold">{idx === 0 ? mockPercent1 : mockPercent2}%</span>
                                    <div className="hidden group-hover:block px-3 py-1 rounded bg-[#2c303b] hover:bg-gray-600 text-xs font-medium text-white transition-colors">
                                        Trade
                                    </div>
                                </div>
                            </div>
                        ))
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
