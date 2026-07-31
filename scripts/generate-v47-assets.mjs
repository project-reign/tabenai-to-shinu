import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const palette = Object.freeze({
  ink: '#08090b',
  charcoal: '#121419',
  brown: '#2d1914',
  brownLight: '#573024',
  gold: '#d9a64f',
  goldLight: '#f3d58a',
  amber: '#b8732e',
  crimson: '#7e2c2a',
  crimsonLight: '#b6503f',
  teal: '#1d4c4b',
  tealLight: '#65a09a',
  bone: '#d8c8a3',
  night: '#0b1220'
});

const xml = ({ width, height, title, desc, defs = '', body, transparent = false }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${title}</title>
  <desc id="desc">${desc}</desc>
  <defs>
    ${defs}
  </defs>
  ${transparent ? '' : `<rect width="${width}" height="${height}" fill="${palette.ink}"/>`}
  ${body}
</svg>
`.replace(/[ \t]+$/gm, '');

const commonBackgroundDefs = `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.night}"/>
      <stop offset="0.58" stop-color="${palette.brown}"/>
      <stop offset="1" stop-color="${palette.ink}"/>
    </linearGradient>
    <linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.night}"/>
      <stop offset=".5" stop-color="${palette.crimson}"/>
      <stop offset="1" stop-color="${palette.gold}"/>
    </linearGradient>
    <radialGradient id="amberGlow">
      <stop offset="0" stop-color="${palette.goldLight}" stop-opacity=".8"/>
      <stop offset=".38" stop-color="${palette.amber}" stop-opacity=".38"/>
      <stop offset="1" stop-color="${palette.amber}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.brownLight}"/>
      <stop offset=".5" stop-color="${palette.crimson}"/>
      <stop offset="1" stop-color="${palette.brown}"/>
    </linearGradient>
    <pattern id="grain" width="80" height="40" patternUnits="userSpaceOnUse">
      <path d="M-10 20Q20 3 50 20T110 20" fill="none" stroke="${palette.gold}" stroke-opacity=".08" stroke-width="4"/>
    </pattern>`;

const backgrounds = [
  {
    file: 'assets/backgrounds/title-night.svg',
    title: 'いただきますの森・夜の入口',
    desc: '黒い森の入口に琥珀色の月と一人分の食卓が浮かび、木々の小さな目が静かに客を迎えるタイトル背景。',
    body: `
      <rect width="1600" height="900" fill="url(#sky)"/>
      <ellipse cx="800" cy="260" rx="430" ry="330" fill="url(#amberGlow)"/>
      <circle cx="800" cy="228" r="118" fill="${palette.gold}"/>
      <path d="M842 118a121 121 0 1 0 85 198a139 139 0 1 1-85-198Z" fill="${palette.ink}"/>
      <path d="M0 620Q230 460 500 555T900 530T1600 455V900H0Z" fill="#080b0d"/>
      <g fill="#040506">
        <path d="M0 0h245l110 900H0Z"/><path d="M285 0h170l83 900H390Z"/><path d="M480 0h115l62 900H550Z"/>
        <path d="M1600 0h-245l-110 900h355Z"/><path d="M1315 0h-170l-83 900h148Z"/><path d="M1120 0h-115l-62 900h107Z"/>
      </g>
      <g fill="${palette.gold}">
        <ellipse cx="570" cy="350" rx="12" ry="5"/><ellipse cx="604" cy="350" rx="12" ry="5"/>
        <ellipse cx="1010" cy="382" rx="10" ry="4"/><ellipse cx="1040" cy="382" rx="10" ry="4"/>
        <ellipse cx="660" cy="520" rx="8" ry="3"/><ellipse cx="684" cy="520" rx="8" ry="3"/>
      </g>
      <path d="M565 900L672 620H928L1035 900Z" fill="url(#wood)" stroke="${palette.ink}" stroke-width="18"/>
      <ellipse cx="800" cy="690" rx="128" ry="41" fill="${palette.bone}" stroke="${palette.gold}" stroke-width="14"/>
      <ellipse cx="800" cy="692" rx="70" ry="20" fill="${palette.ink}"/>
      <path d="M770 692q30-38 60 0q-30 20-60 0Z" fill="${palette.crimsonLight}"/>
      <g stroke="${palette.gold}" stroke-width="8" stroke-linecap="round"><path d="M620 628l-40 146"/><path d="M980 628l40 146"/></g>
      <path d="M708 842q92-60 184 0" fill="none" stroke="${palette.gold}" stroke-opacity=".55" stroke-width="7" stroke-dasharray="8 18"/>`
  },
  {
    file: 'assets/backgrounds/forest-day.svg',
    title: '琥珀昼の怪食の森',
    desc: '焦茶の木々の隙間から目のような琥珀色の太陽が照らし、深紅の小径に食器の花が咲く昼の森。',
    body: `
      <rect width="1600" height="900" fill="url(#sky)"/>
      <circle cx="800" cy="230" r="230" fill="url(#amberGlow)"/>
      <ellipse cx="800" cy="232" rx="112" ry="55" fill="${palette.gold}"/>
      <ellipse cx="800" cy="232" rx="54" ry="25" fill="${palette.ink}"/><circle cx="800" cy="232" r="10" fill="${palette.goldLight}"/>
      <path d="M0 560Q250 400 520 520T910 492T1600 430V900H0Z" fill="#10100e"/>
      <path d="M686 900C720 730 756 605 800 486c47 124 82 248 118 414Z" fill="${palette.crimson}" opacity=".75"/>
      <g fill="#07090a"><path d="M0 0h220l115 900H0Z"/><path d="M270 0h145l90 900H365Z"/><path d="M460 0h105l65 900H530Z"/><path d="M1600 0h-220l-115 900h335Z"/><path d="M1330 0h-145l-90 900h140Z"/><path d="M1140 0h-105l-65 900h100Z"/></g>
      <g stroke="#07090a" stroke-width="44" stroke-linecap="round"><path d="M160 180L530 40M345 300L630 150M1440 180L1070 40M1255 300L970 150"/></g>
      <g fill="${palette.gold}" opacity=".78"><circle cx="606" cy="354" r="8"/><circle cx="636" cy="354" r="8"/><circle cx="967" cy="390" r="7"/><circle cx="993" cy="390" r="7"/></g>
      <g stroke="${palette.gold}" stroke-width="9" fill="${palette.bone}"><ellipse cx="654" cy="664" rx="36" ry="12"/><path d="M654 676v72"/><ellipse cx="946" cy="702" rx="31" ry="10"/><path d="M946 712v62"/></g>
      <path d="M755 788q45-32 90 0q-45 27-90 0Z" fill="${palette.ink}" stroke="${palette.gold}" stroke-width="6"/>`
  },
  {
    file: 'assets/backgrounds/forest-night.svg',
    title: '深紅月の怪食の森',
    desc: '黒と深紺の夜の森を深紅の月と青緑の茸が照らし、遠い食卓まで金色の足跡が続く。',
    body: `
      <rect width="1600" height="900" fill="${palette.night}"/>
      <circle cx="800" cy="220" r="250" fill="url(#amberGlow)" opacity=".55"/>
      <circle cx="800" cy="214" r="125" fill="${palette.crimson}"/><circle cx="768" cy="195" r="12" fill="${palette.gold}"/><circle cx="835" cy="195" r="12" fill="${palette.gold}"/>
      <path d="M755 242q45 38 90 0" fill="none" stroke="${palette.ink}" stroke-width="12" stroke-linecap="round"/>
      <path d="M0 580Q260 420 510 540T920 500T1600 440V900H0Z" fill="#050708"/>
      <path d="M698 900C735 740 768 610 800 500c36 112 70 242 108 400Z" fill="${palette.gold}" opacity=".24"/>
      <g fill="#030405"><path d="M0 0h250l96 900H0Z"/><path d="M315 0h155l76 900H410Z"/><path d="M1600 0h-250l-96 900h346Z"/><path d="M1285 0h-155l-76 900h136Z"/></g>
      <g fill="${palette.teal}" stroke="${palette.tealLight}" stroke-width="5"><path d="M470 685q62-105 124 0Z"/><path d="M532 685v76"/><path d="M1008 720q54-91 108 0Z"/><path d="M1062 720v65"/></g>
      <g fill="${palette.gold}"><ellipse cx="585" cy="385" rx="10" ry="4"/><ellipse cx="615" cy="385" rx="10" ry="4"/><ellipse cx="980" cy="420" rx="9" ry="4"/><ellipse cx="1008" cy="420" rx="9" ry="4"/></g>
      <g fill="${palette.goldLight}" opacity=".7"><circle cx="770" cy="675" r="7"/><circle cx="815" cy="735" r="6"/><circle cx="784" cy="800" r="5"/></g>`
  },
  {
    file: 'assets/backgrounds/abandoned-diner.svg',
    title: '灯りの残る廃食堂',
    desc: '朽ちた焦茶の食堂で琥珀色のランプが一人分の定食を照らし、空の椅子の影だけがこちらを向く。',
    body: `
      <rect width="1600" height="610" fill="url(#sky)"/><rect y="610" width="1600" height="290" fill="${palette.brown}"/>
      <path d="M0 900L560 610M1600 900L1040 610M330 900L650 610M1270 900L950 610" stroke="${palette.gold}" stroke-opacity=".18" stroke-width="9"/>
      <rect x="585" y="90" width="430" height="330" rx="18" fill="#07090c" stroke="${palette.brownLight}" stroke-width="18"/>
      <path d="M800 90v330M585 255h430" stroke="${palette.crimson}" stroke-width="11"/>
      <path d="M800 0v145" stroke="${palette.ink}" stroke-width="17"/><path d="M675 174q125-144 250 0Z" fill="${palette.charcoal}" stroke="${palette.gold}" stroke-width="10"/>
      <path d="M520 180H1080L1185 715H415Z" fill="url(#amberGlow)" opacity=".65"/>
      <g fill="${palette.brownLight}" stroke="${palette.ink}" stroke-width="14"><path d="M0 470h470l95 160H0Z"/><path d="M1600 470h-470l-95 160h565Z"/><path d="M0 680h390l110 175H0Z"/><path d="M1600 680h-390l-110 175h500Z"/></g>
      <path d="M560 900L655 590H945L1040 900Z" fill="url(#wood)" stroke="${palette.ink}" stroke-width="18"/><ellipse cx="800" cy="626" rx="128" ry="41" fill="${palette.bone}" stroke="${palette.gold}" stroke-width="13"/>
      <g fill="${palette.crimsonLight}" stroke="${palette.ink}" stroke-width="9"><path d="M730 620q70-76 140 0q-70 39-140 0Z"/><circle cx="778" cy="605" r="7" fill="${palette.gold}"/><circle cx="822" cy="605" r="7" fill="${palette.gold}"/></g>
      <g fill="${palette.ink}" stroke="${palette.crimson}" stroke-width="9"><path d="M470 548h85l-25 220h-52Z"/><path d="M1045 548h85l-8 220h-52Z"/></g>`
  },
  {
    file: 'assets/backgrounds/shrine.svg',
    title: '三色の土を祀る社',
    desc: '黒い森の社に白い土、赤い土、灰色の土の三袋が供えられ、中央の黒豆から金色の芽がのぞく。',
    body: `
      <rect width="1600" height="900" fill="url(#sky)"/><ellipse cx="800" cy="360" rx="430" ry="360" fill="url(#amberGlow)" opacity=".45"/>
      <path d="M0 670Q300 520 610 620T1030 602T1600 535V900H0Z" fill="#070909"/>
      <g fill="${palette.crimson}" stroke="${palette.ink}" stroke-width="17"><path d="M520 180h80v510h-80Z"/><path d="M1000 180h80v510h-80Z"/><path d="M445 150q355 50 710 0l-29 95q-326 37-652 0Z"/><path d="M495 280h610v65H495Z"/></g>
      <circle cx="800" cy="300" r="44" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="12"/><path d="M800 278v44M778 300h44" stroke="${palette.crimson}" stroke-width="9"/>
      <path d="M690 900L738 520H862L910 900Z" fill="${palette.brown}"/>
      <g stroke="${palette.ink}" stroke-width="12"><path d="M608 704q62-94 124 0v122H608Z" fill="${palette.bone}"/><path d="M738 704q62-94 124 0v122H738Z" fill="${palette.crimsonLight}"/><path d="M868 704q62-94 124 0v122H868Z" fill="#77736c"/></g>
      <g fill="none" stroke="${palette.gold}" stroke-width="9"><path d="M650 735q20 17 40 0"/><path d="M780 735q20 17 40 0"/><path d="M910 735q20 17 40 0"/></g>
      <ellipse cx="800" cy="642" rx="54" ry="36" fill="${palette.ink}" stroke="${palette.gold}" stroke-width="9"/>
      <path d="M800 628q-8-84 56-115M802 572q-58-5-73-51M826 554q49 4 67-40" fill="none" stroke="${palette.gold}" stroke-width="15" stroke-linecap="round"/>
      <g fill="${palette.goldLight}"><circle cx="590" cy="470" r="9"/><circle cx="1010" cy="470" r="9"/><circle cx="705" cy="430" r="6"/><circle cx="895" cy="430" r="6"/></g>`
  },
  {
    file: 'assets/backgrounds/final-dining-room.svg',
    title: '最後の晩餐の間',
    desc: '黒と深紅の長い食卓に四つの異なる皿が琥珀色に照らされ、最奥の空席が最後の選択を待つ。',
    body: `
      <rect width="1600" height="900" fill="url(#sky)"/><ellipse cx="800" cy="355" rx="490" ry="430" fill="url(#amberGlow)" opacity=".48"/>
      <path d="M0 0L590 505M1600 0L1010 505M0 900L590 505M1600 900L1010 505" stroke="${palette.brownLight}" stroke-width="11" opacity=".52"/>
      <path d="M560 900L700 430H900L1040 900Z" fill="url(#wood)" stroke="${palette.ink}" stroke-width="20"/>
      <path d="M800 0v145" stroke="${palette.ink}" stroke-width="17"/><path d="M650 172q150-138 300 0q-150 92-300 0Z" fill="${palette.charcoal}" stroke="${palette.gold}" stroke-width="12"/>
      <g fill="${palette.bone}" stroke="${palette.gold}" stroke-width="9"><ellipse cx="800" cy="505" rx="72" ry="23"/><ellipse cx="800" cy="602" rx="94" ry="29"/><ellipse cx="800" cy="716" rx="118" ry="35"/><ellipse cx="800" cy="842" rx="145" ry="42"/></g>
      <g stroke="${palette.ink}" stroke-width="8"><path d="M772 501q28-38 56 0q-28 17-56 0Z" fill="${palette.gold}"/><path d="M765 598q35-45 70 0q-35 20-70 0Z" fill="${palette.crimsonLight}"/><path d="M758 711q42-53 84 0q-42 24-84 0Z" fill="${palette.tealLight}"/><path d="M746 836q54-66 108 0q-54 28-108 0Z" fill="${palette.ink}" stroke="${palette.gold}"/></g>
      <g fill="${palette.charcoal}" stroke="${palette.crimson}" stroke-width="10"><path d="M532 514h86l-18 210h-55Z"/><path d="M982 514h86l-13 210h-55Z"/><path d="M470 655h102l-16 245h-68Z"/><path d="M1028 655h102l-18 245h-68Z"/></g>`
  },
  {
    file: 'assets/backgrounds/survivor-banquet.svg',
    title: '生存者へ配膳される祝宴',
    desc: '琥珀色の祝宴会場で保存食、生きている、空、帰還を象徴する四箱が並び、一脚の椅子だけが生存者を待つ。',
    body: `
      <rect width="1600" height="900" fill="url(#sky)"/><ellipse cx="800" cy="410" rx="520" ry="440" fill="url(#amberGlow)" opacity=".62"/>
      <path d="M0 710Q320 575 590 675T1050 660T1600 585V900H0Z" fill="#080807"/>
      <g stroke="${palette.crimson}" stroke-width="17" fill="none"><path d="M0 150q260 130 520 0t520 0t560 0"/><path d="M0 242q260 130 520 0t520 0t560 0"/></g>
      <g fill="${palette.gold}"><path d="M220 110l15 34l37 3l-28 24l9 36l-33-20l-32 20l9-36l-29-24l38-3Z"/><path d="M1340 120l13 29l32 3l-25 21l8 31l-28-17l-28 17l8-31l-25-21l32-3Z"/></g>
      <path d="M520 900L630 555H970L1080 900Z" fill="url(#wood)" stroke="${palette.ink}" stroke-width="19"/>
      <g stroke="${palette.ink}" stroke-width="10"><g transform="translate(610 610)"><path d="M0 45h150v120H0Z" fill="${palette.brownLight}"/><path d="M-8 45L18 7h114l26 38Z" fill="${palette.gold}"/><path d="M42 87h66v34H42Z" fill="${palette.bone}"/></g><g transform="translate(840 610)"><path d="M0 45h150v120H0Z" fill="${palette.crimson}"/><path d="M-8 45L18 7h114l26 38Z" fill="${palette.crimsonLight}"/><ellipse cx="75" cy="102" rx="31" ry="20" fill="${palette.ink}"/><circle cx="63" cy="98" r="5" fill="${palette.gold}"/><circle cx="87" cy="98" r="5" fill="${palette.gold}"/></g><g transform="translate(610 790)"><path d="M0 25h150v86H0Z" fill="${palette.charcoal}"/><path d="M-8 25L18-8h114l26 33Z" fill="#4b4d52"/><ellipse cx="75" cy="69" rx="36" ry="14" fill="${palette.ink}"/></g><g transform="translate(840 790)"><path d="M0 25h150v86H0Z" fill="${palette.brownLight}"/><path d="M-8 25L18-8h114l26 33Z" fill="${palette.gold}"/><path d="M75 42v48M52 66h46" stroke="${palette.teal}" stroke-width="10"/></g></g>
      <path d="M704 498h192l38 160H666Z" fill="${palette.brown}" stroke="${palette.gold}" stroke-width="12"/><path d="M722 498q78-143 156 0" fill="${palette.crimson}" stroke="${palette.gold}" stroke-width="12"/>`
  },
  {
    file: 'assets/backgrounds/dawn-escape.svg',
    title: '朝食のない朝への脱出',
    desc: '黒い森の木々が左右へ開き、深紅から金色へ変わる朝焼けの先に空の器を抱えた帰り道が続く。',
    body: `
      <rect width="1600" height="900" fill="url(#dawn)"/>
      <circle cx="800" cy="575" r="250" fill="url(#amberGlow)"/>
      <circle cx="800" cy="572" r="104" fill="${palette.goldLight}"/>
      <path d="M0 620Q270 500 540 620T1000 610T1600 505V900H0Z" fill="#090a09"/>
      <path d="M590 900Q682 700 800 620Q918 700 1010 900Z" fill="${palette.bone}" opacity=".5"/>
      <g fill="#030405"><path d="M0 0h300l80 900H0Z"/><path d="M315 0h155l90 720H410Z"/><path d="M1600 0h-300l-80 900h380Z"/><path d="M1285 0h-155l-90 720h150Z"/></g>
      <g stroke="#030405" stroke-width="52" stroke-linecap="round"><path d="M225 210L590 42M390 355L650 195M1375 210L1010 42M1210 355L950 195"/></g>
      <g fill="${palette.gold}" opacity=".76"><circle cx="604" cy="502" r="8"/><circle cx="635" cy="502" r="8"/><circle cx="968" cy="526" r="7"/><circle cx="995" cy="526" r="7"/></g>
      <ellipse cx="800" cy="790" rx="116" ry="38" fill="${palette.charcoal}" stroke="${palette.gold}" stroke-width="12"/><ellipse cx="800" cy="785" rx="72" ry="20" fill="${palette.ink}"/>
      <path d="M748 848q52-24 104 0" fill="none" stroke="${palette.crimson}" stroke-width="10" stroke-linecap="round"/>`
  }
];

const characterDefs = `
    <radialGradient id="halo">
      <stop offset="0" stop-color="${palette.gold}" stop-opacity=".28"/>
      <stop offset="1" stop-color="${palette.gold}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="warm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.goldLight}"/>
      <stop offset=".48" stop-color="${palette.amber}"/>
      <stop offset="1" stop-color="${palette.crimson}"/>
    </linearGradient>
    <linearGradient id="dark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.teal}"/>
      <stop offset="1" stop-color="${palette.ink}"/>
    </linearGradient>`;

const characterBase = body => `
      <ellipse cx="400" cy="590" rx="360" ry="520" fill="url(#halo)"/>
      <ellipse cx="400" cy="1090" rx="260" ry="54" fill="${palette.ink}" opacity=".5"/>
      ${body}`;

const characters = [
  {
    file: 'assets/characters/tako.svg', title: '寄生タコ',
    desc: '深紅の丸い頭と琥珀色の目を持ち、缶帽子をかぶって八本の触腕で丁寧にお辞儀する少し可愛い寄生タコ。',
    body: characterBase(`
      <g id="tentacles" fill="none" stroke="${palette.crimson}" stroke-width="58" stroke-linecap="round"><path data-tentacle="1" d="M326 694Q84 760 128 1040"/><path data-tentacle="2" d="M354 718Q165 856 230 1090"/><path data-tentacle="3" d="M382 728Q280 890 330 1100"/><path data-tentacle="4" d="M410 730Q370 900 384 1105"/><path data-tentacle="5" d="M390 730Q430 900 416 1105"/><path data-tentacle="6" d="M418 728Q520 890 470 1100"/><path data-tentacle="7" d="M446 718Q635 856 570 1090"/><path data-tentacle="8" d="M474 694Q716 760 672 1040"/></g>
      <ellipse cx="400" cy="510" rx="245" ry="290" fill="url(#warm)" stroke="${palette.ink}" stroke-width="24"/>
      <path d="M220 400q180-190 360 0" fill="none" stroke="${palette.goldLight}" stroke-opacity=".38" stroke-width="34" stroke-linecap="round"/>
      <g id="can-hat"><path d="M310 236h180l-19-130H329Z" fill="${palette.charcoal}" stroke="${palette.gold}" stroke-width="15"/><ellipse cx="400" cy="106" rx="71" ry="22" fill="${palette.brownLight}" stroke="${palette.gold}" stroke-width="12"/><ellipse cx="400" cy="236" rx="90" ry="25" fill="${palette.ink}" stroke="${palette.gold}" stroke-width="13"/><path d="M350 150h100" stroke="${palette.goldLight}" stroke-width="11" stroke-linecap="round"/><circle cx="365" cy="193" r="9" fill="${palette.gold}"/><circle cx="435" cy="193" r="9" fill="${palette.gold}"/></g>
      <ellipse cx="325" cy="515" rx="42" ry="30" fill="${palette.ink}"/><ellipse cx="475" cy="515" rx="42" ry="30" fill="${palette.ink}"/><circle cx="337" cy="506" r="9" fill="${palette.gold}"/><circle cx="487" cy="506" r="9" fill="${palette.gold}"/>
      <path d="M337 615q63 58 126 0" fill="none" stroke="${palette.ink}" stroke-width="18" stroke-linecap="round"/>
      <g fill="${palette.gold}"><circle cx="174" cy="847" r="15"/><circle cx="283" cy="939" r="14"/><circle cx="517" cy="939" r="14"/><circle cx="626" cy="847" r="15"/></g>`)
  },
  {
    file: 'assets/characters/jr.svg', title: '解毒寄生虫Jr.',
    desc: '青緑の節を持つ小さな解毒寄生虫Jr.が琥珀色の薬鞄を斜めに掛け、胸を張って立つ。',
    body: characterBase(`
      <path d="M400 190C205 245 235 420 375 468C555 530 190 655 290 820C348 916 516 884 535 1018" fill="none" stroke="${palette.ink}" stroke-width="160" stroke-linecap="round"/>
      <path d="M400 190C225 250 265 397 390 437C555 491 233 659 320 796C365 867 475 843 505 1018" fill="none" stroke="url(#dark)" stroke-width="120" stroke-linecap="round"/>
      <g fill="none" stroke="${palette.tealLight}" stroke-width="12"><path d="M315 302q90 45 174 0"/><path d="M310 490q99 51 189 4"/><path d="M299 706q101 57 199 3"/><path d="M334 867q83 35 157-3"/></g>
      <ellipse cx="356" cy="276" rx="27" ry="19" fill="${palette.gold}"/><ellipse cx="444" cy="276" rx="27" ry="19" fill="${palette.gold}"/><circle cx="365" cy="271" r="7" fill="${palette.ink}"/><circle cx="453" cy="271" r="7" fill="${palette.ink}"/>
      <path d="M363 335q37 30 74 0" fill="none" stroke="${palette.crimsonLight}" stroke-width="13" stroke-linecap="round"/>
      <path d="M290 418L535 728" stroke="${palette.gold}" stroke-width="22"/><rect x="438" y="625" width="178" height="150" rx="28" fill="${palette.brownLight}" stroke="${palette.gold}" stroke-width="14"/><path d="M527 655v91M481 700h92" stroke="${palette.goldLight}" stroke-width="13"/>`)
  },
  {
    file: 'assets/characters/bean-child.svg', title: '黒豆の幼体',
    desc: '艶のある黒豆の体から二枚の金色の若葉を伸ばした幼体が、小さな根を足のように揃えて座る。',
    body: characterBase(`
      <ellipse cx="400" cy="665" rx="245" ry="306" fill="${palette.ink}" stroke="${palette.gold}" stroke-width="22" transform="rotate(-9 400 665)"/>
      <path d="M382 378Q322 199 162 270Q223 418 382 425Z" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="20"/><path d="M418 378Q484 185 651 285Q571 430 418 425Z" fill="${palette.teal}" stroke="${palette.ink}" stroke-width="20"/>
      <path d="M400 436V304" stroke="${palette.goldLight}" stroke-width="18" stroke-linecap="round"/>
      <ellipse cx="325" cy="652" rx="31" ry="21" fill="${palette.gold}"/><ellipse cx="470" cy="631" rx="31" ry="21" fill="${palette.gold}"/><circle cx="335" cy="647" r="8" fill="${palette.ink}"/><circle cx="480" cy="626" r="8" fill="${palette.ink}"/>
      <path d="M349 730q56 44 112-6" fill="none" stroke="${palette.crimsonLight}" stroke-width="16" stroke-linecap="round"/>
      <g fill="none" stroke="${palette.gold}" stroke-width="20" stroke-linecap="round"><path d="M300 916q-53 101-142 136"/><path d="M460 946q43 104 139 128"/></g>`)
  },
  {
    file: 'assets/characters/bean-past-white.svg', title: '白い土の黒豆・過去',
    desc: '白い土をまとった黒豆が淡い骨色の葉と古い記憶の輪を背負い、懐かしそうに微笑む姿。',
    body: characterBase(`
      <circle cx="400" cy="585" r="310" fill="none" stroke="${palette.bone}" stroke-opacity=".55" stroke-width="18" stroke-dasharray="18 25"/>
      <path d="M190 875q18-275 210-395q192 120 210 395Z" fill="${palette.bone}" stroke="${palette.ink}" stroke-width="24"/>
      <ellipse cx="400" cy="605" rx="180" ry="225" fill="${palette.ink}" stroke="${palette.gold}" stroke-width="19"/>
      <path d="M398 391Q330 238 202 304Q253 432 398 435Z" fill="${palette.bone}" stroke="${palette.ink}" stroke-width="18"/><path d="M404 390Q481 235 615 315Q544 441 404 435Z" fill="${palette.goldLight}" stroke="${palette.ink}" stroke-width="18"/>
      <ellipse cx="340" cy="606" rx="26" ry="18" fill="${palette.gold}"/><ellipse cx="460" cy="606" rx="26" ry="18" fill="${palette.gold}"/><path d="M355 674q45 34 90 0" fill="none" stroke="${palette.bone}" stroke-width="14" stroke-linecap="round"/>
      <g fill="${palette.bone}"><circle cx="180" cy="500" r="12"/><circle cx="635" cy="530" r="9"/><circle cx="225" cy="720" r="8"/></g>`)
  },
  {
    file: 'assets/characters/bean-future-red.svg', title: '赤い土の黒豆・未来',
    desc: '深紅の土から高く伸びた黒豆が赤い四枚葉と金の実をつけ、まだ来ない食卓を指し示す姿。',
    body: characterBase(`
      <path d="M220 1030q35-420 180-635q145 215 180 635Z" fill="${palette.crimson}" stroke="${palette.ink}" stroke-width="24"/>
      <ellipse cx="400" cy="664" rx="155" ry="210" fill="${palette.ink}" stroke="${palette.gold}" stroke-width="19"/>
      <path d="M400 455V197" stroke="${palette.gold}" stroke-width="24" stroke-linecap="round"/>
      <path d="M390 338Q260 176 139 282Q242 414 390 397Z" fill="${palette.crimsonLight}" stroke="${palette.ink}" stroke-width="18"/><path d="M410 338Q540 176 661 282Q558 414 410 397Z" fill="${palette.crimson}" stroke="${palette.ink}" stroke-width="18"/>
      <path d="M399 242Q322 104 229 178Q294 290 399 294Z" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="16"/><path d="M405 242Q478 104 571 178Q506 290 405 294Z" fill="${palette.goldLight}" stroke="${palette.ink}" stroke-width="16"/>
      <g fill="${palette.gold}"><circle cx="333" cy="650" r="27"/><circle cx="467" cy="650" r="27"/><circle cx="400" cy="190" r="24"/></g><path d="M354 730q46 38 92 0" fill="none" stroke="${palette.crimsonLight}" stroke-width="15" stroke-linecap="round"/>`)
  },
  {
    file: 'assets/characters/bean-present-gray.svg', title: '灰色の土の黒豆・現在',
    desc: '灰色の土に根を張る黒豆が金と青緑に分かれた葉を持ち、今の食卓を慎重に見つめる姿。',
    body: characterBase(`
      <path d="M165 1018q70-246 235-292q165 46 235 292Z" fill="#69645c" stroke="${palette.ink}" stroke-width="24"/>
      <ellipse cx="400" cy="660" rx="205" ry="265" fill="${palette.ink}" stroke="#8a857c" stroke-width="22"/>
      <path d="M400 420V230" stroke="${palette.gold}" stroke-width="20"/>
      <path d="M392 338Q270 194 159 288Q244 414 392 397Z" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="19"/><path d="M408 338Q530 194 641 288Q556 414 408 397Z" fill="${palette.teal}" stroke="${palette.ink}" stroke-width="19"/>
      <path d="M400 426v472" stroke="#77736d" stroke-width="12"/>
      <ellipse cx="330" cy="641" rx="31" ry="21" fill="${palette.gold}"/><ellipse cx="470" cy="641" rx="31" ry="21" fill="${palette.tealLight}"/><circle cx="340" cy="635" r="8" fill="${palette.ink}"/><circle cx="480" cy="635" r="8" fill="${palette.ink}"/>
      <path d="M350 726q50 30 100 0" fill="none" stroke="${palette.bone}" stroke-width="15" stroke-linecap="round"/>`)
  },
  {
    file: 'assets/characters/bean-body.svg', title: '身体から発芽した黒豆',
    desc: '人のような焦茶の身体の胸から黒豆の芽が伸び、琥珀色の葉と小さな黒い実が静かに呼吸する姿。',
    body: characterBase(`
      <circle cx="400" cy="285" r="145" fill="${palette.brownLight}" stroke="${palette.ink}" stroke-width="23"/>
      <path d="M230 985q15-458 170-520q155 62 170 520Z" fill="${palette.brown}" stroke="${palette.ink}" stroke-width="26"/>
      <path d="M280 535Q115 660 145 930M520 535Q685 660 655 930" fill="none" stroke="${palette.brownLight}" stroke-width="76" stroke-linecap="round"/>
      <ellipse cx="350" cy="287" rx="27" ry="18" fill="${palette.gold}"/><ellipse cx="450" cy="287" rx="27" ry="18" fill="${palette.gold}"/><path d="M360 352q40 31 80 0" fill="none" stroke="${palette.crimsonLight}" stroke-width="14" stroke-linecap="round"/>
      <ellipse cx="400" cy="644" rx="86" ry="112" fill="${palette.ink}" stroke="${palette.gold}" stroke-width="17"/>
      <path d="M400 548V370" stroke="${palette.gold}" stroke-width="19"/><path d="M392 458Q300 350 214 422Q279 514 392 504Z" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="16"/><path d="M408 458Q500 350 586 422Q521 514 408 504Z" fill="${palette.teal}" stroke="${palette.ink}" stroke-width="16"/>
      <path d="M400 760q-50 112-125 218M400 760q50 112 125 218" fill="none" stroke="${palette.gold}" stroke-width="15" stroke-linecap="round"/>`)
  },
  {
    file: 'assets/characters/shadow.svg', title: '自我を持つ影',
    desc: '金色の目と深紅の口だけを浮かべる青黒い影が、空の皿を両手で大切そうに差し出す姿。',
    body: characterBase(`
      <path d="M192 1028Q225 805 246 530Q265 208 400 130Q535 208 554 530Q575 805 608 1028Q502 1084 400 1024Q298 1084 192 1028Z" fill="${palette.ink}" stroke="${palette.teal}" stroke-width="22"/>
      <path d="M252 525Q82 650 123 855M548 525Q718 650 677 855" fill="none" stroke="${palette.ink}" stroke-width="100" stroke-linecap="round"/>
      <ellipse cx="333" cy="426" rx="36" ry="20" fill="${palette.gold}"/><ellipse cx="467" cy="426" rx="36" ry="20" fill="${palette.gold}"/><circle cx="343" cy="421" r="8" fill="${palette.ink}"/><circle cx="477" cy="421" r="8" fill="${palette.ink}"/>
      <path d="M344 515q56 45 112 0" fill="none" stroke="${palette.crimsonLight}" stroke-width="18" stroke-linecap="round"/>
      <ellipse cx="400" cy="790" rx="230" ry="76" fill="${palette.bone}" stroke="${palette.gold}" stroke-width="16"/><ellipse cx="400" cy="785" rx="150" ry="45" fill="${palette.ink}"/>
      <g fill="${palette.tealLight}" opacity=".55"><circle cx="275" cy="268" r="10"/><circle cx="505" cy="300" r="8"/><circle cx="305" cy="640" r="7"/></g>`)
  },
  {
    file: 'assets/characters/invisible-cleaner.svg', title: '透明清掃員',
    desc: '姿のない頭の周りに金縁の帽子、手袋、前掛け、箒だけが浮かび、几帳面に食卓を掃く清掃員。',
    body: characterBase(`
      <path d="M235 1005q20-372 165-492q145 120 165 492Z" fill="${palette.teal}" fill-opacity=".24" stroke="${palette.gold}" stroke-width="19" stroke-dasharray="18 15"/>
      <path d="M282 310q118-138 236 0Z" fill="${palette.brown}" stroke="${palette.gold}" stroke-width="18"/><path d="M235 310h330" stroke="${palette.gold}" stroke-width="22" stroke-linecap="round"/>
      <path d="M305 357q95 75 190 0" fill="none" stroke="${palette.gold}" stroke-opacity=".45" stroke-width="13" stroke-dasharray="12 22"/>
      <path d="M255 566Q96 660 155 854M545 566Q704 660 645 854" fill="none" stroke="${palette.gold}" stroke-width="23" stroke-dasharray="18 16"/>
      <g fill="${palette.bone}" stroke="${palette.ink}" stroke-width="14"><path d="M112 817q47-58 99 0l-11 87q-50 31-100 0Z"/><path d="M588 817q47-58 99 0l11 87q-50 31-100 0Z"/></g>
      <path d="M635 250L425 1055" stroke="${palette.brownLight}" stroke-width="28" stroke-linecap="round"/><path d="M332 1013q110-92 220 0l-33 93H365Z" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="18"/>
      <path d="M288 600h224l-35 316H323Z" fill="${palette.crimson}" fill-opacity=".6" stroke="${palette.gold}" stroke-width="17"/>`)
  },
  {
    file: 'assets/characters/forest-manager.svg', title: '森の管理者',
    desc: '枝角に金の食器を吊るし、黒い外套と深紅の蝶飾りを着けた鹿頭の森の管理者が帳面を抱える。',
    body: characterBase(`
      <path d="M310 335Q180 210 164 75M302 286Q185 250 112 165M490 335Q620 210 636 75M498 286Q615 250 688 165" fill="none" stroke="${palette.gold}" stroke-width="24" stroke-linecap="round"/>
      <path d="M280 257Q400 143 520 257L560 502Q515 658 400 700Q285 658 240 502Z" fill="${palette.brownLight}" stroke="${palette.ink}" stroke-width="24"/>
      <path d="M276 311l-120-82q-19 143 128 176M524 311l120-82q19 143-128 176" fill="${palette.brown}" stroke="${palette.ink}" stroke-width="20"/>
      <ellipse cx="332" cy="438" rx="34" ry="23" fill="${palette.gold}"/><ellipse cx="468" cy="438" rx="34" ry="23" fill="${palette.gold}"/><circle cx="343" cy="432" r="9" fill="${palette.ink}"/><circle cx="479" cy="432" r="9" fill="${palette.ink}"/>
      <path d="M350 546q50 42 100 0" fill="none" stroke="${palette.ink}" stroke-width="16" stroke-linecap="round"/>
      <path d="M205 1060q30-374 195-444q165 70 195 444Z" fill="${palette.charcoal}" stroke="${palette.gold}" stroke-width="22"/>
      <path d="M332 664l68 70l68-70l46 89l-114 70l-114-70Z" fill="${palette.crimson}" stroke="${palette.ink}" stroke-width="15"/>
      <rect x="410" y="790" width="205" height="230" rx="18" fill="${palette.brown}" stroke="${palette.gold}" stroke-width="17"/><path d="M455 852h118M455 908h118M455 964h75" stroke="${palette.goldLight}" stroke-width="10" stroke-linecap="round"/>
      <g fill="${palette.bone}" stroke="${palette.gold}" stroke-width="6"><ellipse cx="170" cy="118" rx="35" ry="11"/><ellipse cx="630" cy="118" rx="35" ry="11"/></g>`)
  }
];

const cardDefs = `
    <radialGradient id="cardBg">
      <stop offset="0" stop-color="${palette.brownLight}"/>
      <stop offset=".55" stop-color="${palette.brown}"/>
      <stop offset="1" stop-color="${palette.ink}"/>
    </radialGradient>
    <radialGradient id="cardGlow">
      <stop offset="0" stop-color="${palette.goldLight}" stop-opacity=".56"/>
      <stop offset="1" stop-color="${palette.gold}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="foodWarm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.goldLight}"/>
      <stop offset=".5" stop-color="${palette.amber}"/>
      <stop offset="1" stop-color="${palette.crimson}"/>
    </linearGradient>
    <linearGradient id="foodCool" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.tealLight}"/>
      <stop offset=".52" stop-color="${palette.teal}"/>
      <stop offset="1" stop-color="${palette.night}"/>
    </linearGradient>`;

const cardBase = body => `
      <rect x="22" y="22" width="756" height="756" rx="92" fill="url(#cardBg)" stroke="${palette.gold}" stroke-width="18"/>
      <circle cx="400" cy="392" r="306" fill="url(#cardGlow)"/>
      <circle cx="400" cy="400" r="316" fill="none" stroke="${palette.crimsonLight}" stroke-opacity=".45" stroke-width="7" stroke-dasharray="10 23"/>
      <path d="M126 650Q400 711 674 650" fill="none" stroke="${palette.gold}" stroke-width="17" stroke-linecap="round"/>
      ${body}`;

const cards = [
  {
    file: 'assets/cards/rice-ball.svg', title: '指湯気のおにぎり',
    desc: '琥珀色の米粒と黒い海苔をまとった三角のおにぎりから、細い指の形をした三本の湯気が立つ。',
    body: cardBase(`
      <path d="M400 138C320 148 186 430 200 558c8 78 392 78 400 0c14-128-120-410-200-420Z" fill="${palette.bone}" stroke="${palette.ink}" stroke-width="22"/>
      <g fill="${palette.goldLight}"><circle cx="326" cy="304" r="10"/><circle cx="444" cy="256" r="9"/><circle cx="290" cy="408" r="8"/><circle cx="506" cy="410" r="10"/></g>
      <path d="M282 436h236l-14 165H296Z" fill="${palette.night}" stroke="${palette.ink}" stroke-width="15"/>
      <ellipse cx="360" cy="500" rx="21" ry="12" fill="${palette.gold}"/><ellipse cx="440" cy="500" rx="21" ry="12" fill="${palette.gold}"/><path d="M370 548q30 22 60 0" fill="none" stroke="${palette.crimson}" stroke-width="11" stroke-linecap="round"/>
      <g fill="none" stroke="${palette.goldLight}" stroke-width="13" stroke-linecap="round"><path d="M335 205q-74-64-3-124q-31 62 10 85"/><path d="M400 174q-54-86 28-136q-47 66-5 100"/><path d="M467 205q72-65 5-126q28 66-11 88"/></g>`)
  },
  {
    file: 'assets/cards/blue-gel.svg', title: '冷却結晶の青いゲル',
    desc: '青緑の透明なゲルが内部に六角形の冷却結晶と金色の泡を抱え、器の上で美味しそうに震える。',
    body: cardBase(`
      <path d="M180 562c0-70 71-108 84-184c18-108 27-235 136-235s118 127 136 235c13 76 84 114 84 184c0 105-440 105-440 0Z" fill="url(#foodCool)" stroke="${palette.ink}" stroke-width="22"/>
      <path d="M280 312q56-103 127-91" fill="none" stroke="${palette.bone}" stroke-opacity=".5" stroke-width="25" stroke-linecap="round"/>
      <path d="M400 305l58 34v68l-58 34l-58-34v-68Z" fill="${palette.gold}" fill-opacity=".6" stroke="${palette.goldLight}" stroke-width="10"/><path d="M400 305v136M342 339l116 68M458 339l-116 68" stroke="${palette.night}" stroke-width="8"/>
      <g fill="${palette.goldLight}"><circle cx="325" cy="485" r="17"/><circle cx="475" cy="485" r="17"/><circle cx="355" cy="555" r="10"/></g><path d="M352 535q48 38 96 0" fill="none" stroke="${palette.crimsonLight}" stroke-width="13" stroke-linecap="round"/>`)
  },
  {
    file: 'assets/cards/red-mushroom.svg', title: '月影だけが光る赤い茸',
    desc: '深紅の傘に金の斑点が浮かぶ茸が、青緑に光る自分の影を足元へ落として静かに立つ。',
    body: cardBase(`
      <ellipse cx="400" cy="620" rx="248" ry="58" fill="${palette.teal}" opacity=".6"/>
      <path d="M320 386q-4 106-52 238q132 45 264 0q-48-132-52-238Z" fill="${palette.bone}" stroke="${palette.ink}" stroke-width="20"/>
      <path d="M136 397c29-166 128-268 264-268s235 102 264 268c-126 52-402 52-528 0Z" fill="${palette.crimsonLight}" stroke="${palette.ink}" stroke-width="22"/>
      <g fill="${palette.gold}"><circle cx="265" cy="275" r="29"/><circle cx="430" cy="208" r="23"/><circle cx="548" cy="320" r="27"/><circle cx="366" cy="347" r="16"/></g>
      <ellipse cx="365" cy="484" rx="17" ry="10" fill="${palette.ink}"/><ellipse cx="435" cy="484" rx="17" ry="10" fill="${palette.ink}"/><path d="M373 536q27-22 54 0" fill="none" stroke="${palette.crimson}" stroke-width="11" stroke-linecap="round"/>`)
  },
  {
    file: 'assets/cards/whisper-can.svg', title: '吸盤跡のある囁く缶詰',
    desc: '焦茶と金の古い缶詰の内側に吸盤の丸い跡が並び、開いた隙間から琥珀色の囁きが漏れる。',
    body: cardBase(`
      <path d="M214 250h372v335c0 82-372 82-372 0Z" fill="url(#foodWarm)" stroke="${palette.ink}" stroke-width="22"/><ellipse cx="400" cy="250" rx="186" ry="58" fill="${palette.brownLight}" stroke="${palette.ink}" stroke-width="21"/><ellipse cx="400" cy="250" rx="132" ry="31" fill="${palette.night}" stroke="${palette.gold}" stroke-width="10"/>
      <g fill="none" stroke="${palette.crimsonLight}" stroke-width="12"><circle cx="344" cy="252" r="23"/><circle cx="400" cy="242" r="23"/><circle cx="456" cy="252" r="23"/></g>
      <path d="M302 382h196v124H302Z" fill="${palette.crimson}" stroke="${palette.ink}" stroke-width="13"/><ellipse cx="362" cy="435" rx="17" ry="10" fill="${palette.gold}"/><ellipse cx="438" cy="435" rx="17" ry="10" fill="${palette.gold}"/><path d="M370 478q30 18 60 0" fill="none" stroke="${palette.ink}" stroke-width="10" stroke-linecap="round"/>
      <g fill="none" stroke="${palette.goldLight}" stroke-linecap="round"><path d="M474 231q104-91 146 0q27 58 82-7" stroke-width="15"/><path d="M490 272q87-40 114 26q19 46 74 8" stroke-width="10" opacity=".72"/></g>`)
  },
  {
    file: 'assets/cards/strawberry-soap.svg', title: '苺の香りの石鹸',
    desc: '苺そっくりの深紅の石鹸が金色の泡をまとい、青緑の葉の形をした受け皿で甘そうに輝く。',
    body: cardBase(`
      <path d="M400 592Q238 514 226 346Q238 210 400 250Q562 210 574 346Q562 514 400 592Z" fill="${palette.crimsonLight}" stroke="${palette.ink}" stroke-width="22"/>
      <path d="M400 253q-94-128-190-47q72 112 190 98q94-128 190-47q-72 112-190 98Z" fill="${palette.teal}" stroke="${palette.ink}" stroke-width="18"/>
      <g fill="${palette.goldLight}"><ellipse cx="330" cy="352" rx="8" ry="14"/><ellipse cx="402" cy="332" rx="8" ry="14"/><ellipse cx="475" cy="361" rx="8" ry="14"/><ellipse cx="360" cy="438" rx="8" ry="14"/><ellipse cx="444" cy="456" rx="8" ry="14"/></g>
      <g fill="none" stroke="${palette.gold}" stroke-width="10"><circle cx="225" cy="255" r="25"/><circle cx="600" cy="315" r="18"/><circle cx="184" cy="420" r="14"/><circle cx="625" cy="480" r="27"/></g>
      <ellipse cx="400" cy="596" rx="215" ry="56" fill="${palette.teal}" fill-opacity=".55" stroke="${palette.gold}" stroke-width="11"/>`)
  },
  {
    file: 'assets/cards/golden-apple.svg', title: '願いを映す黄金の林檎',
    desc: '琥珀と金に輝く林檎の表面へ輪のような願いの印が浮かび、ひと口分の黒い影だけが欠けている。',
    body: cardBase(`
      <path d="M405 260q-10-92 62-142" fill="none" stroke="${palette.brownLight}" stroke-width="30" stroke-linecap="round"/><path d="M438 183q70-86 158-26q-60 83-158 26Z" fill="${palette.teal}" stroke="${palette.ink}" stroke-width="11"/>
      <path d="M400 250c-45-45-118-47-174 4c-110 101-27 365 174 405c201-40 284-304 174-405c-56-51-129-49-174-4Z" fill="url(#foodWarm)" stroke="${palette.ink}" stroke-width="23"/>
      <path d="M550 310a50 50 0 0 0 42 82a48 48 0 0 0 0 72a48 48 0 0 0-42 77c83-29 124-171 62-246a48 48 0 0 0-62 15Z" fill="${palette.ink}"/>
      <circle cx="390" cy="425" r="91" fill="none" stroke="${palette.goldLight}" stroke-width="10"/><path d="M390 347v156M312 425h156" stroke="${palette.goldLight}" stroke-width="9"/>
      <ellipse cx="340" cy="405" rx="18" ry="11" fill="${palette.ink}"/><ellipse cx="430" cy="405" rx="18" ry="11" fill="${palette.ink}"/><path d="M350 473q35 24 70 0" fill="none" stroke="${palette.crimson}" stroke-width="12" stroke-linecap="round"/>`)
  },
  {
    file: 'assets/cards/revive-cookie.svg', title: '脈打つ復活クッキー',
    desc: '焦げ茶の丸いクッキーに深紅の心臓模様と金の砂糖粒が刻まれ、欠けた縁が小さく脈打つ。',
    body: cardBase(`
      <circle cx="400" cy="400" r="244" fill="${palette.brownLight}" stroke="${palette.ink}" stroke-width="24"/><path d="M587 244a54 54 0 0 0 65 77a56 56 0 0 0-1 82a52 52 0 0 0-55 70c54-49 68-150 35-218a52 52 0 0 0-44-11Z" fill="${palette.ink}"/>
      <path d="M400 533C274 448 287 318 355 300c38-10 45 25 45 25s7-35 45-25c68 18 81 148-45 233Z" fill="${palette.crimsonLight}" stroke="${palette.ink}" stroke-width="17"/>
      <path d="M310 420h66l27-67l39 118l28-51h63" fill="none" stroke="${palette.goldLight}" stroke-width="13" stroke-linejoin="round"/>
      <g fill="${palette.gold}"><circle cx="290" cy="270" r="14"/><circle cx="492" cy="250" r="11"/><circle cx="277" cy="530" r="10"/><circle cx="500" cy="552" r="13"/></g>`)
  },
  {
    file: 'assets/cards/black-pudding.svg', title: '黒い脈のプディング',
    desc: '艶のある黒いプディングに金色の蜜と深紅の脈が走り、銀色の皿の上で静かに呼吸する。',
    body: cardBase(`
      <ellipse cx="400" cy="605" rx="252" ry="72" fill="${palette.bone}" stroke="${palette.gold}" stroke-width="15"/>
      <path d="M218 572q16-78 63-157q41-70 43-207h152q2 137 43 207q47 79 63 157q-182 91-364 0Z" fill="${palette.ink}" stroke="${palette.gold}" stroke-width="20"/>
      <ellipse cx="400" cy="210" rx="77" ry="31" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="14"/>
      <path d="M312 338q80 70 176 0M280 464q114 93 240 0" fill="none" stroke="${palette.crimson}" stroke-width="15"/>
      <path d="M333 255q65 49 134 0" fill="none" stroke="${palette.goldLight}" stroke-width="22" stroke-linecap="round"/>
      <ellipse cx="352" cy="430" rx="19" ry="11" fill="${palette.gold}"/><ellipse cx="448" cy="430" rx="19" ry="11" fill="${palette.gold}"/><path d="M365 500q35 26 70 0" fill="none" stroke="${palette.crimsonLight}" stroke-width="12" stroke-linecap="round"/>`)
  },
  {
    file: 'assets/cards/red-blue-capsules.svg', title: '赤と青の二色カプセル',
    desc: '深紅と青緑の二本の薬カプセルが金の薬皿で向かい合い、それぞれ反対向きの小さな目を持つ。',
    body: cardBase(`
      <ellipse cx="400" cy="610" rx="260" ry="67" fill="${palette.bone}" stroke="${palette.gold}" stroke-width="15"/>
      <g transform="rotate(-28 300 390)"><rect x="210" y="210" width="180" height="370" rx="90" fill="${palette.crimsonLight}" stroke="${palette.ink}" stroke-width="20"/><path d="M210 395h180" stroke="${palette.gold}" stroke-width="15"/><ellipse cx="270" cy="320" rx="19" ry="11" fill="${palette.gold}"/><ellipse cx="330" cy="320" rx="19" ry="11" fill="${palette.gold}"/></g>
      <g transform="rotate(28 500 390)"><rect x="410" y="210" width="180" height="370" rx="90" fill="${palette.teal}" stroke="${palette.ink}" stroke-width="20"/><path d="M410 395h180" stroke="${palette.gold}" stroke-width="15"/><ellipse cx="470" cy="320" rx="19" ry="11" fill="${palette.gold}"/><ellipse cx="530" cy="320" rx="19" ry="11" fill="${palette.gold}"/></g>
      <path d="M315 190q85-70 170 0" fill="none" stroke="${palette.goldLight}" stroke-width="11" stroke-dasharray="12 18"/>`)
  },
  {
    file: 'assets/cards/black-bean-three-soils.svg', title: '黒豆と三色の土嚢',
    desc: '白い土、赤い土、灰色の土を入れた三つの小袋の前に、金色の芽を出しかけた黒豆が置かれている。',
    body: cardBase(`
      <g stroke="${palette.ink}" stroke-width="15"><path d="M130 360q75-118 150 0v218H130Z" fill="${palette.bone}"/><path d="M325 360q75-118 150 0v218H325Z" fill="${palette.crimsonLight}"/><path d="M520 360q75-118 150 0v218H520Z" fill="#77736c"/></g>
      <g fill="none" stroke="${palette.gold}" stroke-width="10"><path d="M170 410h70M365 410h70M560 410h70"/><path d="M180 485q25 22 50 0M375 485q25 22 50 0M570 485q25 22 50 0"/></g>
      <ellipse cx="400" cy="610" rx="94" ry="61" fill="${palette.ink}" stroke="${palette.gold}" stroke-width="14"/>
      <path d="M400 580q-5-138 106-180M423 501q-88 0-117-80" fill="none" stroke="${palette.gold}" stroke-width="17" stroke-linecap="round"/>
      <path d="M484 420q73-80 128-8q-63 72-128 8ZM326 441q-77-64-121 12q68 59 121-12Z" fill="${palette.teal}" stroke="${palette.ink}" stroke-width="13"/>`)
  },
  {
    file: 'assets/cards/stored-bread.svg', title: 'ひび割れた保存パン',
    desc: '焦茶の保存パンに深いひびが走り、割れ目から金色の麦粒とわずかな琥珀色の温かさがのぞく。',
    body: cardBase(`
      <ellipse cx="400" cy="607" rx="265" ry="70" fill="${palette.bone}" stroke="${palette.gold}" stroke-width="15"/>
      <path d="M172 530Q185 245 400 205Q615 245 628 530Q547 624 400 624Q253 624 172 530Z" fill="${palette.brownLight}" stroke="${palette.ink}" stroke-width="23"/>
      <path d="M213 472Q238 287 400 258Q562 287 587 472Q510 548 400 548Q290 548 213 472Z" fill="${palette.amber}" opacity=".65"/>
      <g fill="none" stroke="${palette.ink}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><path d="M287 268l36 91l-42 74l63 94"/><path d="M433 236l-29 98l59 82l-38 129"/><path d="M533 319l-50 55l61 97"/></g>
      <g fill="${palette.goldLight}"><ellipse cx="317" cy="356" rx="10" ry="20" transform="rotate(-22 317 356)"/><ellipse cx="455" cy="405" rx="10" ry="20" transform="rotate(25 455 405)"/><ellipse cx="359" cy="491" rx="9" ry="18" transform="rotate(-8 359 491)"/></g>
      <ellipse cx="342" cy="450" rx="20" ry="12" fill="${palette.gold}"/><ellipse cx="465" cy="466" rx="20" ry="12" fill="${palette.gold}"/><path d="M365 520q34 19 68-4" fill="none" stroke="${palette.crimson}" stroke-width="12" stroke-linecap="round"/>`)
  },
  {
    file: 'assets/cards/inverted-rain.svg', title: '空へ落ちる逆さ雨水',
    desc: '青緑の水滴が金縁の器から上空へ向かって落ち、器の水面には深紅の雲が逆さに映っている。',
    body: cardBase(`
      <path d="M145 475q24 210 255 210t255-210q-80 68-255 68t-255-68Z" fill="${palette.bone}" stroke="${palette.ink}" stroke-width="22"/><ellipse cx="400" cy="470" rx="255" ry="87" fill="${palette.teal}" stroke="${palette.gold}" stroke-width="18"/>
      <path d="M275 455q125-85 250 0q-125 76-250 0Z" fill="${palette.crimson}" stroke="${palette.ink}" stroke-width="12"/>
      <g fill="url(#foodCool)" stroke="${palette.goldLight}" stroke-width="9"><path d="M265 392C210 319 211 246 265 166c54 80 55 153 0 226Z"/><path d="M400 355C332 263 334 171 400 73c66 98 68 190 0 282Z"/><path d="M535 392C480 319 481 246 535 166c54 80 55 153 0 226Z"/></g>
      <path d="M400 395V122M265 425V215M535 425V215" stroke="${palette.gold}" stroke-width="8" stroke-dasharray="10 18" opacity=".65"/>
      <ellipse cx="355" cy="482" rx="19" ry="10" fill="${palette.gold}"/><ellipse cx="445" cy="482" rx="19" ry="10" fill="${palette.gold}"/>`)
  },
  {
    file: 'assets/cards/white-tablet.svg', title: '刻印のある白い錠剤',
    desc: '骨色の大きな白い錠剤に金の十字と小さな目が刻まれ、深紅の薬包紙の中央で静かに光る。',
    body: cardBase(`
      <path d="M145 205h510v390H145Z" fill="${palette.crimson}" stroke="${palette.ink}" stroke-width="20" transform="rotate(-6 400 400)"/><path d="M145 205l255 195l255-195M145 595l255-195l255 195" fill="none" stroke="${palette.gold}" stroke-width="12" opacity=".55"/>
      <circle cx="400" cy="400" r="190" fill="${palette.bone}" stroke="${palette.gold}" stroke-width="20"/>
      <path d="M400 250v300M250 400h300" stroke="${palette.gold}" stroke-width="18"/>
      <ellipse cx="335" cy="352" rx="24" ry="14" fill="${palette.ink}"/><ellipse cx="465" cy="352" rx="24" ry="14" fill="${palette.ink}"/><circle cx="343" cy="348" r="7" fill="${palette.goldLight}"/><circle cx="473" cy="348" r="7" fill="${palette.goldLight}"/>
      <path d="M350 470q50 35 100 0" fill="none" stroke="${palette.crimsonLight}" stroke-width="13" stroke-linecap="round"/>
      <g fill="${palette.goldLight}"><circle cx="235" cy="255" r="9"/><circle cx="575" cy="520" r="10"/><circle cx="210" cy="494" r="7"/></g>`)
  },
  {
    file: 'assets/cards/steam-soup.svg', title: '湯気だけを盛ったスープ',
    desc: '深紅の器は空なのに、金色と青緑の濃い湯気だけが料理の形をつくり、こちらへ香りを運んでくる。',
    body: cardBase(`
      <ellipse cx="400" cy="458" rx="255" ry="88" fill="${palette.night}" stroke="${palette.gold}" stroke-width="19"/><path d="M145 458q24 216 255 216t255-216q-75 83-255 83t-255-83Z" fill="${palette.crimson}" stroke="${palette.ink}" stroke-width="22"/>
      <ellipse cx="400" cy="458" rx="198" ry="54" fill="${palette.ink}" stroke="${palette.brownLight}" stroke-width="11"/>
      <g fill="none" stroke-linecap="round"><path d="M275 410Q155 294 274 148Q214 277 318 321Q370 343 330 415" stroke="${palette.gold}" stroke-width="27"/><path d="M398 408Q280 261 411 76Q340 233 455 293Q505 321 456 410" stroke="${palette.tealLight}" stroke-width="31"/><path d="M520 416Q650 300 536 158Q590 279 488 330Q446 353 482 414" stroke="${palette.goldLight}" stroke-width="24"/></g>
      <path d="M314 287q86-78 172 0q-86 56-172 0Z" fill="${palette.crimsonLight}" fill-opacity=".55"/>
      <ellipse cx="350" cy="565" rx="19" ry="11" fill="${palette.gold}"/><ellipse cx="450" cy="565" rx="19" ry="11" fill="${palette.gold}"/>`)
  },
  {
    file: 'assets/cards/bone-biscuit.svg', title: '骨型の保存ビスケット',
    desc: '骨の形に焼かれた焦茶のビスケットへ金色の塩粒と小さな歯形が付き、深紅の布の上に二本並ぶ。',
    body: cardBase(`
      <path d="M130 600Q400 672 670 600V270Q400 202 130 270Z" fill="${palette.crimson}" stroke="${palette.gold}" stroke-width="16"/>
      <g fill="${palette.brownLight}" stroke="${palette.ink}" stroke-width="20"><path d="M194 350c-66-75 37-146 96-83l220 220c63-59 134 44 59 96c75 52 4 155-59 96L290 459c-59 63-162-8-96-83c-72-53-3-126 0-26Z"/><path d="M246 540c-54-61 31-120 79-68l147-147c52-48 111 37 50 79c61 42 2 127-50 79L325 630c-48 52-133-7-79-68c-59-43-2-103 0-22Z" transform="translate(50 -62) scale(.82)"/></g>
      <g fill="${palette.goldLight}"><circle cx="295" cy="362" r="10"/><circle cx="380" cy="445" r="9"/><circle cx="482" cy="520" r="10"/><circle cx="350" cy="555" r="8"/></g>
      <path d="M520 316a39 39 0 0 0 45 61a37 37 0 0 0-2 56" fill="${palette.ink}"/>
      <ellipse cx="342" cy="430" rx="18" ry="10" fill="${palette.gold}"/><ellipse cx="440" cy="480" rx="18" ry="10" fill="${palette.gold}"/>`)
  },
  {
    file: 'assets/cards/ordinary-meal.svg', title: '完全に普通の焼き魚定食',
    desc: 'ご飯、味噌汁、焼き魚、漬物が異常なほど整然と金縁の膳に並び、普通であることだけが不気味な定食。',
    body: cardBase(`
      <rect x="105" y="205" width="590" height="420" rx="62" fill="${palette.brown}" stroke="${palette.gold}" stroke-width="19"/>
      <ellipse cx="415" cy="392" rx="170" ry="120" fill="${palette.bone}" stroke="${palette.ink}" stroke-width="16"/><path d="M282 403q133-164 266 0q-133 97-266 0Z" fill="${palette.crimson}" stroke="${palette.ink}" stroke-width="14"/><path d="M323 373q92-76 184 0" fill="none" stroke="${palette.gold}" stroke-width="15" stroke-linecap="round"/>
      <path d="M135 440h170q-6 136-85 136t-85-136Z" fill="${palette.night}" stroke="${palette.gold}" stroke-width="14"/><ellipse cx="220" cy="440" rx="85" ry="29" fill="${palette.crimson}" stroke="${palette.ink}" stroke-width="12"/>
      <path d="M520 474h145q-8 98-73 98t-72-98Z" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="14"/><ellipse cx="592" cy="474" rx="72" ry="23" fill="${palette.goldLight}" stroke="${palette.ink}" stroke-width="11"/>
      <g fill="${palette.ink}"><circle cx="390" cy="412" r="9"/><circle cx="440" cy="412" r="9"/></g><path d="M393 449q22 15 44 0" fill="none" stroke="${palette.gold}" stroke-width="8" stroke-linecap="round"/>`)
  },
  {
    file: 'assets/cards/salad.svg', title: '囁く森のサラダ',
    desc: '青緑と深紅の葉、金色の木の実、目の形の黒い種が白い器に盛られた、瑞々しく異様なサラダ。',
    body: cardBase(`
      <path d="M146 430q22 247 254 247t254-247q-88 72-254 72t-254-72Z" fill="${palette.bone}" stroke="${palette.ink}" stroke-width="21"/><ellipse cx="400" cy="425" rx="255" ry="91" fill="${palette.teal}" stroke="${palette.gold}" stroke-width="17"/>
      <g stroke="${palette.ink}" stroke-width="13"><path d="M230 445q35-203 175-61q-70 118-175 61Z" fill="${palette.tealLight}"/><path d="M365 425q62-205 183-29q-89 100-183 29Z" fill="${palette.crimsonLight}"/><path d="M430 458q127-138 176 40q-116 54-176-40Z" fill="${palette.gold}"/><path d="M194 493q115-120 174 32q-113 70-174-32Z" fill="${palette.crimson}"/></g>
      <g fill="${palette.ink}" stroke="${palette.gold}" stroke-width="5"><ellipse cx="312" cy="405" rx="22" ry="11"/><ellipse cx="470" cy="389" rx="22" ry="11"/><ellipse cx="530" cy="479" rx="22" ry="11"/></g>
      <g fill="${palette.goldLight}"><circle cx="347" cy="480" r="13"/><circle cx="432" cy="445" r="12"/><circle cx="280" cy="506" r="10"/></g>`)
  },
  {
    file: 'assets/cards/burnt-meat.svg', title: '焦げた獣肉の一皿',
    desc: '黒く焦げた厚い肉の切れ目から深紅の光と琥珀色の脂がにじみ、金縁の皿へ煙を立てる。',
    body: cardBase(`
      <ellipse cx="400" cy="590" rx="270" ry="79" fill="${palette.bone}" stroke="${palette.gold}" stroke-width="16"/>
      <path d="M167 499q43-226 233-267q190 41 233 267q-76 126-233 126T167 499Z" fill="${palette.ink}" stroke="${palette.crimson}" stroke-width="21"/>
      <path d="M228 491q55-154 172-181q117 27 172 181q-67 65-172 65t-172-65Z" fill="${palette.brownLight}"/>
      <g fill="none" stroke="${palette.ink}" stroke-width="17" stroke-linecap="round"><path d="M270 355l70 144"/><path d="M380 324l45 180"/><path d="M492 358l-22 143"/></g>
      <g fill="none" stroke="${palette.gold}" stroke-width="9"><path d="M286 396l38 78"/><path d="M403 356l22 94"/><path d="M510 392l-13 77"/></g>
      <g fill="none" stroke="${palette.bone}" stroke-opacity=".55" stroke-width="13" stroke-linecap="round"><path d="M300 250q-72-72 7-137"/><path d="M400 223q-62-89 18-153"/><path d="M500 250q72-72-7-137"/></g>`)
  },
  {
    file: 'assets/cards/empty-soup.svg', title: '背景を欠いた空のスープ',
    desc: '金縁の器の中だけが完全な黒に抜け落ち、小さな月と三本の湯気だけが残る空っぽのスープ。',
    body: cardBase(`
      <g fill="none" stroke="${palette.goldLight}" stroke-linecap="round" opacity=".7"><path d="M300 280q-68-80 8-156" stroke-width="15"/><path d="M400 259q-62-92 11-168" stroke-width="12"/><path d="M495 280q70-75 3-154" stroke-width="15"/></g>
      <ellipse cx="400" cy="390" rx="255" ry="91" fill="${palette.night}" stroke="${palette.gold}" stroke-width="19"/><path d="M145 390q22 274 255 274t255-274q-67 86-255 86t-255-86Z" fill="${palette.crimson}" stroke="${palette.ink}" stroke-width="22"/><ellipse cx="400" cy="390" rx="200" ry="57" fill="#000" stroke="${palette.brownLight}" stroke-width="11"/>
      <path d="M426 352a58 58 0 1 0 43 98a66 66 0 1 1-43-98Z" fill="${palette.gold}"/>
      <ellipse cx="335" cy="522" rx="18" ry="10" fill="${palette.gold}"/><ellipse cx="465" cy="522" rx="18" ry="10" fill="${palette.gold}"/><path d="M365 574q35-22 70 0" fill="none" stroke="${palette.night}" stroke-width="12" stroke-linecap="round"/>`)
  },
  {
    file: 'assets/cards/rotten-cake.svg', title: '崩れる契約の誕生日ケーキ',
    desc: '深紅の傾いたケーキに金の蝋燭が一本だけ灯り、黒い黴と崩れる契約印が祝い飾りのように並ぶ。',
    body: cardBase(`
      <g transform="rotate(5 400 450)"><path d="M220 355h360l68 258H152Z" fill="${palette.crimson}" stroke="${palette.ink}" stroke-width="22"/><ellipse cx="400" cy="355" rx="180" ry="70" fill="${palette.crimsonLight}" stroke="${palette.ink}" stroke-width="20"/><path d="M225 357q35 94 70 0q35 104 70 0q35 94 70 0q35 108 70 0q35 91 70 0" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="10"/>
      <g fill="${palette.ink}"><circle cx="284" cy="455" r="23"/><circle cx="487" cy="515" r="29"/><circle cx="365" cy="575" r="19"/></g><path d="M355 472l90 94M445 472l-90 94" stroke="${palette.gold}" stroke-width="11"/>
      <path d="M390 292V145" stroke="${palette.gold}" stroke-width="22"/><path d="M400 137c-55-43 4-88 19-122c36 70 27 108-19 122Z" fill="${palette.goldLight}" stroke="${palette.crimson}" stroke-width="10"/></g>`)
  },
  {
    file: 'assets/cards/full-heal-drop.svg', title: '全快ドロップ',
    desc: '金色の包み紙にくるまれ、琥珀色に光るドロップ飴「全快ドロップ」。',
    body: cardBase(`
      <g id="full-heal-drop-candy">
        <path d="M246 314L111 240l43 128l-62 83l145 28l42-68Z" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="20" stroke-linejoin="round"/><path d="M554 314l135-74l-43 128l62 83l-145 28l-42-68Z" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="20" stroke-linejoin="round"/>
        <path d="M223 287l63 54v126l-63 54M577 287l-63 54v126l63 54" fill="none" stroke="${palette.goldLight}" stroke-width="15" stroke-linecap="round"/>
        <rect x="245" y="248" width="310" height="312" rx="112" fill="url(#foodWarm)" stroke="${palette.gold}" stroke-width="24"/>
        <ellipse cx="400" cy="386" rx="105" ry="112" fill="${palette.goldLight}" opacity=".4"/><path d="M400 487C304 421 318 328 368 315c27-7 32 18 32 18s5-25 32-18c50 13 64 106-32 172Z" fill="${palette.crimsonLight}" stroke="${palette.ink}" stroke-width="15"/>
        <path d="M306 284q94-55 188 0" fill="none" stroke="${palette.goldLight}" stroke-width="19" stroke-linecap="round" opacity=".72"/>
      </g>
      <g fill="none" stroke="${palette.gold}" stroke-width="10"><circle cx="400" cy="404" r="258" stroke-dasharray="8 24"/><circle cx="400" cy="404" r="298" stroke-opacity=".42" stroke-dasharray="6 30"/></g>`)
  },
  {
    file: 'assets/cards/four-dishes.svg', title: '最後の晩餐の四皿',
    desc: '金の皿、深紅の皿、青緑の皿、黒い皿に異なる料理が盛られ、四つすべてが二段の食卓で選択を待つ。',
    body: cardBase(`
      <path d="M95 655h610" stroke="${palette.brownLight}" stroke-width="28" stroke-linecap="round"/>
      <g stroke="${palette.ink}" stroke-width="13">
        <g transform="translate(118 170)"><ellipse cx="125" cy="115" rx="120" ry="50" fill="${palette.gold}"/><path d="M125 35q-54 23-76 96q76 28 152 0q-22-73-76-96Z" fill="${palette.bone}"/><path d="M76 108h98l-5 47H81Z" fill="${palette.night}"/></g>
        <g transform="translate(432 170)"><ellipse cx="125" cy="115" rx="120" ry="50" fill="${palette.crimsonLight}"/><path d="M52 103q16-84 73-84t73 84q-73 35-146 0Z" fill="${palette.crimson}"/><path d="M104 102h42l12 57h-66Z" fill="${palette.bone}"/><circle cx="98" cy="70" r="8" fill="${palette.gold}"/><circle cx="150" cy="56" r="7" fill="${palette.gold}"/></g>
        <g transform="translate(118 430)"><ellipse cx="125" cy="115" rx="120" ry="50" fill="${palette.teal}"/><path d="M52 125q22-32 31-74q5-46 42-46t42 46q9 42 31 74q-73 42-146 0Z" fill="${palette.tealLight}"/><circle cx="102" cy="82" r="8" fill="${palette.gold}"/><circle cx="148" cy="102" r="9" fill="${palette.gold}"/></g>
        <g transform="translate(432 430)"><ellipse cx="125" cy="115" rx="120" ry="50" fill="${palette.ink}" stroke="${palette.gold}"/><path d="M65 120q9-45 34-82h52q25 37 34 82q-60 33-120 0Z" fill="${palette.charcoal}" stroke="${palette.gold}"/><path d="M93 67q32 26 64 0" fill="none" stroke="${palette.goldLight}" stroke-width="12" stroke-linecap="round"/></g>
      </g>
      <path d="M400 128v485M103 365h594" stroke="${palette.gold}" stroke-width="8" stroke-dasharray="12 20" opacity=".65"/>`)
  },
  {
    file: 'assets/cards/four-boxes.svg', title: '生存者の四つの箱',
    desc: '保存食の箱、生きている箱、空の箱、帰還の箱が二段の食卓に並び、金縁の蓋の隙間から異なる気配を漏らす。',
    body: cardBase(`
      <path d="M90 655h620" stroke="${palette.brownLight}" stroke-width="26" stroke-linecap="round"/>
      <g stroke="${palette.ink}" stroke-width="15" stroke-linejoin="round"><g transform="translate(110 155)"><path d="M0 85h250v205H0Z" fill="${palette.brownLight}"/><path d="M-18 85L24 18h202l42 67Z" fill="${palette.gold}"/><path d="M65 155h120v62H65Z" fill="${palette.bone}"/><path d="M95 186h60" stroke="${palette.crimson}" stroke-width="12" stroke-linecap="round"/></g><g transform="translate(440 155)"><path d="M0 85h250v205H0Z" fill="${palette.crimson}"/><path d="M-18 85L24 18h202l42 67Z" fill="${palette.crimsonLight}"/><path d="M72 160q53-70 106 0q-53 44-106 0Z" fill="${palette.ink}"/><circle cx="107" cy="151" r="7" fill="${palette.gold}"/><circle cx="143" cy="151" r="7" fill="${palette.gold}"/></g><g transform="translate(110 475)"><path d="M0 20h250v155H0Z" fill="${palette.charcoal}"/><path d="M-14 20L25-29h200l39 49Z" fill="#4d4e52"/><ellipse cx="125" cy="96" rx="62" ry="24" fill="${palette.ink}"/><path d="M104 96h42" stroke="${palette.gold}" stroke-width="11" stroke-linecap="round"/></g><g transform="translate(440 475)"><path d="M0 20h250v155H0Z" fill="${palette.brownLight}"/><path d="M-14 20L25-29h200l39 49Z" fill="${palette.gold}"/><path d="M125 48v100M75 98h100" stroke="${palette.teal}" stroke-width="17" stroke-linecap="round"/><path d="M125 48l-27 31M125 48l27 31" stroke="${palette.teal}" stroke-width="13"/></g></g>`)
  }
];

const allAssets = [
  ...backgrounds.map(asset => ({ ...asset, width: 1600, height: 900, defs: commonBackgroundDefs })),
  ...characters.map(asset => ({ ...asset, width: 800, height: 1200, defs: characterDefs, transparent: true })),
  ...cards.map(asset => ({ ...asset, width: 800, height: 800, defs: cardDefs }))
];

function assertAsset(asset, source) {
  const expectedViewBox = `viewBox="0 0 ${asset.width} ${asset.height}"`;
  if (!source.includes(`width="${asset.width}"`) || !source.includes(`height="${asset.height}"`) || !source.includes(expectedViewBox)) {
    throw new Error(`${asset.file}: generated dimensions are inconsistent.`);
  }
  if (!/[ぁ-んァ-ヶ一-龠]/u.test(asset.title) || !/[ぁ-んァ-ヶ一-龠]/u.test(asset.desc)) {
    throw new Error(`${asset.file}: title and desc must contain Japanese text.`);
  }
  if (/<(?:text|script|foreignObject|image|audio|video|font|font-face)\b/i.test(source)
    || /(?:href|xlink:href|src)\s*=\s*["'](?!#)/i.test(source)
    || /\son[a-z]+\s*=/i.test(source)) {
    throw new Error(`${asset.file}: generated SVG contains a forbidden dependency or active element.`);
  }
}

for (const asset of allAssets) {
  const path = resolve(root, asset.file);
  const source = xml(asset);
  assertAsset(asset, source);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, source, 'utf8');
}

const bytes = allAssets.reduce((sum, asset) => sum + Buffer.byteLength(xml(asset)), 0);
process.stdout.write(`Generated ${backgrounds.length} backgrounds, ${characters.length} characters, and ${cards.length} cards (${bytes} bytes).\n`);
