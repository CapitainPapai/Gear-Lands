const branchInfo = [
  { id: 'body', name: 'Корпус', subtitle: 'ВЫЖИВАНИЕ', icon: 'shield', x: 110 },
  { id: 'blade', name: 'Клинок', subtitle: 'РАЗРУШЕНИЕ', icon: 'swords', x: 290 },
  { id: 'mech', name: 'Механизмы', subtitle: 'ДВИЖЕНИЕ', icon: 'cog', x: 470 },
  { id: 'soul', name: 'Искра', subtitle: 'ЭНЕРГИЯ', icon: 'flame', x: 650 },
];
// Each branch has two interleaved paths, six tiers deep. All bonuses affect simulation.
const definitions = {
  body: [
    ['Титановая пластина','Даже сломанный механизм можно укрепить.','+1 ячейка здоровья','heart',{ hp: 1 }],
    ['Живая ткань','Синтетические волокна сшивают раны.','+1 ячейка здоровья','heart',{ hp: 1 }],
    ['Медная броня','Старые пластины защищают лучше, чем кажется.','Входящий урон −8%','shield',{ armor: .08 }],
    ['Стальное сердце','В груди снова звучит ровный ритм.','+1 ячейка здоровья','heart',{ hp: 1 }],
    ['Саморемонт','Микромашины восстанавливают повреждённые цепи.','Починка лечит на 1 сердце больше','wrench',{ healAmount: 1 }],
    ['Запас прочности','Резервный контур принимает удар на себя.','Входящий урон −8%','shield',{ armor: .08 }],
    ['Шипованный корпус','Обломки становятся оружием.','Атакующий враг получает 8 урона','sparkles',{ thorns: 8 }],
    ['Экономный контур','Ни капли давления не пропадает даром.','Починка стоит на 5 пара меньше','zap',{ healCost: -5 }],
    ['Второй шанс','Последний резервный конденсатор.','+2 ячейки здоровья','heart',{ hp: 2 }],
    ['Непробиваемый','Твоё тело крепче имперской стали.','Входящий урон −10%','shield',{ armor: .10 }],
    ['Кровь и масло','Каждый удар возвращает часть энергии.','+3 пара за попадание','droplets',{ energyOnHit: 3 }],
    ['Несокрушимый','Ты больше не груда бесполезного металла.','+2 ячейки здоровья, броня +8%','shield',{ hp: 2, armor: .08 }],
  ],
  blade: [
    ['Заточка','Острый край пробуждает память мышц.','Урон клинка +3','swords',{ damage: 3 }],
    ['Длинный клинок','Перекованная рукоять увеличивает досягаемость.','Дальность удара +14','move-horizontal',{ range: 14 }],
    ['Точный привод','Сервоприводы больше не дрожат.','Урон клинка +3','swords',{ damage: 3 }],
    ['Уязвимые сочленения','Ты видишь слабое место каждого механизма.','Шанс критического удара +10%','target',{ crit: .10 }],
    ['Быстрый маховик','Сброс инерции ускоряет следующий выпад.','Перезарядка удара −15%','wind',{ attackCooldown: -.15 }],
    ['Рассекающий пар','Воздух под давлением продолжает удар.','Удар выпускает режущую волну','waves',{ slashWave: 1 }],
    ['Вольфрамовая кромка','Лезвие режет даже закалённую сталь.','Урон клинка +5','swords',{ damage: 5 }],
    ['Безупречный ритм','Движения сливаются в единый механизм.','Шанс критического удара +12%','target',{ crit: .12 }],
    ['Падающая звезда','Направь массу своего тела вниз.','S в воздухе: удар о землю за 18 пара','arrow-down-to-line',{ slam: 1 }],
    ['Палач','Приговор вынесен самой конструкцией.','Урон клинка +7','swords',{ damage: 7 }],
    ['Последний штрих','Добей тех, кто уже дал трещину.','+35% урона врагам ниже 30% здоровья','crosshair',{ execute: .35 }],
    ['Клинок рассвета','Этот клинок положит конец империи.','Урон клинка +10','swords',{ damage: 10 }],
  ],
  mech: [
    ['Паровой поршень','Давление вырывается из повреждённого привода.','K: рывок сквозь атаки. Стоит 8 пара','wind',{ dash: 1 }],
    ['Пружинные ноги','В коленных суставах сохранилась сила.','Прыжок в воздухе после первого','chevrons-up',{ doubleJump: 1 }],
    ['Резервный бак','Медный резервуар вмещает больше давления.','Максимум пара +15','zap',{ energy: 15 }],
    ['Сжатый пар','Выпусти давление прямо в противника.','L: паровой заряд. Стоит 12 пара','flame',{ bolt: 1 }],
    ['Облегчённые клапаны','Сброс давления больше не тормозит движение.','Перезарядка рывка −25%','wind',{ dashCooldown: -.25 }],
    ['Точная настройка','Управляй телом даже в свободном падении.','Ускорение в воздухе +35%','move-horizontal',{ airControl: .35 }],
    ['Инерционный удар','Масса, умноженная на скорость.','Рывок наносит 16 урона врагам','swords',{ dashDamage: 16 }],
    ['Турбонаддув','Перегретый пар пробивает броню.','Урон парового заряда +12','flame',{ boltDamage: 12 }],
    ['Магнитные захваты','Притягивайся к железным стенам.','Прыжок от стен; замедленное скольжение','magnet',{ wallJump: 1 }],
    ['Тихий компрессор','Механизмы учатся беречь давление.','Восстановление пара +2 / сек','zap',{ energyRegen: 2 }],
    ['Реактивное сердце','Последний запрет императора снят.','Третий прыжок и реактивное парение','rocket',{ flight: 1 }],
    ['Абсолютный привод','Все системы работают как одно целое.','Урон +5, максимум пара +25','cog',{ damage: 5, energy: 25 }],
  ],
  soul: [
    ['Память обломков','Каждый враг оставляет урок.','Опыт за врагов +15%','book-open',{ xp: .15 }],
    ['Собиратель','Твоё магнитное поле притягивает ценности.','Радиус сбора шестерён +70','magnet',{ pickup: 70 }],
    ['Искра жизни','В металле осталось нечто человеческое.','Максимум пара +10','flame',{ energy: 10 }],
    ['Ценный лом','Ничто не должно пропасть.','Шестерён с врагов +20%','cog',{ gears: .20 }],
    ['Тёплый реактор','Маленькое солнце внутри холодного тела.','Восстановление пара +1,5 / сек','zap',{ energyRegen: 1.5 }],
    ['Быстрая искра','Мысль движется быстрее шестерён.','Перезарядка парового заряда −25%','flame',{ boltCooldown: -.25 }],
    ['Родственная душа','Освободи энергию сломанных механизмов.','+8 пара при победе над врагом','sparkles',{ energyOnKill: 8 }],
    ['Прозрение','Ты помнишь то, чего никогда не видел.','Опыт за врагов +20%','book-open',{ xp: .20 }],
    ['Резонанс','Удары заставляют реактор петь.','Шанс критического удара +8%','target',{ crit: .08 }],
    ['Вечный двигатель','Капля давления запускает целый мир.','Восстановление пара +2 / сек','zap',{ energyRegen: 2 }],
    ['Человечность','То, что император не смог отнять.','+1 здоровье; опыт +15%','heart',{ hp: 1, xp: .15 }],
    ['Перерождение','Не механизм. Не человек. Нечто большее.','+2 здоровья, урон +5, пар +20','sparkles',{ hp: 2, damage: 5, energy: 20 }],
  ],
};
const iconOverrides = ['heart','heart','shield','heart','wrench','shield','sparkles','zap','heart','shield','droplets','shield'];
export const BRANCHES = branchInfo;
export const SKILLS = branchInfo.flatMap((branch, b) => definitions[branch.id].map((d, i) => {
  const tier = Math.floor(i / 2);
  const side = i % 2;
  const previous = i < 2 ? null : `${branch.id}-${i - 2 + (tier === 3 && side === 1 ? 1 : tier === 3 && side === 0 ? -1 : 0)}`;
  return {
    id: `${branch.id}-${i}`, branch: branch.id, name: d[0],
    lore: d[1], description: d[2], icon: b === 0 ? iconOverrides[i] : d[3], effect: d[4],
    cost: tier < 3 ? 1 : tier < 5 ? 2 : 3, tier, requires: previous ? [previous] : [],
    x: branch.x + (side ? 40 : -40), y: 708 - tier * 116, root: i < 2,
  };
}));
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]));
export const CORE_SKILLS = { dash: 'mech-0', doubleJump: 'mech-1', wallJump: 'mech-8', flight: 'mech-10' };
export function computeStats(learned = [], upgrades = { hp: 0, damage: 0, energy: 0 }) {
  const stats = { hp: 5 + upgrades.hp, damage: 14 + upgrades.damage * 3, energy: 60 + upgrades.energy * 10, armor: 0, healAmount: 2, healCost: 25, thorns: 0, energyOnHit: 0, range: 83, crit: .05, attackCooldown: 0, slashWave: 0, slam: 0, execute: 0, dash: 0, doubleJump: 0, energyRegen: 4.5, dashCooldown: 0, airControl: 0, dashDamage: 0, bolt: 0, boltDamage: 0, wallJump: 0, flight: 0, xp: 0, gears: 0, pickup: 100, energyOnKill: 0, boltCooldown: 0 };
  for (const id of learned) {
    const skill = SKILL_BY_ID[id];
    if (!skill) continue;
    for (const [key, value] of Object.entries(skill.effect)) stats[key] = (stats[key] || 0) + value;
  }
  stats.armor = Math.min(.5, stats.armor);
  stats.attackCooldown = Math.max(.18, .34 * (1 + stats.attackCooldown));
  stats.dashCooldown = Math.max(.3, .85 * (1 + stats.dashCooldown));
  stats.boltCooldown = Math.max(.25, .7 * (1 + stats.boltCooldown));
  stats.healCost = Math.max(10, stats.healCost);
  stats.maxJumps = 1 + (stats.doubleJump ? 1 : 0) + (stats.flight ? 1 : 0);
  return stats;
}
export function canLearn(skill, learned, points) {
  return !learned.includes(skill.id) && points >= skill.cost && skill.requires.every(id => learned.includes(id));
}
