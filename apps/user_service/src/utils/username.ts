export function generateUniqueUsername(): string {
  const adjectives = [
    "brave",
    "curious",
    "silent",
    "mighty",
    "cosmic",
    "happy",
    "dark",
    "swift",
    "shiny",
    "frozen",
    "wild",
    "lucky",
  ];

  const colors = [
    "red",
    "blue",
    "green",
    "black",
    "white",
    "silver",
    "golden",
    "purple",
    "crimson",
    "aqua",
    "navy",
    "emerald",
  ];

  const animals = [
    "tiger",
    "lion",
    "wolf",
    "panda",
    "falcon",
    "eagle",
    "otter",
    "dragon",
    "phoenix",
    "shark",
    "bear",
    "whale",
  ];

  const tech = [
    "coder",
    "hacker",
    "ninja",
    "bot",
    "dev",
    "pixel",
    "stack",
    "server",
    "cloud",
    "byte",
    "script",
    "data",
  ];

  const verbs = [
    "runner",
    "seeker",
    "builder",
    "dreamer",
    "explorer",
    "guardian",
    "hunter",
    "wanderer",
    "flyer",
    "smasher",
  ];

  const fantasy = [
    "wizard",
    "knight",
    "elf",
    "orc",
    "demon",
    "paladin",
    "ranger",
    "warlock",
    "monk",
    "samurai",
    "viking",
  ];

  // helper: random pick
  function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // helper: random number
  function randNum() {
    return Math.floor(Math.random() * 900 + 100); // 100–999
  }

  // helper: unique suffix
  function uniqueSuffix() {
    return (Date.now().toString(36) + randNum().toString()).slice(-6);
  }

 const patterns = [
  () => `${pickRandom(adjectives)}_${uniqueSuffix()}`,
  () => `${pickRandom(verbs)}_${uniqueSuffix()}`,
  () => `${pickRandom(colors)}_${uniqueSuffix()}`,
  () => `${pickRandom(animals)}_${uniqueSuffix()}`,
  () => `${pickRandom(tech)}_${uniqueSuffix()}`,
  () => `${pickRandom(fantasy)}_${uniqueSuffix()}`,
];
  return pickRandom(patterns)();
}
