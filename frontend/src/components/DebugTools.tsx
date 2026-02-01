import { useState } from 'react';
import { Plus, Trash2, Wrench, Calendar, X } from 'lucide-react';
import clsx from 'clsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useModal } from '../context/ModalContext'; // Import useModal

interface Category {
    id: number;
    name: string;
}

interface Contract {
    id: number;
    name: string;
    address: string;
    options?: string;
    resolved?: boolean;
}

interface DebugToolsProps {
    categories: Category[];
    contracts: Contract[];
    onMarketCreated: (newMarket: any) => void;
    onMarketResolved?: () => void;
}

export function DebugTools({ categories, contracts, onMarketCreated, onMarketResolved }: DebugToolsProps) {
    const { alert, confirm } = useModal(); // Use custom hooks
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [activeTab, setActiveTab] = useState<'create' | 'oracle'>('create');

    // Create Market Form State
    const [newContractName, setNewContractName] = useState("");
    const [newContractDesc, setNewContractDesc] = useState("");
    const [newContractOptions, setNewContractOptions] = useState<string[]>(["Yes", "No"]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [newContractEndDate, setNewContractEndDate] = useState<Date | null>(null);

    // Oracle Tools State
    const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null);
    const [selectedWinnerIndex, setSelectedWinnerIndex] = useState<number>(0);
    const [isResolving, setIsResolving] = useState(false);

    // Derived: Get selected market and its options
    const selectedMarket = contracts.find(c => c.id === selectedMarketId) || null;
    const selectedMarketOptions: string[] = selectedMarket?.options
        ? JSON.parse(selectedMarket.options)
        : ["Yes", "No"];

    const updateOption = (index: number, value: string) => {
        const updated = [...newContractOptions];
        updated[index] = value;
        setNewContractOptions(updated);
    };

    const addOption = () => {
        setNewContractOptions([...newContractOptions, ""]);
    };

    const removeOption = (index: number) => {
        if (newContractOptions.length <= 2) return;
        const updated = newContractOptions.filter((_, i) => i !== index);
        setNewContractOptions(updated);
    };

    const handleResolveMarket = async () => {
        if (!selectedMarket) {
            await alert("Please select a market to resolve.");
            return;
        }

        const confirmResolve = await confirm(
            `Are you sure you want to resolve "${selectedMarket.name}" with winner: "${selectedMarketOptions[selectedWinnerIndex]}"?\n\nThis action is IRREVERSIBLE.`
        );
        if (!confirmResolve) return;

        setIsResolving(true);

        try {
            const res = await fetch('http://localhost:3000/oracle/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    market_id: selectedMarket.address,
                    winner: selectedWinnerIndex,
                }),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || "Failed to resolve market");
            }

            const result = await res.json();
            await alert(`Market resolved successfully!\n\nTransaction: ${result.digest}\nStatus: ${result.status}`);

            // Reset state
            setSelectedMarketId(null);
            setSelectedWinnerIndex(0);

            // Callback to refresh data
            if (onMarketResolved) {
                onMarketResolved();
            }
        } catch (e: any) {
            console.error(e);
            await alert(`Failed to resolve market: ${e.message}`);
        } finally {
            setIsResolving(false);
        }
    };

    const createMarketBackend = async (name: string, desc: string, options: string[], categoryId: number | null, endDate: string) => {
        const res = await fetch('http://localhost:3000/contracts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                address: "", // Empty address signals Backend to create on-chain
                description: desc,
                options: options,
                category_id: categoryId,
                end_date: endDate || null,
            })
        });
        if (!res.ok) throw new Error("Backend failed to create market");
        return await res.json();
    };

    const handleCreateMarket = async () => {
        if (!newContractName) {
            await alert("Please enter a market question/name.");
            return;
        }
        if (!selectedCategoryId) {
            await alert("Please select a category.");
            return;
        }

        // Filter empty options
        const optionsArray = newContractOptions.map(s => s.trim()).filter(s => s.length > 0);
        if (optionsArray.length < 2) {
            await alert("Please provide at least 2 valid outcomes.");
            return;
        }

        setIsCreating(true);

        try {
            const newContract = await createMarketBackend(newContractName, newContractDesc, optionsArray, selectedCategoryId, newContractEndDate ? newContractEndDate.toISOString() : "");
            onMarketCreated(newContract);

            // Reset Form
            setNewContractName("");
            setNewContractDesc("");
            setNewContractOptions(["Yes", "No"]);
            setSelectedCategoryId(null);
            setNewContractEndDate(null);

            await alert("Market created successfully (by Admin Backend)!");
            setIsOpen(false); // Close modal on success
        } catch (e) {
            console.error(e);
            await alert("Failed to create market. See console.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-40 bg-[#1e212b] border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white p-3 rounded-full shadow-xl transition-all hover:scale-105 group"
                title="Open Debug Tools"
            >
                <Wrench className="w-6 h-6 group-hover:rotate-45 transition-transform" />
            </button>

            {/* Modal Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#15171e] w-full max-w-2xl rounded-2xl border border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#1e212b]">
                            <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-gray-300">
                                <Wrench className="w-4 h-4" />
                                Developer Tools
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 max-h-[80vh] overflow-y-auto">
                            {/* Tabs */}
                            <div className="flex space-x-1 bg-[#0f1115] p-1 rounded-xl mb-6">
                                <button
                                    onClick={() => setActiveTab('create')}
                                    className={clsx(
                                        "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all font-medium text-sm",
                                        activeTab === 'create'
                                            ? "bg-[#1e212b] text-blue-400 shadow-sm"
                                            : "text-gray-500 hover:text-gray-300 hover:bg-[#1e212b]/50"
                                    )}
                                >
                                    <Plus className="w-4 h-4" />
                                    Create Market
                                </button>
                                <button
                                    onClick={() => setActiveTab('oracle')}
                                    className={clsx(
                                        "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all font-medium text-sm",
                                        activeTab === 'oracle'
                                            ? "bg-[#1e212b] text-yellow-500 shadow-sm"
                                            : "text-gray-500 hover:text-gray-300 hover:bg-[#1e212b]/50"
                                    )}
                                >
                                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                    Oracle Tools
                                </button>
                            </div>

                            {/* Create Market Section */}
                            {activeTab === 'create' && (
                                <div className="space-y-5">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Market Question</label>
                                            <input className="w-full bg-[#1e212b] border border-gray-800 focus:border-blue-500/50 rounded-lg p-3 text-white outline-none transition-colors"
                                                value={newContractName}
                                                onChange={e => setNewContractName(e.target.value)}
                                                placeholder="e.g. Who will win the 2026 World Cup?"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Category</label>
                                                <select
                                                    className="w-full bg-[#1e212b] border border-gray-800 focus:border-blue-500/50 rounded-lg p-3 text-white outline-none transition-colors appearance-none"
                                                    value={selectedCategoryId || ""}
                                                    onChange={e => setSelectedCategoryId(Number(e.target.value))}
                                                >
                                                    <option value="" disabled>Select Category</option>
                                                    {categories
                                                        .filter(c => c.name !== "All" && c.name !== "New")
                                                        .map(cat => (
                                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                        ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">End Date</label>
                                                <div className="relative datepicker-dark">
                                                    <DatePicker
                                                        selected={newContractEndDate}
                                                        onChange={(date: Date | null) => setNewContractEndDate(date)}
                                                        showTimeSelect
                                                        timeFormat="HH:mm"
                                                        timeIntervals={15}
                                                        timeCaption="Time"
                                                        dateFormat="MMM d, yyyy HH:mm"
                                                        minDate={new Date()}
                                                        placeholderText="Optional"
                                                        className="w-full bg-[#1e212b] border border-gray-800 focus:border-blue-500/50 rounded-lg p-3 text-white outline-none cursor-pointer transition-colors"
                                                        calendarClassName="dark-calendar"
                                                        wrapperClassName="w-full"
                                                        popperPlacement="bottom-end"
                                                    />
                                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Outcomes</label>
                                            <div className="space-y-2">
                                                {newContractOptions.map((opt, idx) => (
                                                    <div key={idx} className="flex gap-2">
                                                        <input
                                                            className="flex-1 bg-[#1e212b] border border-gray-800 focus:border-blue-500/50 rounded-lg p-3 text-white outline-none transition-colors"
                                                            value={opt}
                                                            onChange={e => updateOption(idx, e.target.value)}
                                                            placeholder={`Option ${idx + 1}`}
                                                        />
                                                        {newContractOptions.length > 2 && (
                                                            <button
                                                                onClick={() => removeOption(idx)}
                                                                className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={addOption}
                                                    className="w-full py-2 border border-dashed border-gray-700 text-gray-400 hover:text-blue-400 hover:border-blue-400/50 rounded-lg text-sm font-medium transition-all"
                                                >
                                                    + Add Option
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Description</label>
                                            <textarea className="w-full bg-[#1e212b] border border-gray-800 focus:border-blue-500/50 rounded-lg p-3 text-white outline-none transition-colors resize-none"
                                                value={newContractDesc} onChange={e => setNewContractDesc(e.target.value)} rows={2} placeholder="Optional market details..." />
                                        </div>

                                        <button
                                            onClick={handleCreateMarket}
                                            disabled={isCreating}
                                            className={`w-full py-3.5 rounded-lg text-white font-bold transition-all shadow-lg ${isCreating
                                                ? 'bg-blue-600/50 cursor-not-allowed'
                                                : 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-600/20'
                                                }`}
                                        >
                                            {isCreating ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Creating...
                                                </span>
                                            ) : 'Create Market'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Oracle Tools Section */}
                            {activeTab === 'oracle' && (
                                <div className="space-y-6">
                                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex gap-3 text-sm text-yellow-200">
                                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 shrink-0" />
                                        <p>
                                            Use this tool to resolve markets on the devnet. In a production environment, this would be handled by a decentralized oracle network.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Select Market to Resolve</label>
                                            <select
                                                className="w-full bg-[#1e212b] border border-gray-800 focus:border-yellow-500/50 rounded-lg p-3 text-white outline-none transition-colors"
                                                value={selectedMarketId || ""}
                                                onChange={e => {
                                                    setSelectedMarketId(Number(e.target.value));
                                                    setSelectedWinnerIndex(0);
                                                }}
                                            >
                                                <option value="" disabled>Select a market</option>
                                                {contracts
                                                    .filter(contract => !contract.resolved)
                                                    .map(contract => (
                                                        <option key={contract.id} value={contract.id}>
                                                            {contract.name}
                                                        </option>
                                                    ))}
                                                {contracts.filter(c => !c.resolved).length === 0 && (
                                                    <option value="" disabled>No unresolved markets</option>
                                                )}
                                            </select>
                                        </div>

                                        {selectedMarket && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Select Winner</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {selectedMarketOptions.map((opt: string, idx: number) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => setSelectedWinnerIndex(idx)}
                                                            className={clsx(
                                                                "px-4 py-3 rounded-lg text-sm font-bold border transition-all text-center relative overflow-hidden",
                                                                selectedWinnerIndex === idx
                                                                    ? "bg-yellow-500/10 border-yellow-500 text-yellow-500"
                                                                    : "bg-[#1e212b] border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                                                            )}
                                                        >
                                                            {opt}
                                                            {selectedWinnerIndex === idx && (
                                                                <div className="absolute inset-0 bg-yellow-500/5 pointer-events-none" />
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleResolveMarket}
                                            disabled={isResolving || !selectedMarket}
                                            className={clsx(
                                                "w-full py-3.5 rounded-lg text-white font-bold transition-all mt-4 shadow-lg",
                                                isResolving || !selectedMarket
                                                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                                                    : "bg-yellow-600 hover:bg-yellow-500 hover:shadow-yellow-600/20"
                                            )}
                                        >
                                            {isResolving ? 'Processing on-chain...' : 'Resolve Market'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
