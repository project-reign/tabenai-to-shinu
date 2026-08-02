# SURVIVAL 50 固定シード・プレイログ

このログは `TabenaiSurvival.playSeed` で生成し、ゲーム本体と同じイベント抽選、効果、日次処理、終端判定を使用する。方針判断用乱数は保存ゲームPRNGから独立している。v4.9.0のrare抽選変更後に再生成し、同じseedと方針を二度実行した完全一致を確認した。

## 食べられる物をほぼ全部食べる

- seed: 4500101
- policy: allConsume
- outcome: clear / day 50 / survival_preserved
- rare: natural 1 / pity 0 / longest drought 39
- rare event: day 44 `food-refuses`（natural）
- conditional: day 11 `tako-return`, day 26 `invisible-market`, day 28 `future-note`, day 29 `jr-hunger`, day 33 `bean-homecoming`, day 39 `ancient-breath`, day 46 `shadow-snack`, day 48 `jr-hunger`
- milestone: day 10 / 20 / 30 / 40
- game PRNG: 4500101 -> 372994683
- policy PRNG: 2783047903 -> 2783047903
- trace digest: 14cd7df8
- event sequence: `forgotten-kit → jr-shell → white-tablet → undying-fire → bone-biscuit → forgotten-kit → moon-mushroom → tako-egg-sac → moss-vending → milestone-stockpile → tako-return → jr-shell → double-footprints → vacant-table → whisper-can → forgotten-kit → steam-soup → white-tablet → double-footprints → milestone-taxman → undying-fire → three-soil-sacks → bone-biscuit → stored-bread → double-footprints → invisible-market → shadow-plate → future-note → jr-hunger → milestone-seat → steam-soup → inverted-rain → bean-homecoming → stored-bread → double-footprints → white-tablet → undying-fire → vacant-table → ancient-breath → milestone-menu → steam-soup → whisper-can → moss-vending → food-refuses → undying-fire → shadow-snack → whisper-can → jr-hunger → tako-egg-sac → final-pair → final-select-preserved-living → final-commit`

## 危険そうな物を拒否する慎重プレイ

- seed: 4500202
- policy: cautiousVisible
- outcome: clear / day 50 / survival_refuse
- rare: natural 0 / pity 0 / longest drought 45
- rare event: なし
- conditional: day 23 `tako-return`, day 25 `future-note`, day 27 `shadow-snack`, day 47 `invisible-market`, day 48 `shadow-snack`
- milestone: day 10 / 20 / 30 / 40
- game PRNG: 4500202 -> 1004830454
- policy PRNG: 2783047856 -> 2783047856
- trace digest: 6f9dee5f
- event sequence: `moss-vending → vacant-table → moon-mushroom → steam-soup → forgotten-kit → moss-vending → shadow-plate → vacant-table → inverted-rain → milestone-stockpile → whisper-can → tako-egg-sac → double-footprints → moon-mushroom → stored-bread → forgotten-kit → steam-soup → inverted-rain → undying-fire → milestone-taxman → whisper-can → steam-soup → tako-return → bone-biscuit → future-note → whisper-can → shadow-snack → shadow-plate → tako-egg-sac → milestone-seat → whisper-can → stored-bread → forgotten-kit → moss-vending → white-tablet → moon-mushroom → stored-bread → inverted-rain → white-tablet → milestone-menu → undying-fire → bone-biscuit → inverted-rain → stored-bread → white-tablet → bone-biscuit → invisible-market → shadow-snack → undying-fire → final-pair → final-select-preserved-living → final-commit`

true rareが0回でも、因縁／仲間イベント5件と10日ごとの節目が特殊なテンポを補い、最終拒否で生還できる。

## HPと空腹を見ながら判断するバランスプレイ

- seed: 4500303
- policy: humanLike
- outcome: clear / day 50 / survival_refuse
- rare: natural 1 / pity 0 / longest drought 33
- rare event: day 37 `second-player`（natural）
- conditional: day 17 `bean-homecoming`, day 21 `tako-return`, day 43 `future-note`, day 47 `shadow-snack`, day 48 `lost-birthday`
- milestone: day 10 / 20 / 30 / 40
- game PRNG: 4500303 -> 1004830555
- policy PRNG: 2783047957 -> 3535189721
- trace digest: bf1cf4e9
- event sequence: `moss-vending → undying-fire → steam-soup → three-soil-sacks → inverted-rain → white-tablet → steam-soup → undying-fire → jr-shell → milestone-stockpile → moon-mushroom → vacant-table → double-footprints → three-soil-sacks → shadow-plate → moss-vending → bean-homecoming → tako-egg-sac → vacant-table → milestone-taxman → tako-return → whisper-can → moss-vending → steam-soup → forgotten-kit → inverted-rain → undying-fire → stored-bread → bone-biscuit → milestone-seat → inverted-rain → forgotten-kit → white-tablet → whisper-can → double-footprints → undying-fire → second-player → whisper-can → shadow-plate → milestone-menu → steam-soup → stored-bread → future-note → forgotten-kit → white-tablet → double-footprints → shadow-snack → lost-birthday → whisper-can → final-pair → final-select-empty-return → final-commit`
