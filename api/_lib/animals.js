// Codename generator for anonymous chat visitors
// Deterministic: same visitorId always gets the same name

const COLORS = [
  'Серый', 'Белый', 'Рыжий', 'Золотой', 'Синий',
  'Алый', 'Бронзовый', 'Лунный', 'Огненный', 'Снежный',
  'Дымчатый', 'Янтарный', 'Изумрудный', 'Медный', 'Стальной',
  'Багровый', 'Ледяной', 'Песочный', 'Тёмный', 'Пёстрый',
];

const ANIMALS = [
  'Тигр', 'Волк', 'Ястреб', 'Кит', 'Лис',
  'Медведь', 'Орёл', 'Пантера', 'Сокол', 'Рысь',
  'Барсук', 'Олень', 'Ворон', 'Дельфин', 'Леопард',
  'Мустанг', 'Филин', 'Кобра', 'Лось', 'Цапля',
];

// Simple hash from string to number
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function generateCodename(visitorId) {
  const h = hash(visitorId || String(Date.now()));
  const color = COLORS[h % COLORS.length];
  const animal = ANIMALS[Math.floor(h / COLORS.length) % ANIMALS.length];
  return `${color} ${animal}`;
}

module.exports = { generateCodename };
