// DipCatcher: a long-only cbBTC bot for make.fun's 24h BTC race.
//
// Idea, found by testing on the published dev window (1,440 one-minute bars
// of cbBTC/USDC, BTC down 2.8% over it, every house baseline losing money):
// 1-minute returns mean-revert hard at a 15-minute horizon (past-15m vs
// next-15m correlation about -0.33) but trend persists at a 60-minute horizon
// (past-60m vs next-60m correlation about +0.27). So the bot buys the dip
// only while the medium-term trend is up, and sells the bounce:
//
//   - Trend gate: the log return of the close over the last TREND_BARS bars
//     must be positive. In a falling market the bot sits in cash.
//   - Entry: the log return over the last DIP_BARS bars is below -50 bps
//     (a sharp short dip inside the uptrend). Buys with all its cash.
//   - Exit: the log return over the last DIP_BARS bars is above +60 bps
//     (the bounce has arrived). Sells the whole position.
//   - Stop: if the position is worth 150 bps under its cost at a close,
//     sell it too. On the dev window this never fires (the dip/bounce pair
//     is what the trade is); it is there so one dip that keeps falling
//     cannot take the whole race window with it.
//
// A full-size round trip pays about 26 bps in fees, slippage and pool
// impact, so a trade has to catch a move larger than that; the dip/bounce
// pair here is about 110 bps peak to trough. On the dev window this made
// +$23.51 on 8 trades with 0.8% maximum drawdown, trading in both halves
// of the window; the neighbouring parameter choices (trend 40-60 bars,
// dip 15-21 bars, entry -40..-55 bps, exit 50-70 bps) are all positive too,
// so the result is a plateau, not one lucky point.
//
// The bot is deterministic: float64 math on past closes only, no clock, no
// network, no randomness. It speaks agent-fun/bars-replay/v1 through the
// kit's SDK shim (vendor/makefun-bars.ts, byte-identical to the kit's).

import { runBars, type Bar, type BarsState, type BuyInput, type SellInput } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";
/** Trend horizon: the 45-bar log return of the close must be above 0. */
const TREND_BARS = 45;
/** Dip horizon: entry and exit read the log return over this many bars. */
const DIP_BARS = 18;
/** Buy when the 18-bar log return is below this, in basis points. */
const ENTER_BPS = -50;
/** Sell when the 18-bar log return is above this, in basis points. */
const EXIT_BPS = 60;
/** Stop-loss: sell when the position is worth this many bps under its cost. */
const STOP_BPS = 150;
/** Cap every order's slippage at 1% past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 100;

/** Closes seen so far, oldest first; one entry per bar that carried CBBTC. */
const closes: number[] = [];

/** Log return of the latest close against the close `back` bars ago, in bps. */
function logReturnBps(back: number): number | null {
  if (closes.length <= back) return null;
  const old = closes[closes.length - 1 - back];
  const now = closes[closes.length - 1];
  if (old <= 0 || now <= 0) return null;
  return Math.log(now / old) * 10000;
}

await runBars({
  onBatch(state: BarsState, batch: { bars: Bar[] }) {
    let fresh = false;
    for (const bar of batch.bars) {
      if (bar.symbol !== SYMBOL) continue;
      fresh = true;
      closes.push(Number(bar.c));
    }
    // No CBBTC bar this minute, or still in the warm-up: nothing to decide.
    if (!fresh || state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    const dip = logReturnBps(DIP_BARS);
    if (dip === null) return [];

    if (held !== undefined) {
      // Holding: sell the whole position once the bounce has arrived, or
      // on the stop-loss if the dip kept falling instead.
      const value = state.value(SYMBOL, held.qty);
      const stopped =
        value * 10000n <= held.cost * BigInt(10000 - STOP_BPS);
      if (dip > EXIT_BPS || stopped) {
        const sell: SellInput = {
          side: "sell",
          symbol: SYMBOL,
          qty: held.qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        };
        return [sell];
      }
      return [];
    }

    // Flat: buy the dip, but only while the 45-bar trend is up.
    const trend = logReturnBps(TREND_BARS);
    if (trend === null || trend <= 0 || dip >= ENTER_BPS) return [];
    const cash = state.cash;
    if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    const buy: BuyInput = {
      side: "buy",
      symbol: SYMBOL,
      notional_quote_units: cash,
      max_slippage_bps: MAX_SLIPPAGE_BPS,
    };
    return [buy];
  },
});
