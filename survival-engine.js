(() => {
  'use strict';

  const MAX_HP = 100;
  const MAX_HUNGER = 100;
  const PITY_LIMIT = 14;
  const DAILY_HUNGER_COST = 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clone = value => JSON.parse(JSON.stringify(value));
  const CONSUMPTION_KINDS = new Set(['eat', 'drink', 'medicine']);
  const C = (title, description, kind, effect = {}, consumedByPlayer = null) => ({
    title,
    description,
    kind,
    refusal: kind === 'skip',
    consumedByPlayer: consumedByPlayer === null ? CONSUMPTION_KINDS.has(kind) : !!consumedByPlayer,
    effect
  });
  const E = (id, title, category, tags, options, choices) => ({
    id,
    title,
    category,
    tags,
    icon: options.icon || '🏕️',
    text: options.text || '',
    weight: Number(options.weight || (category === 'common' ? 10 : category === 'uncommon' ? 5 : 7)),
    cooldown: Number(options.cooldown || 0),
    oneShot: !!options.oneShot,
    maxEncounters: Number(options.maxEncounters || (options.oneShot ? 1 : 4)),
    condition: options.condition || null,
    day: options.day || null,
    choices
  });

  const events = [
    E('stored-bread', 'ひび割れた保存パン', 'common', ['food'], {
      icon: '🥖', cooldown: 2, maxEncounters: 4,
      text: '乾いた保存パンが岩の上に置かれている。割れ目から、まだ小麦の匂いがした。'
    }, [
      C('少し食べる', '固い部分を削って腹へ入れる。', 'eat', { hp: 2, hunger: -10, status: '保存食で持ち直した', result: '固いが、間違いなく食べられるパンだった。' }),
      C('食べない', '保存状態を信用せず先へ進む。', 'skip', { hunger: 3, result: 'パンを残し、空腹だけを連れて歩いた。' })
    ]),
    E('inverted-rain', '逆さ雨水', 'common', ['drink'], {
      icon: '🌧️', cooldown: 2, maxEncounters: 4,
      text: '地面から空へ落ちる雨が、欠けた瓶に一口分だけ溜まっている。'
    }, [
      C('飲む', '逆流する雫を喉へ流す。', 'drink', { hunger: -7, hp: 1, status: '喉が潤った', result: '水は冷たく、身体の時間だけ正しい向きへ戻った。' }),
      C('飲まない', '法則の違う水には触れない。', 'skip', { hunger: 3, result: '雫は空へ帰り、瓶だけが残った。' })
    ]),
    E('white-tablet', '野戦用の白い錠剤', 'common', ['medicine'], {
      icon: '💊', cooldown: 3, maxEncounters: 3,
      text: '泥のない包装に「野戦用」とだけ印刷された白い錠剤がある。'
    }, [
      C('服用する', '説明のない薬へ賭ける。', 'medicine', {
        chance: {
          label: '白い錠剤の適合',
          probability: 0.74,
          success: { hp: 9, status: '薬が効いた', result: '熱と痛みが静かに引いた。' },
          failure: { hp: -3, status: '軽い副作用', result: '目眩はしたが、致命的な作用ではなかった。' }
        }
      }),
      C('服用しない', '薬を包み直して置いていく。', 'skip', { hunger: 2, result: '薬効も副作用も起こらなかった。' })
    ]),
    E('whisper-can', 'ささやく缶詰', 'common', ['food'], {
      icon: '🥫', cooldown: 3, maxEncounters: 4,
      text: '未開封の缶から「今日は安全」と小さな声がする。'
    }, [
      C('開けて食べる', '声の自己申告を一度だけ信じる。', 'eat', { hunger: -12, hp: 2, result: '豆の煮込みだった。声は食べ終えると黙った。' }),
      C('食べない', '缶の言葉には返事をしない。', 'skip', { hunger: 4, result: '背後で缶が一度だけ舌打ちした。' })
    ]),
    E('moon-mushroom', '月影キノコ', 'common', ['food'], {
      icon: '🍄', cooldown: 4, maxEncounters: 3,
      text: '昼なのに月明かりの影を落とすキノコが群れている。'
    }, [
      C('焼いて食べる', '影が薄い一本を選ぶ。', 'eat', {
        chance: {
          label: '月影の薄い一本',
          probability: 0.68,
          success: { hunger: -11, hp: 3, result: '香ばしく、夜まで身体が軽かった。' },
          failure: { hunger: -5, hp: -4, flags: { hallucination: true }, status: '月影酔い', result: '腹は満ちたが、木々が月のように揺れた。' }
        }
      }),
      C('食べない', '胞子を吸わないよう遠回りする。', 'skip', { hunger: 3, result: '月影は追ってこなかった。' })
    ]),
    E('steam-soup', '湯気だけのスープ', 'common', ['food', 'drink'], {
      icon: '🍲', cooldown: 2, maxEncounters: 4,
      text: '器には何もない。それでも湯気だけが満腹そうに立ち上っている。'
    }, [
      C('湯気を飲む', '器へ口をつけ、温かさを吸う。', 'drink', { hunger: -7, hp: 3, result: '温度だけで少し腹が満ちた。' }),
      C('飲まない', '空の器は空のままにする。', 'skip', { hunger: 3, result: '湯気は別の生存者を探しに流れた。' })
    ]),
    E('moss-vending', '苔むす自販機', 'common', ['drink'], {
      icon: '🥤', cooldown: 3, maxEncounters: 3,
      text: '苔に覆われた自販機が、硬貨の代わりに昨日の失敗を要求している。'
    }, [
      C('透明な飲料を買う', '失敗を一つ思い出してボタンを押す。', 'drink', { hunger: -8, survival: { marketPass: true }, result: '透明な缶と、清掃員市場の通行印が出てきた。' }),
      C('何も買わない', '失敗を手元に残す。', 'skip', { hunger: 2, result: '売切ランプだけが静かに増えた。' })
    ]),
    E('bone-biscuit', '骨型ビスケット', 'common', ['food'], {
      icon: '🦴', cooldown: 2, maxEncounters: 4,
      text: '犬用にも人間用にも見える、骨型のビスケットが二枚ある。'
    }, [
      C('一枚食べる', '原材料表示の読める側を選ぶ。', 'eat', { hunger: -9, hp: 1, result: '味は薄いが、歯も骨も無事だった。' }),
      C('食べない', '誰かの分として二枚とも残す。', 'skip', { hunger: 3, result: '遠くで尻尾を振る音がした。' })
    ]),
    E('forgotten-kit', '忘れられた救急箱', 'common', ['medicine'], {
      icon: '🩹', cooldown: 4, maxEncounters: 3,
      text: '赤十字の一画だけが消えた救急箱。消毒液と包帯はまだ使えそうだ。'
    }, [
      C('手当てする', '傷を洗い、包帯を巻く。', 'medicine', { hp: 8, status: '応急手当て済み', result: '誰の物かは分からないが、手当ては正しく効いた。' }),
      C('使わない', '必要な誰かのため閉じておく。', 'skip', { hunger: 2, result: '救急箱は次の足音を待った。' })
    ]),
    E('undying-fire', '消えない焚き火', 'common', ['wait'], {
      icon: '🔥', cooldown: 3, maxEncounters: 4,
      text: '雨の中でも消えない焚き火がある。火の向こう側には空席が一つ。'
    }, [
      C('少し休む', '火へ手をかざし、呼吸を整える。', 'wait', { hp: 5, hunger: 1, status: '暖まった', result: '火は何も要求せず、傷だけを乾かした。' }),
      C('何もしない', '火の主を待たず通り過ぎる。', 'skip', { hunger: 2, result: '背中が冷えるまで、火は同じ場所で燃えていた。' })
    ]),
    E('double-footprints', '二人分の足跡', 'common', ['wait'], {
      icon: '👣', cooldown: 3, maxEncounters: 4,
      text: '自分の足跡の隣に、歩幅まで同じ足跡が増えている。'
    }, [
      C('足跡を追う', 'もう一人分の歩幅へ合わせる。', 'wait', { hp: 2, memories: { birthday: false }, survival: { sawSecondTracks: true }, result: '足跡は近道を教えたが、自分の誕生日を一つ置き忘れた。' }),
      C('何もしない', '自分の列だけを見て進む。', 'skip', { hunger: 2, result: '隣の足跡も、しばらく同じように無視した。' })
    ]),
    E('vacant-table', '空席の食卓', 'common', ['wait'], {
      icon: '🪑', cooldown: 5, maxEncounters: 2,
      text: '森の中央に一人分の空席があり、地下から寝息のような振動が届く。'
    }, [
      C('席を整える', '椅子を起こし、食器を伏せる。', 'wait', { flags: { ancientAwake: true }, survival: { ancientHeard: true }, result: '地下の寝息が一度止まり、また深く続いた。' }),
      C('何もしない', '席にも地下にも関わらない。', 'skip', { hunger: 2, result: '空席は空席のままこちらを見送った。' })
    ]),

    E('tako-egg-sac', '寄生タコの卵嚢', 'uncommon', ['food'], {
      icon: '🐙', cooldown: 7, maxEncounters: 2,
      text: '水のない窪地で、寄生タコの卵嚢がゆっくり脈打っている。'
    }, [
      C('保護する', '食べずに濡れ布で包む。', 'eat', { companions: { tako: true }, memories: { tako: true }, hunger: -5, result: '孵った小さな寄生タコが肩へ巻きついた。' }, false),
      C('食べない', '卵嚢を水辺へ移して立ち去る。', 'skip', { hunger: 3, memories: { tako: true }, result: '水面に八本の波紋が広がった。' })
    ]),
    E('jr-shell', 'Jr.の抜け殻', 'uncommon', ['medicine'], {
      icon: '🪱', cooldown: 7, maxEncounters: 2,
      text: '解毒寄生虫Jr.のものらしい新しい抜け殻が、薬草の上に残っている。'
    }, [
      C('薬草ごと取り込む', '抜け殻の解毒菌を身体へ迎える。', 'medicine', { companions: { jr: true, jrLevel: 1 }, hp: 4, flags: { detoxOnly: true }, result: 'Jr.が目を覚まし、毒を探して身体を巡った。' }),
      C('服用しない', '抜け殻を目印として残す。', 'skip', { hunger: 2, result: '薬草の匂いだけを覚えて先へ進んだ。' })
    ]),
    E('three-soil-sacks', '三色の土嚢と黒豆', 'uncommon', ['food'], {
      icon: '🫘', cooldown: 8, maxEncounters: 2,
      text: '白、赤、灰の土嚢の中央で、一粒の黒豆がこちらを待っている。'
    }, [
      C('黒豆を持っていく', '今は食べず、三色の土ごと背負う。', 'eat', { flags: { beanCarried: true }, hunger: -3, result: '黒豆は袋の中で、小さく心臓のように鳴った。' }, false),
      C('食べない', '土も豆も元の配置へ戻す。', 'skip', { hunger: 3, result: '三色の土は既存の四つの黒豆ルートを指すように並んだ。' })
    ]),
    E('shadow-plate', '影を飼う皿', 'uncommon', ['food'], {
      icon: '🌑', cooldown: 8, maxEncounters: 2,
      text: '黒い皿の上で、自分の影だけが空腹そうに口を開けている。'
    }, [
      C('影へ分ける', '自分は食べず、保存食の欠片を影へ渡す。', 'eat', { flags: { shadowHunger: true, shadowAwake: true }, hunger: -4, result: '影は欠片を飲み込み、あなたより半歩先を歩き始めた。' }, false),
      C('何もしない', '皿を裏返し、影を閉じる。', 'skip', { hunger: 3, result: '裏返した皿の下で、歯の鳴る音が続いた。' })
    ]),

    E('tako-return', '寄生タコの帰還', 'conditional', ['food'], {
      icon: '🐙', oneShot: true, condition: 'tako', text: '覚えていた八本腕が、干からびた保存魚を抱えて戻ってきた。'
    }, [
      C('保存魚を分け合う', '寄生タコと半分ずつ食べる。', 'eat', { hunger: -14, companions: { tako: true }, memories: { tako: true }, result: '帰還した寄生タコは、食後も肩を離れなかった。' }),
      C('食べない', '魚はタコへ返し、再会だけを受け取る。', 'skip', { hunger: 3, companions: { tako: true }, result: 'タコは不満そうだが、隣を歩くことにした。' })
    ]),
    E('jr-hunger', 'Jr.の空腹', 'conditional', ['food', 'medicine'], {
      icon: '🪱', cooldown: 8, maxEncounters: 3, condition: 'jr', text: '解毒寄生虫Jr.が腹の中から、毒か食事を要求している。'
    }, [
      C('薬草を与える', '安全な薬草をJr.へ回す。', 'medicine', { hp: 4, companions: { jr: true, jrLevel: 2 }, result: 'Jr.は満足し、解毒能力を強めた。' }, false),
      C('何も与えない', '今日は自分の食料を守る。', 'skip', { hunger: 3, result: 'Jr.は拗ねたが、宿主を殺すほど無茶はしなかった。' })
    ]),
    E('bean-homecoming', '黒豆の里帰り', 'conditional', ['food'], {
      icon: '🌱', oneShot: true, condition: 'bean', text: '持っていた黒豆が三色の土と身体の鼓動を同時に思い出して震える。'
    }, [
      C('里へ帰す', '黒豆の望む土へ根を下ろさせる。', 'eat', { flags: { beanCarried: false, beanSoil: 'gray' }, companions: { beanChild: true }, result: '黒豆の幼体が生まれ、既存の白・赤・灰・身体発芽の記憶を守った。' }, false),
      C('食べない', '発芽を急がせず、豆を持ち続ける。', 'skip', { hunger: 3, flags: { beanCarried: true }, result: '黒豆は静まり、四つの育ち方を忘れなかった。' })
    ]),
    E('shadow-snack', '影の夜食', 'conditional', ['food'], {
      icon: '🌑', cooldown: 9, maxEncounters: 2, condition: 'shadow', text: '夜になる前に、影が二人分の夜食を並べた。'
    }, [
      C('影と食べる', '片方を影へ、片方を自分へ。', 'eat', { hunger: -12, flags: { shadowAwake: true, shadowMerged: true }, result: '満腹になった影は、今日だけ身体と同じ動きをした。' }),
      C('食べない', '夜食を影だけに任せる。', 'skip', { hunger: 3, result: '影は一人で二人分を平らげた。' })
    ]),
    E('invisible-market', '透明清掃員の市場', 'conditional', ['drink', 'medicine'], {
      icon: '🧹', oneShot: true, condition: 'market', text: '通行印に反応し、透明な清掃員たちの市場が輪郭を現した。'
    }, [
      C('清潔な水を買う', '通行印を渡して透明な水を受け取る。', 'drink', { hunger: -9, hp: 4, result: '水は透明すぎたが、身体の汚れだけを洗い流した。' }),
      C('何も買わない', '市場を見学するだけにする。', 'skip', { hunger: 2, result: '清掃員は足跡まで掃除して市場を畳んだ。' })
    ]),
    E('lost-birthday', '失った誕生日会', 'conditional', ['food'], {
      icon: '🎂', oneShot: true, condition: 'birthday', text: '日付のない誕生日会が始まり、名前のないケーキが置かれた。'
    }, [
      C('一口だけ食べる', '誰の誕生日か分からないまま祝う。', 'eat', { hunger: -10, memories: { birthday: true }, result: '味と一緒に、自分の誕生日が戻ってきた。' }),
      C('食べない', '思い出せない祝いには参加しない。', 'skip', { hunger: 3, result: '蝋燭は一本ずつ、過去の方角へ消えた。' })
    ]),
    E('future-note', '未来の自分の置き手紙', 'conditional', ['wait'], {
      icon: '✉️', oneShot: true, condition: 'future', text: '自分の筆跡で「次の節目では備えを選べ」と書かれた手紙がある。'
    }, [
      C('読む', '未来の忠告を予定表へ写す。', 'wait', { survival: { futurePlan: true }, hp: 2, result: '封を閉じる前より、次の十日が少し見通せた。' }),
      C('何もしない', '未来を固定せず、その場へ残す。', 'skip', { hunger: 2, result: '手紙は別の選択をした自分へ宛先を変えた。' })
    ]),
    E('ancient-breath', '古きものの寝息', 'conditional', ['wait'], {
      icon: '🕳️', oneShot: true, condition: 'ancient', text: '地下から古きものの寝息が上がり、森中の食器が震えている。'
    }, [
      C('呼吸を合わせる', '目覚めさせない周期で静かに待つ。', 'wait', { hp: 5, survival: { ancientCalmed: true }, result: '巨大な寝息は深まり、道だけが開いた。' }),
      C('何もしない', '息を殺して通り過ぎる。', 'skip', { hunger: 2, result: '古きものは眠ったまま、こちらの匂いだけを覚えた。' })
    ]),

    E('ordinary-meal', '完全に普通の定食', 'rare', ['food'], {
      icon: '🍱', cooldown: 10, maxEncounters: 2, weight: 1,
      text: '焼き魚、味噌汁、白米。説明できないほど完全に普通の定食が湯気を立てている。'
    }, [
      C('普通に食べる', '怪しくないことを信じて完食する。', 'eat', { hunger: -18, hp: 8, survival: { ordinaryMealAccepted: true }, result: '何も起きなかった。それがこの森で最も珍しい出来事だった。' }),
      C('食べない', '普通すぎることを警戒する。', 'skip', { hunger: 2, result: '定食は普通に冷めた。' })
    ]),
    E('nonexistent-day51', '存在しない51日目', 'rare', ['wait'], {
      icon: '5️⃣', oneShot: true, weight: 1, text: 'カレンダーの隙間から、まだ来ていない「51日目」が一分だけ覗いている。'
    }, [
      C('一分だけ見る', '50日目の先を記憶へ焼き付ける。', 'wait', { hp: 3, survival: { sawDay51: true }, result: '帰れる可能性だけを見て、今日へ戻った。' }),
      C('何もしない', '存在しない日付へ足を入れない。', 'skip', { hunger: 1, result: '51の数字は紙の裏へ消えた。' })
    ]),
    E('second-player', '二人目のプレイヤー', 'rare', ['wait'], {
      icon: '👥', oneShot: true, weight: 1, text: '同じシード番号を腕に書いた、二人目のプレイヤーが現れた。'
    }, [
      C('同行を提案する', '互いの選択を一日だけ照合する。', 'wait', { companions: { clone: true }, hp: 3, result: '二人目は無言で頷き、少し後ろを歩き始めた。' }),
      C('何もしない', '同じ運命へ干渉せず別れる。', 'skip', { hunger: 2, result: '相手も同じ選択をして反対方向へ去った。' })
    ]),
    E('food-refuses', '食べ物からの拒否', 'rare', ['food'], {
      icon: '🙅', cooldown: 9, maxEncounters: 3, weight: 1, text: '保存食が袋ごと身を引き、「今日は食べられたくない」と告げる。'
    }, [
      C('理由を聞く', '無理に食べず、保存食の意思を尊重する。', 'wait', { hunger: -3, hp: 2, result: '保存食は礼として、食べなくても腹に残る匂いをくれた。' }),
      C('食べない', '拒否を拒否せず、そのまま置く。', 'skip', { hunger: 2, result: '食べ物とあなたは、互いの拒否権を確認した。' })
    ]),
    E('forest-manager', '森の管理者', 'rare', ['medicine'], {
      icon: '🦌', oneShot: true, weight: 1, text: '名札を下げた鹿が現れ、森の安全点検として薬草を差し出す。'
    }, [
      C('薬草を受け取る', '管理番号を確認して服用する。', 'medicine', { hp: 7, status: '管理者点検済み', survival: { managerApproved: true }, result: '薬草は安全で、鹿は点検表へ丸をつけた。' }),
      C('服用しない', '点検だけ受け、薬草は返す。', 'skip', { hunger: 1, result: '管理者は拒否欄へ丁寧に丸をつけた。' })
    ]),
    E('tako-alive', '寄生タコ生存確認', 'rare', ['food'], {
      icon: '📡', cooldown: 11, maxEncounters: 2, weight: 1, text: '古い受信機から、寄生タコの心拍と食事要求が八拍ずつ届く。'
    }, [
      C('保存魚を送る', '転送口へ魚を入れ、生存信号へ応える。', 'eat', { memories: { tako: true }, hp: 2, hunger: -4, result: '八本の受領サインが返り、寄生タコの無事が確認できた。' }, false),
      C('食べない', '魚は残し、信号だけ記録する。', 'skip', { memories: { tako: true }, hunger: 2, result: '心拍は途切れず、次の周波数へ移った。' })
    ]),

    E('milestone-stockpile', '最初の備蓄', 'milestone', ['food'], {
      icon: '📦', day: 10, oneShot: true, text: '十日目。持てる量を決め、最初の備蓄を作る時が来た。'
    }, [
      C('食料を均等に分ける', '今日と未来へ半分ずつ残す。', 'eat', { hunger: -8, survival: { milestoneSuccess: { 10: true } }, result: '備蓄は十日先まで崩れない形に収まった。' }),
      C('何も食べず温存する', '全部を未来へ回す。', 'skip', { hunger: 3, survival: { milestoneSuccess: { 10: false } }, result: '箱は満ちたが、今日の腹は鳴った。' })
    ]),
    E('milestone-taxman', '空腹の徴税人', 'milestone', ['food'], {
      icon: '🧾', day: 20, oneShot: true, text: '二十日目。空腹の徴税人が、食料か体力の一部を差し出せと言う。'
    }, [
      C('備蓄から納める', '計画どおり保存食を渡す。', 'eat', { hunger: 2, survival: { milestoneSuccess: { 20: true } }, result: '徴税人は不足なしの印を押した。' }, false),
      C('何も渡さない', '拒否して脇道へ走る。', 'skip', { hp: -4, hunger: 2, survival: { milestoneSuccess: { 20: false } }, result: '逃げ切ったが、枝で少し傷ついた。' })
    ]),
    E('milestone-seat', '同行者の席', 'milestone', ['wait'], {
      icon: '🪑', day: 30, oneShot: true, text: '三十日目。焚き火の前に、同行者のための席が一つだけ用意されている。'
    }, [
      C('空席も整える', '一人でも仲間がいても席を守る。', 'wait', { hp: 4, survival: { milestoneSuccess: { 30: true } }, result: '誰も座らなくても、孤独が少し軽くなった。' }),
      C('何もしない', '席を畳み、荷物を軽くする。', 'skip', { hunger: 2, survival: { milestoneSuccess: { 30: false } }, result: '軽くなった荷物の分だけ、足音が寂しく響いた。' })
    ]),
    E('milestone-menu', '最後の献立表', 'milestone', ['wait'], {
      icon: '📋', day: 40, oneShot: true, text: '四十日目。最後の十日に必要なものが、献立表として壁へ浮かぶ。'
    }, [
      C('献立を記憶する', '四つの箱と拒否欄まで読み込む。', 'wait', { hp: 3, survival: { milestoneSuccess: { 40: true }, finalMenuRead: true }, result: '五十日目の配膳順が頭へ定着した。' }),
      C('何もしない', '献立に運命を決めさせない。', 'skip', { hunger: 2, survival: { milestoneSuccess: { 40: false } }, result: '表は白紙へ戻り、選択だけが残った。' })
    ]),

    E('final-pair', '生存者の配膳', 'final', ['final'], {
      icon: '🎁', day: 50, oneShot: true, text: '五十日目。四つの箱が二組に分かれて運ばれてきた。まず、どちらの組を見るか選ぶ。'
    }, [
      C('保存食／生きている箱', '左側の二箱へ進む。', 'wait', { finalPair: 'preserved-living', result: '保存食の箱と、生きている箱が残った。' }),
      C('空／帰還の箱', '右側の二箱へ進む。', 'wait', { finalPair: 'empty-return', result: '空の箱と、帰還の箱が残った。' })
    ]),
    E('final-select-preserved-living', '二つの箱', 'final', ['final'], {
      icon: '🎁', day: 50, oneShot: true, text: '保存食の匂いがする箱と、内側から呼吸する箱。持てるのは一つだけだ。'
    }, [
      C('保存食の箱', '五十日を越える食料を選ぶ。', 'wait', { selectedBox: 'preserved', result: '保存食の箱を手元へ引き寄せた。' }),
      C('生きている箱', '呼吸する何かと帰る。', 'wait', { selectedBox: 'living', result: '生きている箱が、あなたの鼓動へ合わせた。' })
    ]),
    E('final-select-empty-return', '二つの箱', 'final', ['final'], {
      icon: '🎁', day: 50, oneShot: true, text: '何も入っていないほど軽い箱と、出口の音がする箱。持てるのは一つだけだ。'
    }, [
      C('空の箱', '何もない余白を選ぶ。', 'wait', { selectedBox: 'empty', result: '空の箱は、選ばれたことで少し重くなった。' }),
      C('帰還の箱', '出口へつながる音を選ぶ。', 'wait', { selectedBox: 'return', result: '帰還の箱から、懐かしい扉の音がした。' })
    ]),
    E('final-commit', '最後の開封', 'final', ['wait'], {
      icon: '🔓', day: 50, oneShot: true, text: '選んだ箱は手の中にある。開けば結果を受け入れる。拒否すれば、箱を残して自分の足で帰る。'
    }, [
      C('開封する', '選んだ箱の中身を受け入れる。', 'wait', { result: '五十日目の箱を開封した。' }),
      C('拒否する', '箱を開けず、配膳そのものを断る。', 'skip', { result: '最後の配膳を拒み、自分の足で出口へ向かった。' })
    ])
  ];

  const byId = new Map(events.map(event => [event.id, event]));
  const milestones = new Map([
    [10, 'milestone-stockpile'],
    [20, 'milestone-taxman'],
    [30, 'milestone-seat'],
    [40, 'milestone-menu'],
    [50, 'final-pair']
  ]);

  function defaultState() {
    return {
      currentEventId: null,
      currentSelection: null,
      recentIds: [],
      history: [],
      encounterCounts: {},
      lastSeenDay: {},
      rareMisses: 0,
      rareSeen: 0,
      naturalRareSeen: 0,
      pityCount: 0,
      longestRareDrought: 0,
      marketPass: false,
      sawSecondTracks: false,
      ancientHeard: false,
      ancientCalmed: false,
      futurePlan: false,
      managerApproved: false,
      sawDay51: false,
      ordinaryMealAccepted: false,
      milestoneSuccess: { 10: false, 20: false, 30: false, 40: false },
      selectedBoxPair: null,
      selectedBox: null,
      finalRefused: false,
      finalAssessment: null,
      metaBoxRecorded: false,
      metaFinalRefusalRecorded: false
    };
  }

  function normalizeState(raw) {
    const base = defaultState();
    const input = raw && typeof raw === 'object' ? raw : {};
    const out = Object.assign(base, input);
    out.recentIds = Array.isArray(input.recentIds) ? input.recentIds.filter(id => byId.has(id)).slice(-3) : [];
    out.history = Array.isArray(input.history)
      ? input.history.filter(entry => entry && byId.has(entry.eventId)).slice(-200).map(entry => ({ ...entry }))
      : [];
    out.encounterCounts = Object.assign({}, input.encounterCounts || {});
    out.lastSeenDay = Object.assign({}, input.lastSeenDay || {});
    out.milestoneSuccess = Object.assign({}, base.milestoneSuccess, input.milestoneSuccess || {});
    out.currentEventId = byId.has(input.currentEventId) ? input.currentEventId : null;
    out.currentSelection = input.currentSelection && typeof input.currentSelection === 'object' ? { ...input.currentSelection } : null;
    for (const key of ['rareMisses', 'rareSeen', 'naturalRareSeen', 'pityCount', 'longestRareDrought']) {
      out[key] = Math.max(0, Math.floor(Number(out[key]) || 0));
    }
    if (!['preserved-living', 'empty-return', null].includes(out.selectedBoxPair)) out.selectedBoxPair = null;
    if (!['preserved', 'living', 'empty', 'return', null].includes(out.selectedBox)) out.selectedBox = null;
    out.finalAssessment = input.finalAssessment && typeof input.finalAssessment === 'object'
      ? clone(input.finalAssessment)
      : null;
    return out;
  }

  function rareRate(day) {
    const stage = clamp(Math.floor((Math.max(1, Number(day) || 1) - 1) / 10), 0, 4);
    return Number((0.03 + stage * 0.01).toFixed(2));
  }

  function conditionMatches(event, run) {
    switch (event.condition) {
      case 'tako': return !!(run.companions && run.companions.tako) || !!(run.memories && run.memories.tako);
      case 'jr': return !!(run.companions && run.companions.jr);
      case 'bean': return !!(run.flags && run.flags.beanCarried) || !!(run.companions && run.companions.beanChild);
      case 'shadow': return !!(run.flags && (run.flags.shadowAwake || run.flags.shadowHunger));
      case 'market': return !!run.survival.marketPass;
      case 'birthday': return !!(run.memories && !run.memories.birthday);
      case 'future': return Number(run.day) >= 25 && !!(run.memories && run.memories.entryReason);
      case 'ancient': return Number(run.day) >= 35 && !!(run.flags && run.flags.ancientAwake);
      default: return true;
    }
  }

  function eligible(event, run) {
    const survival = run.survival;
    const count = Number(survival.encounterCounts[event.id] || 0);
    if (!conditionMatches(event, run)) return false;
    if (event.oneShot && count > 0) return false;
    if (count >= event.maxEncounters) return false;
    const lastDay = Number(survival.lastSeenDay[event.id] || 0);
    if (lastDay && Number(run.day) - lastDay <= event.cooldown) return false;
    return true;
  }

  function weightedPick(candidates, value) {
    if (!candidates.length) return null;
    const total = candidates.reduce((sum, event) => sum + Math.max(1, Number(event.weight) || 1), 0);
    let cursor = clamp(Number(value) || 0, 0, 0.999999999999) * total;
    for (const event of candidates) {
      cursor -= Math.max(1, Number(event.weight) || 1);
      if (cursor < 0) return event;
    }
    return candidates[candidates.length - 1];
  }

  function selectPool(category, run) {
    const recent = new Set(run.survival.recentIds.slice(-3));
    const base = events.filter(event => {
      if (event.category === 'milestone' || event.category === 'final') return false;
      if (category === 'rare') {
        if (event.category !== 'rare') return false;
      } else if (!['common', 'uncommon', 'conditional'].includes(event.category)) {
        return false;
      }
      return eligible(event, run);
    });
    const withoutRecent = base.filter(event => !recent.has(event.id));
    return withoutRecent.length ? withoutRecent : base;
  }

  function lockSelection(run, event, selection) {
    const survival = run.survival;
    const previousCount = Number(survival.encounterCounts[event.id] || 0);
    const previousLastDay = Number(survival.lastSeenDay[event.id] || 0);
    const previousRecent = survival.recentIds.slice(-3);
    survival.currentEventId = event.id;
    survival.currentSelection = {
      day: Number(run.day),
      eventId: event.id,
      category: event.category,
      rareChance: selection.rareChance || 0,
      rareRoll: selection.rareRoll,
      naturalHit: !!selection.naturalHit,
      pityForced: !!selection.pityForced,
      previousCount,
      previousLastDay,
      previousRecent
    };
    survival.encounterCounts[event.id] = previousCount + 1;
    survival.lastSeenDay[event.id] = Number(run.day);
    survival.history.push({
      day: Number(run.day),
      eventId: event.id,
      category: event.category,
      rareChance: selection.rareChance || 0,
      pityForced: !!selection.pityForced
    });
    if (survival.history.length > 200) survival.history = survival.history.slice(-200);
    if (!['milestone', 'final'].includes(event.category)) {
      survival.recentIds.push(event.id);
      survival.recentIds = survival.recentIds.slice(-3);
    }
    return event;
  }

  function prepare(run, random) {
    run.survival = normalizeState(run.survival);
    const survival = run.survival;
    if (survival.currentEventId && byId.has(survival.currentEventId)) return byId.get(survival.currentEventId);

    const fixedId = milestones.get(Number(run.day));
    if (fixedId) {
      return lockSelection(run, byId.get(fixedId), {
        rareChance: 0,
        rareRoll: null,
        naturalHit: false,
        pityForced: false
      });
    }

    const chance = rareRate(run.day);
    const rareRoll = random();
    const naturalHit = rareRoll < chance;
    const pityEligible = survival.rareMisses >= PITY_LIMIT;
    const rareCandidates = selectPool('rare', run);
    const wantsRare = (naturalHit || pityEligible) && rareCandidates.length > 0;
    const pool = wantsRare ? rareCandidates : selectPool('normal', run);
    const fallback = pool.length ? pool : [byId.get('stored-bread')];
    const selected = weightedPick(fallback, random()) || byId.get('stored-bread');
    const selectedRare = selected.category === 'rare';
    const pityForced = selectedRare && pityEligible && !naturalHit;

    if (selectedRare) {
      survival.longestRareDrought = Math.max(survival.longestRareDrought, survival.rareMisses);
      survival.rareMisses = 0;
      survival.rareSeen += 1;
      if (pityForced) survival.pityCount += 1;
      else survival.naturalRareSeen += 1;
    } else {
      survival.rareMisses += 1;
      survival.longestRareDrought = Math.max(survival.longestRareDrought, survival.rareMisses);
    }
    return lockSelection(run, selected, { rareChance: chance, rareRoll, naturalHit, pityForced });
  }

  function current(run) {
    if (!run || !run.survival) return null;
    const event = byId.get(run.survival.currentEventId);
    return event ? { ...event, eventId: event.id } : null;
  }

  function mergeNested(target, values) {
    if (!values || typeof values !== 'object') return;
    for (const [key, value] of Object.entries(values)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        target[key] = Object.assign({}, target[key] && typeof target[key] === 'object' ? target[key] : {}, value);
      } else {
        target[key] = value;
      }
    }
  }

  function applyValues(run, values, outcome) {
    if (!values) return;
    if (Number.isFinite(values.hp)) run.hp = clamp((Number(run.hp) || 0) + values.hp, 0, MAX_HP);
    if (Number.isFinite(values.hunger)) run.hunger = clamp((Number(run.hunger) || 0) + values.hunger, 0, MAX_HUNGER);
    if (values.status) run.status = values.status;
    mergeNested(run.flags, values.flags);
    mergeNested(run.companions, values.companions);
    mergeNested(run.memories, values.memories);
    mergeNested(run.survival, values.survival);
    if (values.finalPair) run.survival.selectedBoxPair = values.finalPair;
    if (values.selectedBox) run.survival.selectedBox = values.selectedBox;
    if (values.result) outcome.result = values.result;
    if (values.log) outcome.log = values.log;
    if (values.clue) outcome.clue = values.clue;
  }

  function terminalStatus(run) {
    if (Number(run && run.hp) <= 0) return 'death';
    if (Number(run && run.hunger) >= MAX_HUNGER) return 'starve';
    return null;
  }

  function assessEnding(run) {
    const survival = run && run.survival ? run.survival : defaultState();
    const milestoneDays = [10, 20, 30, 40];
    const milestoneCount = milestoneDays.filter(day => survival.milestoneSuccess && survival.milestoneSuccess[day]).length;
    const companions = [];
    if (run.companions && run.companions.tako) companions.push('寄生タコ');
    if (run.companions && run.companions.jr) companions.push('Jr.');
    if (run.companions && run.companions.beanChild) companions.push('黒豆の幼体');
    if (run.companions && run.companions.clone) companions.push('二人目のプレイヤー');
    if (run.flags && run.flags.shadowAwake) companions.push('影');

    const signals = [];
    if (survival.sawSecondTracks) signals.push('二人分の足跡を帰路へ重ねた');
    if (survival.ancientHeard) signals.push('古きものの寝息を聞き分けた');
    if (survival.ancientCalmed) signals.push('古きものを静めた');
    if (survival.futurePlan) signals.push('未来の置き手紙を計画へ変えた');
    if (survival.managerApproved) signals.push('森の管理者から帰還許可を得た');
    if (survival.sawDay51) signals.push('存在しない51日目を記憶した');

    const refusals = Math.max(0, Number(run.stats && run.stats.skipped) || 0);
    const score = milestoneCount * 2
      + Math.min(3, companions.length)
      + signals.length
      + (refusals >= 20 ? 2 : refusals >= 10 ? 1 : 0);
    const rank = score >= 15 ? '森の完全踏破者'
      : score >= 10 ? '備えある生還者'
        : score >= 6 ? '怪食の帰還者'
          : '五十日の生存者';
    const boxItems = {
      preserved: '配分表つきの保存食',
      living: '眠っていた小さな同行者',
      empty: 'これから満たす空箱',
      return: '五十日分の帰還記録'
    };
    const carried = survival.finalRefused
      ? '箱を持たず、五十日分の選択記録'
      : (boxItems[survival.selectedBox] || '五十日分の選択記録');
    const companionText = companions.length ? `同行者：${companions.join('、')}。` : '同行者を持たず、一人で帰還した。';
    const signalText = signals.length ? `追加評価：${signals.join('。')}。` : '追加評価：低確率の助けがなくても、自分の判断だけで帰還した。';
    return {
      score,
      rank,
      carried,
      milestoneCount,
      companions,
      refusals,
      signals,
      text: `称号「${rank}」。節目成功 ${milestoneCount}/4、拒否 ${refusals}回。${companionText}持ち帰る物：${carried}。${signalText}`
    };
  }

  function personalizeEnding(run, ending) {
    const assessment = assessEnding(run);
    run.survival.finalAssessment = assessment;
    return {
      ...ending,
      title: `${ending.title}・${assessment.rank}`,
      text: `${ending.text} ${assessment.text}`
    };
  }

  function resolve(run, eventId, choiceIndex, random) {
    const event = byId.get(eventId);
    if (!event || run.survival.currentEventId !== eventId) throw new Error('SURVIVAL event mismatch');
    const choice = event.choices[choiceIndex];
    if (!choice) throw new Error('SURVIVAL choice mismatch');
    const outcome = { result: '', log: `${event.title}で「${choice.title}」を選んだ。` };
    const effect = choice.effect || {};
    applyValues(run, effect, outcome);
    if (effect.chance) {
      const value = random();
      const probability = clamp(Number(effect.chance.probability) || 0, 0, 1);
      const success = value < probability;
      run.lastRoll = { label: effect.chance.label, probability, baseProbability: probability, value, success };
      run.stats.randomChecks = (Number(run.stats.randomChecks) || 0) + 1;
      if (success) run.stats.lucky = (Number(run.stats.lucky) || 0) + 1;
      else run.stats.unlucky = (Number(run.stats.unlucky) || 0) + 1;
      applyValues(run, success ? effect.chance.success : effect.chance.failure, outcome);
    }
    if (event.category !== 'final') {
      run.hunger = clamp((Number(run.hunger) || 0) + DAILY_HUNGER_COST, 0, MAX_HUNGER);
    }
    if (event.category === 'rare') {
      run.hp = clamp(Number(run.hp) || 1, 1, MAX_HP);
      run.hunger = clamp(Number(run.hunger) || 0, 0, MAX_HUNGER - 1);
    }
    if (event.id === 'final-commit') {
      if (choiceIndex === 1) {
        run.survival.finalRefused = true;
        outcome.ending = personalizeEnding(run, {
          code: 'survival_refuse',
          title: '配膳を拒んだ生存者',
          text: '四つの箱を前に、最後まで選択する権利を手放さなかった。箱は森へ残り、あなたは自分の足で帰還した。',
          icon: '✋'
        });
      } else {
        const endings = {
          preserved: { code: 'survival_preserved', title: '保存食の帰路', text: '保存食は本物だった。五十日で身につけた配分を守り、森の外まで歩き切った。', icon: '📦' },
          living: { code: 'survival_living', title: '生きた箱との旅', text: '箱から小さな同行者が目を開けた。孤独ではない帰路が、五十一日目の代わりに始まった。', icon: '💓' },
          empty: { code: 'survival_empty', title: '空箱の余白', text: '空の箱には何もなかった。だからこそ、これから持ち帰るものを自分で決められた。', icon: '⬜' },
          return: { code: 'survival_return', title: '帰還の配膳', text: '帰還の箱は扉へ変わった。五十日分の記録と選択を抱えたまま、元の世界へ踏み出した。', icon: '🚪' }
        };
        outcome.ending = personalizeEnding(run, endings[run.survival.selectedBox] || endings.empty);
      }
    }
    return outcome;
  }

  function complete(run, random) {
    const id = run.survival.currentEventId;
    if (id === 'final-pair') {
      run.survival.currentEventId = run.survival.selectedBoxPair === 'empty-return'
        ? 'final-select-empty-return'
        : 'final-select-preserved-living';
      return current(run);
    }
    if (id === 'final-select-preserved-living' || id === 'final-select-empty-return') {
      run.survival.currentEventId = 'final-commit';
      return current(run);
    }
    if (id === 'final-commit') return null;
    run.survival.currentEventId = null;
    run.survival.currentSelection = null;
    run.day = Math.min(50, (Number(run.day) || 1) + 1);
    return prepare(run, random);
  }

  function simulationRun(seed) {
    return {
      version: 4,
      mode: 'survival',
      seed: seed >>> 0,
      rngState: (seed || 0x6d2b79f5) >>> 0,
      scene: 'survival',
      day: 1,
      hp: 92,
      hunger: 28,
      status: '健康',
      ended: false,
      ending: null,
      stats: { ate: 0, skipped: 0, randomChecks: 0, lucky: 0, unlucky: 0 },
      flags: { beanCarried: false, shadowAwake: false, shadowHunger: false, ancientAwake: false },
      companions: { tako: false, jr: false, jrLevel: 0, beanChild: false, clone: false },
      memories: { tako: false, birthday: true, entryReason: true },
      survival: normalizeState(null)
    };
  }

  function simulationRandom(run) {
    run.rngState = ((run.rngState >>> 0) + 0x6D2B79F5) >>> 0;
    let value = run.rngState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  const POLICY_NAMES = ['random', 'allRefuse', 'allConsume', 'conservative'];

  function conservativeChoice(run, event) {
    const hp = Number(run.hp) || 0;
    const hunger = Number(run.hunger) || 0;
    const hpNeed = clamp((70 - hp) / 50, 0, 1.4);
    const hungerNeed = clamp((hunger - 35) / 55, 0, 1.4);
    const scores = event.choices.map((choice, index) => {
      const effect = choice.effect || {};
      let hpDelta = Number(effect.hp) || 0;
      let hungerDelta = Number(effect.hunger) || 0;
      if (effect.chance) {
        const probability = clamp(Number(effect.chance.probability) || 0, 0, 1);
        const success = effect.chance.success || {};
        const failure = effect.chance.failure || {};
        hpDelta += probability * (Number(success.hp) || 0) + (1 - probability) * (Number(failure.hp) || 0);
        hungerDelta += probability * (Number(success.hunger) || 0) + (1 - probability) * (Number(failure.hunger) || 0);
      }
      let score = hpDelta * (0.8 + hpNeed * 2.8) - hungerDelta * (0.8 + hungerNeed * 2.8);
      if (choice.consumedByPlayer) score += hunger >= 58 ? 6 : -0.5;
      if (choice.refusal) score += hunger < 48 && hp > 55 ? 1.5 : -4;
      if (hp + hpDelta <= 0 || hunger + hungerDelta >= MAX_HUNGER) score -= 1000;
      return { index, score };
    });
    scores.sort((a, b) => b.score - a.score || a.index - b.index);
    return scores[0].index;
  }

  function selectPolicyChoice(run, event, policyName, policyState) {
    if (policyName === 'random') return simulationRandom(policyState) < 0.5 ? 0 : 1;
    if (policyName === 'allRefuse') {
      const refusal = event.choices.findIndex(choice => choice.refusal || choice.kind === 'skip');
      return refusal >= 0 ? refusal : 1;
    }
    if (policyName === 'allConsume') {
      const consumption = event.choices.findIndex(choice => choice.consumedByPlayer === true);
      if (consumption >= 0) return consumption;
      const nonRefusal = event.choices.findIndex(choice => !choice.refusal && choice.kind !== 'skip');
      return nonRefusal >= 0 ? nonRefusal : 0;
    }
    return conservativeChoice(run, event);
  }

  function policyDecision(run, eventId, policy = 'random', policyRngState = 0xA5A55A5A) {
    const event = byId.get(eventId);
    if (!event) throw new Error('SURVIVAL policy event mismatch');
    const policyName = POLICY_NAMES.includes(policy) ? policy : 'random';
    const state = { rngState: Number(policyRngState) >>> 0 };
    const gameRngState = Number(run && run.rngState) >>> 0;
    const choiceIndex = selectPolicyChoice(run, event, policyName, state);
    return { choiceIndex, gameRngState, policyRngState: state.rngState };
  }

  function simulateSeeds(count, policy = 'random') {
    const seedCount = Math.max(1, Math.floor(Number(count) || 1));
    const policyName = POLICY_NAMES.includes(policy) ? policy : 'random';
    const result = {
      seedCount,
      totalRuns: seedCount,
      policy: policyName,
      totalEvents: 0,
      errors: 0,
      loops: 0,
      invalidValues: 0,
      outcomes: { clear: 0, death: 0, starve: 0, other: 0 },
      day50Reached: 0,
      day50ReachRate: 0,
      survivalDaysTotal: 0,
      averageSurvivalDays: 0,
      deathDayDistribution: { death: {}, starve: {} },
      violations: { cooldown: 0, oneShot: 0, maxEncounters: 0, recentThree: 0 },
      rare: {
        observed: 0,
        minChance: 0.03,
        maxChance: 0.07,
        pityTriggers: 0,
        maxDryStreak: 0,
        pityLimit: PITY_LIMIT,
        rateByDanger: [0.03, 0.04, 0.05, 0.06, 0.07].map(chance => ({ chance, draws: 0, naturalHits: 0 }))
      },
      conditionalHits: {},
      milestoneHits: { 10: 0, 20: 0, 30: 0, 40: 0 },
      boxHits: { preserved: 0, living: 0, empty: 0, return: 0 },
      finalRefusals: 0,
      clearEndings: {},
      achievementHits: {
        wild_fifty: 0,
        rare_encounter: 0,
        luck_is_skill: 0,
        solo_survivor: 0,
        refusal_master: 0,
        as_planned: 0,
        ordinary_best: 0
      }
    };
    for (const event of events.filter(item => item.category === 'conditional')) result.conditionalHits[event.id] = 0;

    for (let seed = 1; seed <= seedCount; seed += 1) {
      let run = null;
      let outcomeType = null;
      let terminalDay = 1;
      let reachedDay50 = false;
      try {
        run = simulationRun(seed);
        const random = () => simulationRandom(run);
        const policyState = { rngState: ((seed >>> 0) ^ 0xA5A55A5A) >>> 0 };
        prepare(run, random);
        let steps = 0;
        while (!outcomeType && steps < 80) {
          steps += 1;
          const event = current(run);
          if (!event || !Array.isArray(event.choices) || event.choices.length !== 2) {
            result.invalidValues += 1;
            outcomeType = 'other';
            break;
          }
          if (Number(run.day) >= 50) reachedDay50 = true;
          result.totalEvents += 1;
          const selection = run.survival.currentSelection;
          if (selection && !['milestone', 'final'].includes(event.category)) {
            const stage = clamp(Math.floor((run.day - 1) / 10), 0, 4);
            const bucket = result.rare.rateByDanger[stage];
            bucket.draws += 1;
            if (selection.naturalHit) bucket.naturalHits += 1;
            const priorCount = Number(selection.previousCount || 0);
            if (event.oneShot && priorCount > 0) result.violations.oneShot += 1;
            if (priorCount >= event.maxEncounters) result.violations.maxEncounters += 1;
            if (selection.previousLastDay && run.day - selection.previousLastDay <= event.cooldown) result.violations.cooldown += 1;
            if ((selection.previousRecent || []).includes(event.id)) result.violations.recentThree += 1;
          }
          if (event.category === 'rare') {
            result.rare.observed += 1;
            if (selection && selection.pityForced) result.rare.pityTriggers += 1;
          }
          if (event.category === 'conditional') result.conditionalHits[event.id] += 1;
          if (event.category === 'milestone') result.milestoneHits[run.day] += 1;

          const choiceIndex = selectPolicyChoice(run, event, policyName, policyState);
          const choice = event.choices[choiceIndex];
          if (choice.consumedByPlayer === true) run.stats.ate += 1;
          if (choice.kind === 'skip') run.stats.skipped += 1;
          const outcome = resolve(run, event.id, choiceIndex, random);
          if (run.survival.selectedBox && event.id.startsWith('final-select-')) {
            result.boxHits[run.survival.selectedBox] += 1;
          }
          if (outcome.ending) {
            run.ended = true;
            run.ending = outcome.ending;
            outcomeType = 'clear';
            terminalDay = Number(run.day) || 50;
            result.clearEndings[outcome.ending.code] = (result.clearEndings[outcome.ending.code] || 0) + 1;
            if (outcome.ending.code === 'survival_refuse') result.finalRefusals += 1;
          } else {
            const terminal = terminalStatus(run);
            if (terminal) {
              run.ended = true;
              run.ending = { code: terminal };
              outcomeType = terminal;
              terminalDay = Number(run.day) || 1;
            } else {
              complete(run, random);
            }
          }
          if (!Number.isFinite(run.hp) || !Number.isFinite(run.hunger) || run.hp < 0 || run.hp > MAX_HP || run.hunger < 0 || run.hunger > MAX_HUNGER) {
            result.invalidValues += 1;
            outcomeType = 'other';
            terminalDay = Number(run.day) || 1;
            break;
          }
        }
        if (!outcomeType) {
          result.loops += 1;
          outcomeType = 'other';
          terminalDay = Number(run.day) || 1;
        }
        if (outcomeType === 'clear') {
          result.achievementHits.wild_fifty += 1;
          if (run.survival.rareSeen > 0) result.achievementHits.rare_encounter += 1;
          if (run.survival.naturalRareSeen >= 3) result.achievementHits.luck_is_skill += 1;
          const companions = ['tako', 'jr', 'beanChild', 'clone'].filter(key => run.companions[key]).length + (run.flags.shadowAwake ? 1 : 0);
          if (companions === 0) result.achievementHits.solo_survivor += 1;
          if (run.stats.skipped >= 20) result.achievementHits.refusal_master += 1;
          if ([10, 20, 30, 40].every(day => run.survival.milestoneSuccess[day])) result.achievementHits.as_planned += 1;
          if (run.survival.ordinaryMealAccepted) result.achievementHits.ordinary_best += 1;
        }
      } catch (_) {
        result.errors += 1;
        outcomeType = 'other';
        terminalDay = Number(run && run.day) || 1;
      }
      if (run) {
        result.rare.maxDryStreak = Math.max(result.rare.maxDryStreak, run.survival.longestRareDrought);
      }
      if (reachedDay50) result.day50Reached += 1;
      const classified = Object.hasOwn(result.outcomes, outcomeType) ? outcomeType : 'other';
      result.outcomes[classified] += 1;
      result.survivalDaysTotal += clamp(Math.floor(Number(terminalDay) || 1), 1, 50);
      if (classified === 'death' || classified === 'starve') {
        const distribution = result.deathDayDistribution[classified];
        const dayKey = String(clamp(Math.floor(Number(terminalDay) || 1), 1, 50));
        distribution[dayKey] = (distribution[dayKey] || 0) + 1;
      }
    }
    const naturalDraws = result.rare.rateByDanger.reduce((sum, bucket) => sum + bucket.draws, 0);
    const naturalHits = result.rare.rateByDanger.reduce((sum, bucket) => sum + bucket.naturalHits, 0);
    result.rare.naturalDraws = naturalDraws;
    result.rare.naturalHits = naturalHits;
    result.rare.naturalRate = naturalDraws ? naturalHits / naturalDraws : 0;
    result.day50ReachRate = result.day50Reached / seedCount;
    result.averageSurvivalDays = result.survivalDaysTotal / seedCount;
    return result;
  }

  function simulatePolicies(count) {
    const seedCount = Math.max(1, Math.floor(Number(count) || 1));
    return {
      seedCount,
      policies: Object.fromEntries(POLICY_NAMES.map(policy => [policy, simulateSeeds(seedCount, policy)]))
    };
  }

  globalThis.TabenaiSurvival = Object.freeze({
    events,
    pityLimit: PITY_LIMIT,
    normalizeState,
    rareRate,
    prepare,
    current,
    resolve,
    complete,
    terminalStatus,
    assessEnding,
    policyDecision,
    simulateSeeds,
    simulatePolicies,
    eventById: id => byId.get(id) || null,
    cloneEvents: () => clone(events)
  });
})();
