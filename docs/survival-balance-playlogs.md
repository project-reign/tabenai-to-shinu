# SURVIVAL 50 固定シード・プレイログ

このログは TabenaiSurvival.playSeed で生成し、ゲーム本体と同じイベント抽選、効果、日次処理、終端判定を使用する。方針判断用乱数は保存ゲームPRNGから独立している。

## 食べられる物をほぼ全部食べる

- seed: 4500101
- policy: allConsume
- outcome: death / day 45 / death
- rare: natural 2 / pity 1 / longest drought 14
- game PRNG: 4500101 -> 436935880
- policy PRNG: 2783047903 -> 2783047903
- trace digest: a7fd5d84

| step | day | event | choice | HP | 空腹 | visible risk | terminal |
| ---: | ---: | --- | --- | ---: | ---: | --- | --- |
| 1 | 1 | forgotten-kit | 0: 手当てする | 92→96 | 28→30 | medium | — |
| 2 | 2 | jr-shell | 0: 薬草ごと取り込む | 96→98 | 30→32 | low | — |
| 3 | 3 | white-tablet | 0: 服用する | 98→85 | 32→34 | medium | — |
| 4 | 4 | undying-fire | 0: 少し休む | 85→84 | 34→37 | low | — |
| 5 | 5 | bone-biscuit | 0: 一枚食べる | 84→81 | 37→30 | medium | — |
| 6 | 6 | forgotten-kit | 0: 手当てする | 81→83 | 30→32 | medium | — |
| 7 | 7 | moon-mushroom | 0: 焼いて食べる | 83→67 | 32→29 | medium | — |
| 8 | 8 | tako-alive | 0: 保存魚を送る | 67→63 | 29→27 | safe | — |
| 9 | 9 | bone-biscuit | 0: 一枚食べる | 63→60 | 27→20 | medium | — |
| 10 | 10 | milestone-stockpile | 0: 食料を均等に分ける | 60→58 | 20→14 | low | — |
| 11 | 11 | shadow-plate | 0: 影へ分ける | 58→58 | 14→12 | low | — |
| 12 | 12 | jr-shell | 0: 薬草ごと取り込む | 58→62 | 12→14 | low | — |
| 13 | 13 | food-refuses | 0: 理由を聞く | 62→64 | 14→13 | low | — |
| 14 | 14 | vacant-table | 0: 席を整える | 64→64 | 13→15 | low | — |
| 15 | 15 | whisper-can | 0: 開けて食べる | 64→52 | 15→5 | high | — |
| 16 | 16 | forgotten-kit | 0: 手当てする | 52→50 | 5→7 | safe | — |
| 17 | 17 | steam-soup | 0: 湯気を飲む | 50→43 | 7→2 | medium | — |
| 18 | 18 | white-tablet | 0: 服用する | 43→50 | 2→4 | low | — |
| 19 | 19 | undying-fire | 0: 少し休む | 50→55 | 4→7 | low | — |
| 20 | 20 | milestone-taxman | 0: 備蓄から納める | 55→55 | 7→11 | safe | — |
| 21 | 21 | double-footprints | 0: 足跡を追う | 55→57 | 11→13 | low | — |
| 22 | 22 | shadow-plate | 0: 影へ分ける | 57→57 | 13→11 | low | — |
| 23 | 23 | bone-biscuit | 0: 一枚食べる | 57→54 | 11→4 | medium | — |
| 24 | 24 | stored-bread | 0: 少し食べる | 54→44 | 4→2 | medium | — |
| 25 | 25 | double-footprints | 0: 足跡を追う | 44→40 | 2→4 | low | — |
| 26 | 26 | shadow-snack | 0: 影と食べる | 40→34 | 4→2 | high | — |
| 27 | 27 | three-soil-sacks | 0: 黒豆を持っていく | 34→30 | 2→2 | low | — |
| 28 | 28 | future-note | 0: 読む | 30→30 | 2→4 | low | — |
| 29 | 29 | forest-manager | 0: 薬草を受け取る | 30→37 | 4→6 | low | — |
| 30 | 30 | milestone-seat | 0: 空席も整える | 37→41 | 6→8 | low | — |
| 31 | 31 | steam-soup | 0: 湯気を飲む | 41→40 | 8→3 | medium | — |
| 32 | 32 | inverted-rain | 0: 飲む | 40→34 | 3→2 | medium | — |
| 33 | 33 | jr-hunger | 0: 薬草を与える | 34→34 | 2→4 | safe | — |
| 34 | 34 | stored-bread | 0: 少し食べる | 34→23 | 4→2 | medium | — |
| 35 | 35 | double-footprints | 0: 足跡を追う | 23→19 | 2→4 | low | — |
| 36 | 36 | white-tablet | 0: 服用する | 19→27 | 4→6 | low | — |
| 37 | 37 | undying-fire | 0: 少し休む | 27→32 | 6→9 | low | — |
| 38 | 38 | vacant-table | 0: 席を整える | 32→31 | 9→11 | low | — |
| 39 | 39 | ancient-breath | 0: 呼吸を合わせる | 31→36 | 11→13 | low | — |
| 40 | 40 | milestone-menu | 0: 献立を記憶する | 36→38 | 13→15 | low | — |
| 41 | 41 | steam-soup | 0: 湯気を飲む | 38→36 | 15→10 | medium | — |
| 42 | 42 | moon-mushroom | 0: 焼いて食べる | 36→26 | 10→2 | high | — |
| 43 | 43 | stored-bread | 0: 少し食べる | 26→13 | 2→2 | medium | — |
| 44 | 44 | double-footprints | 0: 足跡を追う | 13→4 | 2→4 | low | — |
| 45 | 45 | tako-return | 0: 保存魚を分け合う | 4→0 | 4→2 | low | death |

## 危険そうな物を拒否する慎重プレイ

- seed: 4500202
- policy: cautiousVisible
- outcome: clear / day 50 / survival_refuse
- rare: natural 0 / pity 3 / longest drought 14
- game PRNG: 4500202 -> 1004830454
- policy PRNG: 2783047856 -> 2783047856
- trace digest: 7868a889

| step | day | event | choice | HP | 空腹 | visible risk | terminal |
| ---: | ---: | --- | --- | ---: | ---: | --- | --- |
| 1 | 1 | moss-vending | 1: 何も買わない | 92→92 | 28→32 | safe | — |
| 2 | 2 | vacant-table | 1: 何もしない | 92→92 | 32→36 | safe | — |
| 3 | 3 | moon-mushroom | 1: 食べない | 92→92 | 36→41 | safe | — |
| 4 | 4 | steam-soup | 1: 飲まない | 92→92 | 41→46 | safe | — |
| 5 | 5 | forgotten-kit | 1: 使わない | 92→92 | 46→50 | safe | — |
| 6 | 6 | moss-vending | 1: 何も買わない | 92→92 | 50→54 | safe | — |
| 7 | 7 | shadow-plate | 0: 影へ分ける | 92→92 | 54→52 | low | — |
| 8 | 8 | vacant-table | 1: 何もしない | 92→92 | 52→56 | safe | — |
| 9 | 9 | inverted-rain | 0: 飲む | 92→89 | 56→51 | medium | — |
| 10 | 10 | milestone-stockpile | 1: 何も食べず温存する | 89→87 | 51→56 | safe | — |
| 11 | 11 | whisper-can | 1: 食べない | 87→87 | 56→62 | safe | — |
| 12 | 12 | tako-egg-sac | 0: 保護する | 87→87 | 62→59 | low | — |
| 13 | 13 | double-footprints | 1: 何もしない | 87→87 | 59→63 | safe | — |
| 14 | 14 | moon-mushroom | 0: 焼いて食べる | 87→90 | 63→54 | medium | — |
| 15 | 15 | stored-bread | 1: 食べない | 90→90 | 54→59 | safe | — |
| 16 | 16 | food-refuses | 1: 食べない | 90→90 | 59→63 | safe | — |
| 17 | 17 | moss-vending | 0: 透明な飲料を買う | 90→90 | 63→57 | low | — |
| 18 | 18 | inverted-rain | 0: 飲む | 90→91 | 57→52 | safe | — |
| 19 | 19 | undying-fire | 1: 何もしない | 91→91 | 52→56 | safe | — |
| 20 | 20 | milestone-taxman | 0: 備蓄から納める | 91→91 | 56→60 | safe | — |
| 21 | 21 | whisper-can | 0: 開けて食べる | 91→93 | 60→50 | low | — |
| 22 | 22 | steam-soup | 1: 飲まない | 93→93 | 50→55 | safe | — |
| 23 | 23 | shadow-snack | 1: 食べない | 93→93 | 55→60 | safe | — |
| 24 | 24 | forgotten-kit | 1: 使わない | 93→93 | 60→64 | safe | — |
| 25 | 25 | future-note | 1: 何もしない | 93→93 | 64→68 | safe | — |
| 26 | 26 | whisper-can | 0: 開けて食べる | 93→95 | 68→58 | low | — |
| 27 | 27 | invisible-market | 0: 清潔な水を買う | 95→99 | 58→51 | low | — |
| 28 | 28 | tako-return | 1: 食べない | 99→99 | 51→56 | safe | — |
| 29 | 29 | jr-shell | 1: 服用しない | 99→99 | 56→60 | safe | — |
| 30 | 30 | milestone-seat | 1: 何もしない | 99→99 | 60→64 | safe | — |
| 31 | 31 | whisper-can | 0: 開けて食べる | 99→100 | 64→54 | low | — |
| 32 | 32 | stored-bread | 1: 食べない | 100→99 | 54→59 | safe | — |
| 33 | 33 | food-refuses | 1: 食べない | 99→99 | 59→63 | safe | — |
| 34 | 34 | bone-biscuit | 0: 一枚食べる | 99→99 | 63→56 | low | — |
| 35 | 35 | white-tablet | 1: 服用しない | 99→99 | 56→60 | safe | — |
| 36 | 36 | moon-mushroom | 0: 焼いて食べる | 99→99 | 60→51 | medium | — |
| 37 | 37 | stored-bread | 1: 食べない | 99→99 | 51→56 | safe | — |
| 38 | 38 | inverted-rain | 0: 飲む | 99→99 | 56→51 | safe | — |
| 39 | 39 | white-tablet | 1: 服用しない | 99→99 | 51→55 | safe | — |
| 40 | 40 | milestone-menu | 1: 何もしない | 99→98 | 55→59 | safe | — |
| 41 | 41 | undying-fire | 1: 何もしない | 98→97 | 59→63 | safe | — |
| 42 | 42 | forgotten-kit | 1: 使わない | 97→96 | 63→67 | safe | — |
| 43 | 43 | steam-soup | 0: 湯気を飲む | 96→98 | 67→62 | low | — |
| 44 | 44 | stored-bread | 0: 少し食べる | 98→99 | 62→54 | low | — |
| 45 | 45 | inverted-rain | 0: 飲む | 99→99 | 54→49 | safe | — |
| 46 | 46 | bone-biscuit | 1: 食べない | 99→98 | 49→54 | safe | — |
| 47 | 47 | shadow-snack | 1: 食べない | 98→97 | 54→59 | safe | — |
| 48 | 48 | shadow-plate | 0: 影へ分ける | 97→96 | 59→57 | low | — |
| 49 | 49 | nonexistent-day51 | 1: 何もしない | 96→95 | 57→60 | safe | — |
| 50 | 50 | final-pair | 0: 保存食／生きている箱 | 95→95 | 60→60 | low | — |
| 51 | 50 | final-select-preserved-living | 0: 保存食の箱 | 95→95 | 60→60 | low | — |
| 52 | 50 | final-commit | 1: 拒否する | 95→95 | 60→60 | safe | clear |

## HPと空腹を見ながら判断するバランスプレイ

- seed: 4500303
- policy: humanLike
- outcome: clear / day 50 / survival_empty
- rare: natural 3 / pity 1 / longest drought 14
- game PRNG: 4500303 -> 1636666225
- policy PRNG: 2783047957 -> 3535189721
- trace digest: 2e27294e

| step | day | event | choice | HP | 空腹 | visible risk | terminal |
| ---: | ---: | --- | --- | ---: | ---: | --- | --- |
| 1 | 1 | moss-vending | 1: 何も買わない | 92→92 | 28→32 | safe | — |
| 2 | 2 | undying-fire | 1: 何もしない | 92→92 | 32→36 | safe | — |
| 3 | 3 | steam-soup | 1: 飲まない | 92→92 | 36→41 | safe | — |
| 4 | 4 | three-soil-sacks | 0: 黒豆を持っていく | 92→92 | 41→40 | low | — |
| 5 | 5 | inverted-rain | 0: 飲む | 92→89 | 40→35 | medium | — |
| 6 | 6 | white-tablet | 1: 服用しない | 89→87 | 35→39 | safe | — |
| 7 | 7 | steam-soup | 0: 湯気を飲む | 87→86 | 39→34 | medium | — |
| 8 | 8 | undying-fire | 0: 少し休む | 86→89 | 34→37 | low | — |
| 9 | 9 | jr-shell | 1: 服用しない | 89→89 | 37→41 | safe | — |
| 10 | 10 | milestone-stockpile | 0: 食料を均等に分ける | 89→89 | 41→35 | low | — |
| 11 | 11 | moon-mushroom | 1: 食べない | 89→89 | 35→40 | safe | — |
| 12 | 12 | vacant-table | 1: 何もしない | 89→89 | 40→44 | safe | — |
| 13 | 13 | double-footprints | 1: 何もしない | 89→89 | 44→48 | safe | — |
| 14 | 14 | three-soil-sacks | 1: 食べない | 89→89 | 48→53 | safe | — |
| 15 | 15 | shadow-plate | 1: 何もしない | 89→89 | 53→58 | safe | — |
| 16 | 16 | food-refuses | 0: 理由を聞く | 89→91 | 58→57 | low | — |
| 17 | 17 | bean-homecoming | 0: 里へ帰す | 91→91 | 57→59 | safe | — |
| 18 | 18 | tako-egg-sac | 0: 保護する | 91→91 | 59→56 | low | — |
| 19 | 19 | vacant-table | 1: 何もしない | 91→91 | 56→60 | safe | — |
| 20 | 20 | milestone-taxman | 1: 何も渡さない | 91→87 | 60→64 | safe | — |
| 21 | 21 | tako-return | 0: 保存魚を分け合う | 87→87 | 64→52 | low | — |
| 22 | 22 | whisper-can | 1: 食べない | 87→87 | 52→58 | safe | — |
| 23 | 23 | second-player | 1: 何もしない | 87→87 | 58→62 | safe | — |
| 24 | 24 | steam-soup | 1: 飲まない | 87→87 | 62→67 | safe | — |
| 25 | 25 | bone-biscuit | 1: 食べない | 87→87 | 67→72 | safe | — |
| 26 | 26 | white-tablet | 1: 服用しない | 87→87 | 72→76 | safe | — |
| 27 | 27 | undying-fire | 0: 少し休む | 87→92 | 76→79 | low | — |
| 28 | 28 | stored-bread | 0: 少し食べる | 92→94 | 79→71 | low | — |
| 29 | 29 | bone-biscuit | 0: 一枚食べる | 94→95 | 71→64 | low | — |
| 30 | 30 | milestone-seat | 1: 何もしない | 95→95 | 64→68 | safe | — |
| 31 | 31 | inverted-rain | 0: 飲む | 95→92 | 68→63 | medium | — |
| 32 | 32 | forgotten-kit | 0: 手当てする | 92→93 | 63→65 | medium | — |
| 33 | 33 | white-tablet | 1: 服用しない | 93→89 | 65→69 | safe | — |
| 34 | 34 | double-footprints | 1: 何もしない | 89→86 | 69→73 | safe | — |
| 35 | 35 | bone-biscuit | 1: 食べない | 86→86 | 73→78 | safe | — |
| 36 | 36 | tako-egg-sac | 0: 保護する | 86→85 | 78→75 | low | — |
| 37 | 37 | stored-bread | 1: 食べない | 85→85 | 75→80 | safe | — |
| 38 | 38 | undying-fire | 1: 何もしない | 85→84 | 80→84 | safe | — |
| 39 | 39 | ordinary-meal | 0: 普通に食べる | 84→92 | 84→68 | low | — |
| 40 | 40 | milestone-menu | 0: 献立を記憶する | 92→94 | 68→70 | low | — |
| 41 | 41 | steam-soup | 0: 湯気を飲む | 94→96 | 70→65 | low | — |
| 42 | 42 | jr-shell | 0: 薬草ごと取り込む | 96→99 | 65→67 | low | — |
| 43 | 43 | nonexistent-day51 | 1: 何もしない | 99→98 | 67→70 | safe | — |
| 44 | 44 | inverted-rain | 0: 飲む | 98→94 | 70→65 | medium | — |
| 45 | 45 | whisper-can | 0: 開けて食べる | 94→93 | 65→55 | low | — |
| 46 | 46 | forgotten-kit | 1: 使わない | 93→92 | 55→59 | safe | — |
| 47 | 47 | double-footprints | 0: 足跡を追う | 92→93 | 59→61 | low | — |
| 48 | 48 | lost-birthday | 0: 一口だけ食べる | 93→92 | 61→53 | low | — |
| 49 | 49 | future-note | 1: 何もしない | 92→91 | 53→57 | safe | — |
| 50 | 50 | final-pair | 1: 空／帰還の箱 | 91→91 | 57→57 | low | — |
| 51 | 50 | final-select-empty-return | 0: 空の箱 | 91→91 | 57→57 | low | — |
| 52 | 50 | final-commit | 0: 開封する | 91→91 | 57→57 | low | clear |
