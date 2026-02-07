import { useCurrentAccount, useSignAndExecuteTransaction, ConnectButton } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, AlertCircle, CheckCircle2, Coins, ArrowLeft, Loader2, Star } from 'lucide-react';
import MarketChart from './components/MarketChart';
import { Navbar } from './components/Navbar';
import { MarketCard } from './components/MarketCard';
import { DebugTools } from './components/DebugTools';
import { ModalProvider, useModal } from './context/ModalContext'; // Import useModal
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
  end_date?: string;
  resolved?: boolean;
  winner?: number;
}

interface Category {
  id: number;
  name: string;
  icon?: string;
}

// Package ID is loaded from environment variable (set in root .env file)
// Define API Base URL: use localhost:3000 in dev, otherwise relative path
const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';

// Package ID is loaded from environment variable (set in root .env file)
const PACKAGE_ID = window.env?.VITE_PACKAGE_ID || import.meta.env.VITE_PACKAGE_ID || "0x0";


function App() {
  return (
    <ModalProvider>
      <AppContent />
    </ModalProvider>
  );
}

function AppContent() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { alert } = useModal(); // Use custom alert

  // Navigation State
  const [view, setView] = useState<'home' | 'market'>('home');
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Betting State
  const [outcome, setOutcome] = useState<number>(0);
  const [amount, setAmount] = useState<string>("1000"); // 1000 MIST default to show visible fee
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

  // Favorites State
  const [favorites, setFavorites] = useState<number[]>([]);

  // Removed old Create Market state variables (now in DebugTools)

  // const [isCreating, setIsCreating] = useState(false); // Moved to DebugTools
  // const [showCreateModal, setShowCreateModal] = useState(false); // Moved to DebugTools

  useEffect(() => {
    // Fetch Categories
    fetch(`${API_BASE}/categories`)
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
    fetch(`${API_BASE}/contracts?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setContracts(data);
        setLoading(false);
        // Force update selectedContract if looking at one
        setSelectedContract(prev => {
          if (!prev) return null;
          const fresh = data.find((c: Contract) => c.id === prev.id);
          return fresh || prev;
        });
      })
      .catch(err => {
        console.error("Failed to fetch contracts:", err);
        setLoading(false);
      });

    // Fetch Favorites if connected
    if (account?.address) {
      fetch(`${API_BASE}/favorites/${account.address}`)
        .then(res => res.json())
        .then(data => setFavorites(data))
        .catch(err => console.error("Failed to fetch favorites:", err));
    } else {
      setFavorites([]);
    }
  }, [activeCategory, searchQuery, categories, refetchVersion, view, account?.address]);

  useEffect(() => {
    if (selectedContract && view === 'market') {
      fetch(`${API_BASE}/contracts/${selectedContract.id}/history?range=${timeRange}&v=${refetchVersion}`)
        .then(res => res.json())
        .then(data => setContractHistory(data))
        .catch(err => console.error(err));
    }
  }, [selectedContract, view, timeRange, refetchVersion]);



  const handleContractClick = (contract: Contract, initialOutcomeIndex: number = 0) => {
    setSelectedContract(contract);
    setOutcome(initialOutcomeIndex);
    setView('market');
    window.scrollTo(0, 0);
  };


  const toggleFavorite = async (e: React.MouseEvent, contractId: number) => {
    e.stopPropagation();
    if (!account?.address) {
      alert("Please connect your wallet to use favorites.");
      return;
    }

    const isFav = favorites.includes(contractId);
    if (isFav) {
      // Remove
      try {
        const res = await fetch(`${API_BASE}/favorites`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet_address: account.address, contract_id: contractId })
        });
        if (res.ok) {
          setFavorites(prev => prev.filter(id => id !== contractId));
        }
      } catch (e) { console.error(e); }
    } else {
      // Add
      try {
        const res = await fetch(`${API_BASE}/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet_address: account.address, contract_id: contractId })
        });
        if (res.ok) {
          setFavorites(prev => [...prev, contractId]);
        }
      } catch (e) { console.error(e); }
    }
  };

  const handleMarketCreated = (newContract: Contract) => {
    setContracts(prev => [...prev, newContract]);
    handleContractClick(newContract);
  };

  const placeBet = () => {
    if (!account) return;
    if (!selectedContract?.address) {
      alert('Error: Market address not found');
      return;
    }

    console.log('=== Place Bet Debug ===');
    console.log('PACKAGE_ID:', PACKAGE_ID);
    console.log('Market Address:', selectedContract.address);
    console.log('Amount:', amount);
    console.log('Outcome:', outcome);
    console.log('======================');

    setIsProcessing(true);

    try {
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [BigInt(amount)]);

      tx.moveCall({
        target: `${PACKAGE_ID}::market::place_bet`,
        arguments: [
          tx.object(selectedContract.address),
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
            setTimeout(async () => {
              // Trigger refreshes
              setSearchQuery(prev => prev + " "); // Hack to trigger contracts refresh? No, let's use a proper trigger.
              // Actually, let's just force a reload of the specific contract's history and list.
              // Because useEffect relies on state, let's add a version counter.
              setRefetchVersion(v => v + 1);
              await alert('Bet placed! Updating market data...');
            }, 2000);
          },
          onError: async (err) => {
            console.error('Error:', err);
            await alert('Error placing bet. Check console for details.');
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

  /* Logic to calculate odds and volume for display in outcome buttons */
  const currentOdds: number[] = (() => {
    if (!selectedContract) return [];
    let prices: number[] = [];
    if (selectedContract.outcome_odds) {
      try {
        prices = JSON.parse(selectedContract.outcome_odds);
      } catch (e) { console.error(e); }
    }
    if (prices.length !== currentOptions.length) {
      prices = new Array(currentOptions.length).fill(1.0 / currentOptions.length);
    }
    return prices;
  })();

  const formatMistShort = (val: number) => {
    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return val.toFixed(0);
  };

  const totalVolMist = selectedContract ? selectedContract.total_volume * 1_000_000_000 : 0;

  // Backend filtering is now used
  const finalDisplayContracts = activeCategory === "Favorites"
    ? contracts.filter(c => favorites.includes(c.id))
    : contracts;

  return (
    <div className="min-h-screen bg-[#1a1d26] text-white font-sans selection:bg-blue-500 selection:text-white pb-20">
      <Navbar onSearch={setSearchQuery} />

      {/* --- HOME VIEW --- */}
      {view === 'home' && (
        <main className="max-w-[1440px] mx-auto px-4 md:px-6">

          {/* Subheader / Categories */}
          <div className="flex items-center gap-2 overflow-x-auto py-4 border-b border-gray-800 scrollbar-hide mb-6">
            <button
              onClick={() => setActiveCategory("Favorites")}
              className={clsx(
                "flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors",
                activeCategory === "Favorites"
                  ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                  : "text-gray-400 hover:text-yellow-500 hover:bg-yellow-500/5"
              )}
            >
              <Star className={clsx("w-4 h-4", activeCategory === "Favorites" ? "fill-yellow-500" : "")} />
              Favorites
            </button>
            <div className="w-px h-6 bg-gray-800 mx-1" />
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
          </div>

          {/* Featured / Hero Section (Optional, mimicking "Trending" or large card) */}
          {finalDisplayContracts.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-white" />
                <h2 className="text-xl font-bold">Trending</h2>
              </div>

              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {finalDisplayContracts.map(contract => (
                    <MarketCard
                      key={contract.id}
                      contract={contract}
                      onClick={handleContractClick}
                      isFavorite={favorites.includes(contract.id)}
                      onToggleFavorite={(e) => toggleFavorite(e, contract.id)}
                    />
                  ))}
                </div>
              )}

              {finalDisplayContracts.length === 0 && !loading && (
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
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-100 mb-6 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Markets
          </button>

          <div className="grid gap-8 md:grid-cols-12">
            {/* Left Col: Chart & Info */}
            <div className="md:col-span-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 cyber-badge rounded-xl flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-cyan-200" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white leading-tight mb-2">
                    {selectedContract.name}
                  </h1>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span className="cyber-chip text-xs font-bold uppercase">
                      {categories.find(c => c.id === selectedContract.category_id)?.name || 'Uncategorized'}
                    </span>
                    <span>Vol. {(selectedContract.total_volume * 1_000_000_000).toFixed(0)} MIST</span>
                    <span>
                      {selectedContract.end_date
                        ? `Ends ${new Date(selectedContract.end_date).toLocaleDateString()}`
                        : 'No end date'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="cyber-panel p-6 min-h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-200">Outcome Probability</h3>
                  <div className="flex gap-2">
                    {['5m', '1h', '6h', '1d', '1w', '1M'].map(t => (
                      <button
                        key={t}
                        onClick={() => setTimeRange(t)}
                        className={`px-2 py-1 text-xs font-medium rounded uppercase cyber-tab ${timeRange === t ? 'cyber-tab--active' : ''}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <MarketChart data={contractHistory} options={currentOptions} />
              </div>

              {/* Description or Rules */}
              <div className="cyber-panel p-6">
                <h3 className="font-bold text-white mb-2">Rules</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {selectedContract.description || "This market will resolve to the option that occurs. Result is determined by the designated Oracle."}
                </p>
              </div>
            </div>

            {/* Right Col: Trade */}
            <div className="md:col-span-4">
              <div className="sticky top-6 cyber-panel p-0 overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-slate-800/70 cyber-panel__header">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-300" />
                    {selectedContract.resolved ? 'Market Resolved' : 'Trade'}
                  </h3>
                </div>

                {/* Resolved Market Banner */}
                {selectedContract.resolved && (
                  <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/20">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold mb-2">
                      <CheckCircle2 className="w-5 h-5" />
                      Winner: {currentOptions[selectedContract.winner ?? 0]}
                    </div>
                    <p className="text-sm text-gray-400">
                      This market has been resolved. Betting is closed.
                    </p>
                  </div>
                )}

                <div className="p-5 space-y-6">
                  {/* Outcome Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Select Outcome</label>
                    <div className="grid grid-cols-2 gap-3">
                      {currentOptions.map((opt: string, idx: number) => {
                        // Calculate stats
                        const price = currentOdds[idx] || 0;
                        const percent = Math.round(price * 100);
                        const mist = price * totalVolMist;

                        return (
                          <button
                            key={idx}
                            onClick={() => !selectedContract.resolved && setOutcome(idx)}
                            disabled={selectedContract.resolved}
                            className={clsx(
                              "px-3 py-2.5 rounded-lg text-sm font-bold border transition-all text-center relative flex flex-col items-stretch gap-2 min-h-[4rem] cyber-option",
                              selectedContract.resolved && selectedContract.winner === idx
                                ? "cyber-option--win"
                                : selectedContract.resolved
                                  ? "cyber-option--disabled"
                                  : outcome === idx
                                    ? "cyber-option--active"
                                    : "cyber-option--idle"
                            )}
                          >
                            <div className="w-full grid grid-cols-2 gap-2 items-center tabular-nums">
                              <div className="flex flex-col justify-between min-h-[2.5rem]">
                                <span className="text-sm font-semibold tracking-wide text-slate-100">
                                  {opt}
                                </span>
                                <span className="text-base font-mono font-bold text-cyan-200">
                                  {percent}%
                                </span>
                              </div>
                              <div className="flex items-center justify-center">
                                <span className="text-sm font-mono text-slate-200">
                                  {formatMistShort(mist)}
                                </span>
                              </div>
                            </div>
                            {!selectedContract.resolved && outcome === idx && <CheckCircle2 className="w-4 h-4 absolute top-1 right-1 text-blue-500" />}
                            {selectedContract.resolved && selectedContract.winner === idx && <CheckCircle2 className="w-4 h-4 absolute top-1 right-1 text-green-500" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Amount Input - only show if not resolved */}
                  {!selectedContract.resolved && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Amount (MIST)</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full rounded-lg px-4 py-3 text-white font-mono focus:outline-none transition-all duration-200 cyber-input cyber-number"
                          />
                        </div>
                      </div>

                      {/* Platform Fee Display */}
                      {amount && parseFloat(amount) > 0 && (
                        <div className="space-y-2 cyber-panel--sub p-3 rounded-lg border border-slate-800/70">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Your Bet</span>
                            <span className="font-mono">{amount} MIST</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Platform Fee (2%)</span>
                            <span className="font-mono text-amber-300">
                              -{Math.floor(parseFloat(amount) * 0.02)} MIST
                            </span>
                          </div>
                          <div className="h-px bg-slate-700" />
                          <div className="flex justify-between text-sm font-bold text-white">
                            <span>Into Pool</span>
                            <span className="font-mono text-cyan-300">
                              {/* Calculate Pool as Amount - Fee to ensure sum is correct (avoiding float precision issues like 10 * 0.98 = 9.8 -> 9) */}
                              {Math.floor(parseFloat(amount)) - Math.floor(parseFloat(amount) * 0.02)} MIST
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      {!account ? (
                        <ConnectButton
                          className="!w-full !py-3.5 !rounded-lg !font-bold !text-base !border-none cyber-button"
                        />
                      ) : (
                        <button
                          onClick={placeBet}
                          disabled={isProcessing}
                          className="w-full py-3.5 rounded-lg font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed cyber-button"
                        >
                          {isProcessing ? 'Processing...' : `Buy ${currentOptions[outcome]}`}
                        </button>
                      )}

                      <div className="flex items-start gap-2 text-xs text-slate-400 p-3 rounded-lg cyber-note">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-cyan-200" />
                        <p>A 2% platform fee is deducted from your bet. Remaining funds held in contract until resolution. Winners share the pool.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      <DebugTools categories={categories} contracts={contracts} onMarketCreated={handleMarketCreated} />

    </div>
  )
}

export default App
