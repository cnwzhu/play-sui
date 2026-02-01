module polymarket::market {
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::table::{Self, Table};

    // --- Errors ---
    const EMarketAlreadyResolved: u64 = 0;
    const EMarketNotResolved: u64 = 1;
    const EInvalidOutcome: u64 = 2;
    const ENotAuthorized: u64 = 3;
    const ENoWinnings: u64 = 4;
    const EInvalidPlatformFee: u64 = 5;
    const ENoFees: u64 = 6;

    // --- Structs ---

    /// Represents a prediction market
    public struct Market has key {
        id: UID,
        question: vector<u8>,
        options_count: u8,
        total_stakes: vector<u64>, // Index i = total stake for outcome i
        resolved: bool,
        winner: Option<u8>, // The winning option index
        
        // Escrow funds - stored in a Table for multiple outcomes
        outcome_balances: Table<u8, Balance<SUI>>,
        
        // Oracle who can resolve this market
        oracle: address,
        
        // Platform fee configuration
        platform_fee_bps: u16,        // Platform fee rate in basis points (1% = 100)
        platform_balance: Balance<SUI>, // Accumulated platform fees
        platform_admin: address,       // Platform admin who can withdraw fees
    }

    /// A receipt/ticket representing a bet. 
    public struct BetReceipt has key, store {
        id: UID,
        market_id: ID,
        outcome: u8,
        amount: u64,
    }

    // --- Events ---
    public struct MarketCreated has copy, drop {
        id: ID,
        question: vector<u8>,
        options_count: u8,
        oracle: address,
    }

    public struct BetPlaced has copy, drop {
        market_id: ID,
        better: address,
        outcome: u8,
        amount: u64,
        platform_fee: u64,          // Platform fee deducted
        amount_in_pool: u64,        // Amount that went into the pool
        // Snapshot of the pool after this bet
        pool_amounts: vector<u64>, 
        total_supply: u64
    }

    public struct MarketResolved has copy, drop {
        market_id: ID,
        winner: u8,
    }

    // --- Functions ---

    /// Create a new market
    public entry fun create_market(
        question: vector<u8>,
        options_count: u8,
        oracle: address,
        platform_fee_bps: u16,      // Platform fee in basis points (e.g., 200 = 2%)
        platform_admin: address,     // Platform admin address
        ctx: &mut TxContext
    ) {
        assert!(options_count > 1, EInvalidOutcome);
        assert!(platform_fee_bps <= 1000, EInvalidPlatformFee); // Max 10% fee

        let mut outcome_balances = table::new<u8, Balance<SUI>>(ctx);
        let mut total_stakes = vector::empty<u64>();
        
        let mut i = 0;
        while (i < options_count) {
            table::add(&mut outcome_balances, i, balance::zero());
            vector::push_back(&mut total_stakes, 0);
            i = i + 1;
        };

        let market = Market {
            id: object::new(ctx),
            question,
            options_count,
            total_stakes,
            resolved: false,
            winner: option::none(),
            outcome_balances,
            oracle,
            platform_fee_bps,
            platform_balance: balance::zero<SUI>(),
            platform_admin,
        };

        event::emit(MarketCreated {
            id: object::id(&market),
            question,
            options_count,
            oracle,
        });

        transfer::share_object(market);
    }

    /// Place a bet
    /// outcome: index of the option
    public entry fun place_bet(
        market: &mut Market,
        payment: Coin<SUI>,
        outcome: u8,
        ctx: &mut TxContext
    ) {
        assert!(!market.resolved, EMarketAlreadyResolved);
        assert!(outcome < market.options_count, EInvalidOutcome);

        let total_amount = coin::value(&payment);
        
        // Calculate platform fee
        let platform_fee = ((total_amount as u128) * (market.platform_fee_bps as u128) / 10000) as u64;
        let amount_in_pool = total_amount - platform_fee;
        
        let mut coin_balance = coin::into_balance(payment);
        
        // Split platform fee from payment
        if (platform_fee > 0) {
            let fee_balance = balance::split(&mut coin_balance, platform_fee);
            balance::join(&mut market.platform_balance, fee_balance);
        };

        // Update balance with remaining amount
        let balance_ref = table::borrow_mut(&mut market.outcome_balances, outcome);
        balance::join(balance_ref, coin_balance);

        // Update stakes record with amount that went into pool
        let current_stake = *vector::borrow(&market.total_stakes, (outcome as u64));
        let chunk_ref = vector::borrow_mut(&mut market.total_stakes, (outcome as u64));
        *chunk_ref = current_stake + amount_in_pool;

        let receipt = BetReceipt {
            id: object::new(ctx),
            market_id: object::id(market),
            outcome,
            amount: amount_in_pool,  // Receipt reflects actual pool amount
        };

        // Calculate total supply for event
        let mut total_supply: u64 = 0;
        let mut i = 0;
        while (i < market.options_count) {
            let stake = *vector::borrow(&market.total_stakes, (i as u64));
            total_supply = total_supply + stake;
            i = i + 1;
        };

        event::emit(BetPlaced {
            market_id: object::id(market),
            better: tx_context::sender(ctx),
            outcome,
            amount: total_amount,
            platform_fee,
            amount_in_pool,
            pool_amounts: market.total_stakes,
            total_supply
        });

        transfer::public_transfer(receipt, tx_context::sender(ctx));
    }

    /// Withdraw accumulated platform fees (Platform admin only)
    public entry fun withdraw_platform_fees(
        market: &mut Market,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == market.platform_admin, ENotAuthorized);
        let amount = balance::value(&market.platform_balance);
        assert!(amount > 0, ENoFees);
        
        let fees = balance::withdraw_all(&mut market.platform_balance);
        let coin_payment = coin::from_balance(fees, ctx);
        transfer::public_transfer(coin_payment, tx_context::sender(ctx));
    }

    /// Resolve the market (Oracle only)
    public entry fun resolve_market(
        market: &mut Market,
        winner: u8,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == market.oracle, ENotAuthorized);
        assert!(!market.resolved, EMarketAlreadyResolved);
        assert!(winner < market.options_count, EInvalidOutcome);

        market.resolved = true;
        market.winner = option::some(winner);

        event::emit(MarketResolved {
            market_id: object::id(market),
            winner,
        });
    }

    /// Claim winnings
    public entry fun claim_reward(
        market: &mut Market,
        receipt: BetReceipt,
        ctx: &mut TxContext
    ) {
        assert!(market.resolved, EMarketNotResolved);
        
        let BetReceipt { id, market_id, outcome, amount } = receipt;
        object::delete(id);

        assert!(market_id == object::id(market), EInvalidOutcome);
        
        let winner_idx = *option::borrow(&market.winner);
        let did_win = winner_idx == outcome;

        if (did_win) {
            // Calculate total pool (from initial stakes)
            let mut total_pool_initial: u128 = 0;
            let mut i = 0;
            while (i < market.options_count) {
                let stake = *vector::borrow(&market.total_stakes, (i as u64));
                total_pool_initial = total_pool_initial + (stake as u128);
                i = i + 1;
            };

            let my_side_total = *vector::borrow(&market.total_stakes, (outcome as u64));
            
            // Reward = (MyAmount / MySideTotal) * TotalPool
            let reward_amount = if (my_side_total > 0) {
                 ((amount as u128) * total_pool_initial / (my_side_total as u128)) as u64
            } else {
                amount // Should not happen if did_win is true and amount > 0
            };

            let mut payment = balance::zero<SUI>();
            let mut remaining = reward_amount;
            
            // Drain from pools until satisfied
            // We iterate through all balances in the table
            let mut j = 0;
            while (j < market.options_count && remaining > 0) {
                let pool_bal = table::borrow_mut(&mut market.outcome_balances, j);
                let available = balance::value(pool_bal);
                let take = if (available >= remaining) { remaining } else { available };
                
                if (take > 0) {
                    balance::join(&mut payment, balance::split(pool_bal, take));
                    remaining = remaining - take;
                };
                j = j + 1;
            };

            let coin_payment = coin::from_balance(payment, ctx);
            transfer::public_transfer(coin_payment, tx_context::sender(ctx));

        } else {
            // Loser
        };
    }
}
