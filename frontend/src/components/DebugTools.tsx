import { useState } from 'react';
import { Plus, Trash2, Wrench, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import clsx from 'clsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

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
            alert("Please select a market to resolve.");
            return;
        }

        const confirmResolve = window.confirm(
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
            alert(`Market resolved successfully!\n\nTransaction: ${result.digest}\nStatus: ${result.status}`);

            // Reset state
            setSelectedMarketId(null);
            setSelectedWinnerIndex(0);

            // Callback to refresh data
            if (onMarketResolved) {
                onMarketResolved();
            }
        } catch (e: any) {
            console.error(e);
            alert(`Failed to resolve market: ${e.message}`);
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
            alert("Please enter a market question/name.");
            return;
        }
        if (!selectedCategoryId) {
            alert("Please select a category.");
            return;
        }

        // Filter empty options
        const optionsArray = newContractOptions.map(s => s.trim()).filter(s => s.length > 0);
        if (optionsArray.length < 2) {
            alert("Please provide at least 2 valid outcomes.");
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

            alert("Market created successfully (by Admin Backend)!");
        } catch (e) {
            console.error(e);
            alert("Failed to create market. See console.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-[#15171e] shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-gray-500 hover:text-white transition-colors"
            >
                <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider">
                    <Wrench className="w-4 h-4" />
                    Developer & Debug Tools
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {isOpen && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[1440px] mx-auto max-h-[70vh] overflow-y-auto">
                    {/* Create Market Section */}
                    <div className="bg-[#1e212b] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-blue-500" />
                            Create Market (Admin)
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Market Question</label>
                                <input className="w-full bg-[#242832] border border-gray-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none"
                                    value={newContractName} onChange={e => setNewContractName(e.target.value)} placeholder="e.g. Who will win nearby..." />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Category <span className="text-red-500">*</span></label>
                                <select
                                    className={clsx(
                                        "w-full bg-[#242832] border rounded-lg p-2 text-white focus:border-blue-500 outline-none",
                                        !selectedCategoryId ? "border-gray-700" : "border-gray-700"
                                    )}
                                    value={selectedCategoryId || ""}
                                    onChange={e => setSelectedCategoryId(Number(e.target.value))}
                                >
                                    <option value="" disabled>Select a category</option>
                                    {categories
                                        .filter(c => c.name !== "All" && c.name !== "New")
                                        .map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                </select>
                            </div>

                            {/* DYNAMIC OPTIONS */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Outcomes</label>
                                <div className="space-y-2">
                                    {newContractOptions.map((opt, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input
                                                className="flex-1 bg-[#242832] border border-gray-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none"
                                                value={opt}
                                                onChange={e => updateOption(idx, e.target.value)}
                                                placeholder={`Option ${idx + 1}`}
                                            />
                                            {newContractOptions.length > 2 && (
                                                <button
                                                    onClick={() => removeOption(idx)}
                                                    className="p-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={addOption}
                                        className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 mt-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Option
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Description (Optional)</label>
                                <textarea className="w-full bg-[#242832] border border-gray-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none"
                                    value={newContractDesc} onChange={e => setNewContractDesc(e.target.value)} rows={3} />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">End Date & Time (Optional)</label>
                                <div className="relative datepicker-dark">
                                    <DatePicker
                                        selected={newContractEndDate}
                                        onChange={(date: Date | null) => setNewContractEndDate(date)}
                                        showTimeSelect
                                        timeFormat="HH:mm"
                                        timeIntervals={15}
                                        timeCaption="Time"
                                        dateFormat="yyyy-MM-dd HH:mm"
                                        minDate={new Date()}
                                        placeholderText="Select end date and time"
                                        className="w-full bg-[#242832] border border-gray-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none cursor-pointer"
                                        calendarClassName="dark-calendar"
                                        wrapperClassName="w-full"
                                        popperPlacement="top-start"
                                        showPopperArrow={false}
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                </div>
                            </div>

                            <button
                                onClick={handleCreateMarket}
                                disabled={isCreating}
                                className={`w-full py-3 rounded-lg text-white font-bold transition-colors mt-2 ${isCreating ? 'bg-blue-800 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
                            >
                                {isCreating ? 'Accessing Chain...' : 'Create Market'}
                            </button>
                        </div>
                    </div>

                    {/* Oracle Tools Section */}
                    <div className="bg-[#1e212b] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            Oracle Tools (Resolve Market)
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Select Market to Resolve</label>
                                <select
                                    className="w-full bg-[#242832] border border-gray-700 rounded-lg p-2 text-white focus:border-yellow-500 outline-none"
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
                                                {contract.name} ({contract.address.slice(0, 8)}...)
                                            </option>
                                        ))}
                                    {contracts.filter(c => !c.resolved).length === 0 && (
                                        <option value="" disabled>No unresolved markets</option>
                                    )}
                                </select>
                            </div>

                            {selectedMarket && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Select Winning Outcome</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedMarketOptions.map((opt: string, idx: number) => (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedWinnerIndex(idx)}
                                                className={clsx(
                                                    "px-3 py-2 rounded-lg text-sm font-bold border transition-all text-center",
                                                    selectedWinnerIndex === idx
                                                        ? "bg-yellow-500/10 border-yellow-500 text-white"
                                                        : "bg-[#2c303b] border-transparent text-gray-400 hover:bg-[#363b47]"
                                                )}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedMarket && (
                                <div className="bg-[#1a1d26] p-3 rounded-lg border border-gray-800 text-sm">
                                    <p className="text-gray-400">
                                        <span className="text-yellow-500 font-bold">⚠ Warning:</span> Resolving a market is irreversible.
                                        Winners will be able to claim their rewards after resolution.
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={handleResolveMarket}
                                disabled={isResolving || !selectedMarket}
                                className={clsx(
                                    "w-full py-3 rounded-lg text-white font-bold transition-colors mt-2",
                                    isResolving || !selectedMarket
                                        ? "bg-yellow-800 cursor-not-allowed opacity-60"
                                        : "bg-yellow-600 hover:bg-yellow-500"
                                )}
                            >
                                {isResolving ? 'Resolving...' : 'Resolve Market'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
