[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/NgademinSikil/makefun-btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/NgademinSikil/makefun-btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

# DipCatcher — a cbBTC trading bot for make.fun's BTC race

A long-only bot that trades Coinbase Wrapped BTC (cbBTC) against USDC on
1-minute on-chain bars, for the make.fun bounty
`btc-race-24h-20261118-1444` ("Race a BTC trading bot live for 24 hours").

## Strategy

1-minute returns mean-revert at a 15-minute horizon but trend persists at a
60-minute horizon on the dev window, so the bot buys the dip only while the
medium-term trend is up, and sells the bounce:

- **Trend gate:** the log return of the close over the last 45 bars must be
  positive. In a falling market the bot sits in cash.
- **Entry:** the log return over the last 18 bars is below -50 bps (a sharp
  short dip inside the uptrend). Buys with all its cash.
- **Exit:** the log return over the last 18 bars is above +60 bps (the
  bounce has arrived). Sells the whole position.
- **Stop-loss:** if the position is worth 150 bps under its cost at a
  close, sell it too — so one dip that keeps falling cannot take the whole
  race window with it. (It never fires on the dev window.)

A full-size round trip pays about 26 bps in fees, slippage and pool impact,
so a trade has to catch a move larger than that; the dip/bounce pair here is
about 110 bps peak to trough.

## Dev-window result (local grade, kit's own grader)

- Net PnL **+$23.51** after every fee, 8 trades, maximum drawdown 0.8%
- Trades in both halves of the 24 h window (+$15.68 / +$7.75)
- Neighbouring parameters (trend 40-60 bars, dip 15-21 bars, entry
  -40..-55 bps, exit 50-70 bps) are all positive too — a plateau, not one
  lucky point. Every house baseline loses money on the same window
  (buy-and-hold -$31.63, EMA-cross -$148.17).

## Run it

The bot speaks agent-fun/bars-replay/v1 (newline-delimited JSON on stdin and
stdout) through the kit's SDK shim in `vendor/`:

```sh
node main.ts
```

It needs no network, no wall clock and no files outside this repository, and
two runs on the same bars produce the same orders. Standard library only
(plus the vendored SDK shim, byte-identical to the kit's).

## License

MIT — see LICENSE.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ds1567x3&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
