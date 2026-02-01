import { useState } from 'react';
import { Plus, Trash2, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

interface Category {
    id: number;
    name: string;
}

interface DebugToolsProps {
    categories: Category[];
    onMarketCreated: (newMarket: any) => void;
}

export function DebugTools({ categories, onMarketCreated }: DebugToolsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [newContractName, setNewContractName] = useState("");
    const [newContractDesc, setNewContractDesc] = useState("");
    const [newContractOptions, setNewContractOptions] = useState<string[]>(["Yes", "No"]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [newContractEndDate, setNewContractEndDate] = useState<string>("");

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
            const newContract = await createMarketBackend(newContractName, newContractDesc, optionsArray, selectedCategoryId, newContractEndDate);
            onMarketCreated(newContract);

            // Reset Form
            setNewContractName("");
            setNewContractDesc("");
            setNewContractOptions(["Yes", "No"]);
            setSelectedCategoryId(null);
            setNewContractEndDate("");

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
                                <label className="block text-sm text-gray-400 mb-1">End Date (Optional)</label>
                                <input
                                    type="date"
                                    className="w-full bg-[#242832] border border-gray-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none"
                                    value={newContractEndDate}
                                    onChange={e => setNewContractEndDate(e.target.value)}
                                />
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

                    {/* Oracle Tools Section (Placeholder) */}
                    <div className="bg-[#1e212b] border border-gray-800 rounded-xl p-6 opacity-60">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            Oracle Tools (Coming Soon)
                        </h3>
                        <p className="text-gray-400 text-sm">
                            Tools for debugging oracle responses, manually resolving markets, and testing oracle node connectivity will appear here.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
