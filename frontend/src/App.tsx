import { useCurrentAccount, useSignAndExecuteTransaction, ConnectButton } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, AlertCircle, CheckCircle2, Coins, ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import MarketChart from './components/MarketChart';
import { Navbar } from './components/Navbar';
import { MarketCard } from './components/MarketCard';
import clsx from 'clsx';

interface Contract {
  id: number;
  name: string;
  address: string;
  description?: string;
  options?: string;
  category_id?: number;
  total_volume: number;
  outcome_odds?: string;
}

interface Category {
  id: number;
  name: string;
  icon?: string;
}

// NOTE: Update this with your deployed package ID
const PACKAGE_ID = "0x364b4ffa3f81580b37fc32ef472410f313d31e8f82c3daad4d4dd4ed886e88fd"; // Assuming this is correct or will be updated by user

function App() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Navigation State
  const [view, setView] = useState<'home' | 'market'>('home');
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Betting State
  const [outcome, setOutcome] = useState<number>(0);
  const [amount, setAmount] = useState<string>("1000000000"); // 1 SUI
  const [isProcessing, setIsProcessing] = useState(false);

  // Data State
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [contractHistory, setContractHistory] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState("1M");
  const [loading, setLoading] = useState(true);

  // Refresh Trigger
  const [refetchVersion, setRefetchVersion] = useState(0);

  // Manager Form
  const [newContractName, setNewContractName] = useState("");
  const [newContractDesc, setNewContractDesc] = useState("");
  const [newContractOptions, setNewContractOptions] = useState<string[]>(["Yes", "No"]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    // Fetch Categories
    fetch('http://localhost:3000/categories')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error("Failed to fetch categories:", err));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();

    if (searchQuery) params.append("q", searchQuery);

    if (activeCategory !== "All" && activeCategory !== "New") {
      const catObj = categories.find(c => c.name === activeCategory);
      if (catObj) params.append("category_id", catObj.id.toString());
    }

    // Fetch Contracts with filters
    fetch(`http://localhost:3000/contracts?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setContracts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch contracts:", err);
        setLoading(false);
      });
  }, [activeCategory, searchQuery, categories, refetchVersion, view]);

  useEffect(() => {
    if (selectedContract && view === 'market') {
      fetch(`http://localhost:3000/contracts/${selectedContract.id}/history?range=${timeRange}&v=${refetchVersion}`)
        .then(res => res.json())
        .then(data => setContractHistory(data))
        .catch(err => console.error(err));
    }
  }, [selectedContract, view, timeRange, refetchVersion]);

  useEffect(() => {
    if (selectedContract) {
      setOutcome(0);
    }
  }, [selectedContract]);

  const handleContractClick = (contract: Contract) => {
    setSelectedContract(contract);
    setView('market');
    window.scrollTo(0, 0);
  };

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

  // Helper to save to backend (Now capable of triggering creation too)
  const createMarketBackend = async (name: string, desc: string, options: string[], categoryId: number | null) => {
    const res = await fetch('http://localhost:3000/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        address: "", // Empty address signals Backend to create on-chain
        description: desc,
        options: options,
        category_id: categoryId,
      })
    });
    if (!res.ok) throw new Error("Backend failed to create market");
    return await res.json();
  };

  const handleCreateMarket = async () => {
    if (!newContractName) return;

    // Filter empty options
    const optionsArray = newContractOptions.map(s => s.trim()).filter(s => s.length > 0);
    if (optionsArray.length < 2) {
      alert("Please provide at least 2 valid outcomes.");
      return;
    }

    // Backend Creation Mode (Admin Mode)
    // No wallet check required because the backend pays for gas.

    setIsCreating(true);

    try {
      const newContract = await createMarketBackend(newContractName, newContractDesc, optionsArray, selectedCategoryId);
      setContracts(prev => [...prev, newContract]);
      setShowCreateModal(false);
      resetForm();
      handleContractClick(newContract);
      alert("Market created successfully (by Admin Backend)!");
    } catch (e) {
      console.error(e);
      alert("Failed to create market. See console.");
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setNewContractName("");
    setNewContractDesc("");
    setNewContractOptions(["Yes", "No"]);
    setSelectedCategoryId(null);
  };

  const placeBet = () => {
    if (!account) return;
    setIsProcessing(true);

    try {
      const tx = new Transaction();
      const coin = tx.splitCoins(tx.gas, [amount]);

      tx.moveCall({
        target: `${PACKAGE_ID}::market::place_bet`,
        arguments: [
          tx.object(selectedContract?.address || "0x0"),
          coin,
          tx.pure.u8(outcome)
        ],
      });

      signAndExecute({
        transaction: tx as any,
      },
        {
          onSuccess: async (result) => {
            console.log('Bet placed:', result);
            setIsProcessing(false);

            // Artificial delay to allow indexer/chain to process (optimistic UX)
            setTimeout(() => {
              // Trigger refreshes
              setSearchQuery(prev => prev + " "); // Hack to trigger contracts refresh? No, let's use a proper trigger.
              // Actually, let's just force a reload of the specific contract's history and list.
              // Because useEffect relies on state, let's add a version counter.
              setRefetchVersion(v => v + 1);
              alert('Bet placed! Updating market data...');
            }, 2000);
          },
          onError: (err) => {
            console.error('Error:', err);
            alert('Error placing bet. Check console for details.');
            setIsProcessing(false);
          }
        }
      );
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  const currentOptions = selectedContract?.options
    ? JSON.parse(selectedContract.options)
    : ["Yes", "No"];

  // Backend filtering is now used
  const filteredContracts = contracts;

  return (
    <div className="min-h-screen bg-[#1a1d26] text-white font-sans selection:bg-blue-500 selection:text-white pb-20">
      <Navbar onSearch={setSearchQuery} />

      {/* --- HOME VIEW --- */}
      {view === 'home' && (
        <main className="max-w-[1440px] mx-auto px-4 md:px-6">

          {/* Subheader / Categories */}
          <div className="flex items-center gap-2 overflow-x-auto py-4 border-b border-gray-800 scrollbar-hide mb-6">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.name)}
                className={clsx(
                  "px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors",
                  activeCategory === cat.name
                    ? "bg-[#2c303b] text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#242832]"
                )}
              >
                {cat.name}
              </button>
            ))}
            <button
              onClick={() => setShowCreateModal(true)}
              className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold whitespace-nowrap transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Market
            </button>
          </div>

          {/* Featured / Hero Section (Optional, mimicking "Trending" or large card) */}
          {filteredContracts.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-white" />
                <h2 className="text-xl font-bold">Trending</h2>
              </div>

              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredContracts.map(contract => (
                    <MarketCard
                      key={contract.id}
                      contract={contract}
                      onClick={handleContractClick}
                    />
                  ))}
                </div>
              )}

              {filteredContracts.length === 0 && !loading && (
                <div className="text-center py-20 text-gray-500 bg-[#1e212b] rounded-xl border border-gray-800 border-dashed">
                  No markets available in this category. Create one to get started.
                </div>
              )}
            </section>
          )}

        </main>
      )}

      {/* --- MARKET DETAIL VIEW --- */}
      {view === 'market' && selectedContract && (
        <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
          <button
            onClick={() => setView('home')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Markets
          </button>

          <div className="grid gap-8 md:grid-cols-12">
            {/* Left Col: Chart & Info */}
            <div className="md:col-span-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white leading-tight mb-2">
                    {selectedContract.name}
                  </h1>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs font-bold uppercase">Sports</span>
                    <span>Vol. {(selectedContract.total_volume * 1_000_000_000).toFixed(0)} MIST</span>
                    <span>Ends 2026</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#1e212b] border border-gray-800 rounded-xl p-6 min-h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-gray-300">Outcome Probability</h3>
                  <div className="flex gap-2">
                    {['5m', '1h', '6h', '1d', '1w', '1M'].map(t => (
                      <button
                        key={t}
                        onClick={() => setTimeRange(t)}
                        className={`px-2 py-1 text-xs font-medium rounded uppercase ${timeRange === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <MarketChart data={contractHistory} options={currentOptions} />
              </div>

              {/* Description or Rules */}
              <div className="bg-[#1e212b] border border-gray-800 rounded-xl p-6">
                <h3 className="font-bold text-white mb-2">Rules</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {selectedContract.description || "This market will resolve to the option that occurs. Result is determined by the designated Oracle."}
                </p>
              </div>
            </div>

            {/* Right Col: Trade */}
            <div className="md:col-span-4">
              <div className="sticky top-6 bg-[#1e212b] border border-gray-800 rounded-xl p-0 overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-gray-800 bg-[#242832]">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    Trade
                  </h3>
                </div>

                <div className="p-5 space-y-6">
                  {/* Outcome Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Select Outcome</label>
                    <div className="grid grid-cols-2 gap-2">
                      {currentOptions.map((opt: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setOutcome(idx)}
                          className={clsx(
                            "px-3 py-3 rounded-lg text-sm font-bold border transition-all text-center relative",
                            outcome === idx
                              ? "bg-blue-500/10 border-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                              : "bg-[#2c303b] border-transparent text-gray-400 hover:bg-[#363b47]"
                          )}
                        >
                          {opt}
                          {outcome === idx && <CheckCircle2 className="w-4 h-4 absolute top-1 right-1 text-blue-500" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Amount (MIST)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-[#1a1d26] border border-gray-700 hover:border-gray-500 rounded-lg px-4 py-3 text-white font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 focus:outline-none transition-all duration-200"
                      />
                    </div>
                  </div>

                  {/* Action Button */}
                  {!account ? (
                    <ConnectButton
                      className="!w-full !py-3.5 !rounded-lg !font-bold !text-base !bg-blue-600 hover:!bg-blue-500 !text-white !shadow-lg !shadow-blue-900/20 !transition-all !border-none"
                    />
                  ) : (
                    <button
                      onClick={placeBet}
                      disabled={isProcessing}
                      className="w-full py-3.5 rounded-lg font-bold text-base bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Processing...' : `Buy ${currentOptions[outcome]}`}
                    </button>
                  )}

                  <div className="flex items-start gap-2 text-xs text-gray-500 bg-[#1a1d26] p-3 rounded-lg">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <p>Funds held in contract until resolution. Winners share the pool.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* --- CREATE MODAL (Updated) --- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1e212b] border border-gray-800 rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Create New Market</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Market Question</label>
                <input className="w-full bg-[#242832] border border-gray-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none"
                  value={newContractName} onChange={e => setNewContractName(e.target.value)} placeholder="e.g. Who will win nearby..." />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  className="w-full bg-[#242832] border border-gray-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none"
                  value={selectedCategoryId || ""}
                  onChange={e => setSelectedCategoryId(Number(e.target.value))}
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map(cat => (
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

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2 rounded-lg bg-gray-700 text-white font-medium hover:bg-gray-600">Cancel</button>
                <button
                  onClick={handleCreateMarket}
                  disabled={isCreating}
                  className={`flex-1 py-2 rounded-lg text-white font-bold transition-colors ${isCreating ? 'bg-blue-800 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
                >
                  {isCreating ? 'Accessing Chain...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App
