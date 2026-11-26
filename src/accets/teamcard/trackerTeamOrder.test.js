import { orderTrackerTeams } from "./trackerTeamOrder";

const today = "2026-10-06";
const streams = [
  { id: 1, name: "Старый", startDate: "2025-01-01", endDate: "2025-12-31" },
  { id: 2, name: "Текущий", startDate: "2026-09-01", endDate: "2026-12-31" },
  { id: 3, name: "Прошлый", startDate: "2026-01-01", endDate: "2026-06-30" },
];

const team = (id, name, averageGrade, stream) => ({
  id,
  name,
  averageGrade,
  streams: [{ name: stream }],
});

test("active stream is first; within each stream rating and Russian-before-Latin names determine order", () => {
  const cards = [
    team(1, "Beta", 5, "Текущий"),
    team(2, "Яблоко", 5, "Текущий"),
    team(3, "Альфа", 5, "Текущий"),
    team(4, "Высокий", 9, "Текущий"),
    team(5, "Прошлый лидер", 10, "Прошлый"),
    team(6, "Старый лидер", 11, "Старый"),
    team(7, "Alpha", 5, "Текущий"),
  ];

  const result = orderTrackerTeams(cards, streams, today);
  expect(result.activeStreamKey).toBe("2");
  expect(result.cards.map((card) => card.id)).toEqual([4, 3, 2, 7, 1, 5, 6]);
  expect(result.cards.filter((card) => card._streamKey === result.activeStreamKey).map((card) => card.id))
    .toEqual([4, 3, 2, 7, 1]);
});

test("the later ending active stream comes first even when it started earlier", () => {
  const overlapping = [
    ...streams,
    { id: 4, name: "Новый", startDate: "2026-08-01", endDate: "2027-01-31" },
  ];
  const result = orderTrackerTeams([
    team(1, "Высокий старого потока", 10, "Текущий"),
    team(2, "Новый поток", 1, "Новый"),
  ], overlapping, today);

  expect(result.activeStreamKey).toBe("4");
  expect(result.cards.map((card) => card.id)).toEqual([2, 1]);
});

test("inactive streams stay grouped by recency and use rating then Russian-before-Latin names", () => {
  const result = orderTrackerTeams([
    team(1, "Старый лидер", 100, "Старый"),
    team(2, "Beta", 8, "Прошлый"),
    team(3, "Зета", 8, "Прошлый"),
    team(4, "Низкий", 2, "Прошлый"),
    team(5, "Альфа", 8, "Прошлый"),
    team(6, "Текущая", 1, "Текущий"),
  ], streams, today);

  expect(result.cards.map((card) => card.id)).toEqual([6, 5, 3, 2, 4, 1]);
});

test("no expired stream is treated as active", () => {
  const result = orderTrackerTeams([team(1, "Команда", 5, "Старый")], streams, "2027-01-01");
  expect(result.activeStreamKey).toBeNull();
});

const overlappingStreams = [
  { id: "late", name: "Поздний", startDate: "2026-01-01", endDate: "2027-06-30" },
  { id: "early", name: "Ранний", startDate: "2026-09-01", endDate: "2026-12-31" },
];

const personalTeam = (id, name, grade, stream, passive = false) => ({
  ...team(id, name, grade, stream), passive,
});

test("all non-expelled active-stream teams precede expelled teams across streams", () => {
  const result = orderTrackerTeams([
    personalTeam("expelled-late", "Отчислена поздняя", 1, "Поздний", true),
    personalTeam("early", "Обычная ранняя", 0.9, "Ранний"),
    personalTeam("expelled-early", "Отчислена ранняя", 1, "Ранний", true),
    personalTeam("late", "Обычная поздняя", 0.1, "Поздний"),
  ], overlappingStreams, today);

  expect(result.cards.map(card => card.id)).toEqual([
    "late", "early", "expelled-late", "expelled-early",
  ]);
  expect(result.cards.every(card => card._streamActive)).toBe(true);
});

test("expelled teams use end date, rating, Cyrillic and then Latin alphabetical order", () => {
  const result = orderTrackerTeams([
    personalTeam("early", "Ранний лидер", 1, "Ранний", true),
    personalTeam("beta", "Beta", 0.9, "Поздний", true),
    personalTeam("low", "Альфа", 0.5, "Поздний", true),
    personalTeam("fir", "Ёлка", 0.9, "Поздний", true),
    personalTeam("alpha", "Alpha", 0.9, "Поздний", true),
    personalTeam("birch", "Берёза", 0.9, "Поздний", true),
    personalTeam("zenit", "Зенит", 0.6, "Поздний", true),
  ], overlappingStreams, today);

  expect(result.cards.map(card => card.id)).toEqual([
    "birch", "fir", "alpha", "beta", "zenit", "low", "early",
  ]);
});

test("equal end dates are resolved by team rating and name before stream names or ids", () => {
  const catalog = [
    { id: "a", name: "А поток", startDate: "2026-09-01", endDate: "2027-01-31" },
    { id: "z", name: "Я поток", startDate: "2026-01-01", endDate: "2027-01-31" },
  ];
  const result = orderTrackerTeams([
    personalTeam("low", "Альфа", 0.1, "А поток", true),
    personalTeam("high", "Яблоко", 0.9, "Я поток", true),
    personalTeam("latin", "Alpha", 0.5, "А поток", true),
    personalTeam("russian", "Берёза", 0.5, "Я поток", true),
  ], catalog, today);

  expect(result.cards.map(card => card.id)).toEqual(["high", "russian", "latin", "low"]);
});

test("null passive is eligible, complete ties use team id and input is not mutated", () => {
  const first = Object.freeze(personalTeam("b", "Команда", null, "Поздний", null));
  const second = Object.freeze(personalTeam("a", "Команда", 0, "Поздний"));
  const expelled = Object.freeze(personalTeam("c", "Команда", 1, "Поздний", true));
  const cards = Object.freeze([expelled, first, second]);
  const result = orderTrackerTeams(cards, overlappingStreams, today);

  expect(result.cards.map(card => card.id)).toEqual(["a", "b", "c"]);
  expect(cards.map(card => card.id)).toEqual(["c", "b", "a"]);
  expect(first).not.toHaveProperty("_streamActive");
});

test("expelled active-stream teams stay before archived teams and pick their active stream", () => {
  const legacy = personalTeam("legacy", "Отчислена", 0.1, "Старый", true);
  legacy.streams.push({ name: "Ранний" }, { name: "Поздний" });
  const result = orderTrackerTeams([
    team("archive", "Архивный лидер", 1, "Старый"), legacy,
  ], [...streams, ...overlappingStreams], today);

  expect(result.cards.map(card => card.id)).toEqual(["legacy", "archive"]);
  expect(result.cards[0]).toMatchObject({
    _streamKey: "late", _streamActive: true, _primaryStream: { name: "Поздний" },
  });
  expect(result.cards[1]._streamActive).toBe(false);
});

test("legacy cards with only inactive streams keep the existing choice by start date", () => {
  const inactive = [
    { id: "long", name: "Длинный", startDate: "2024-01-01", endDate: "2025-12-31" },
    { id: "recent", name: "Недавний", startDate: "2025-01-01", endDate: "2025-06-30" },
  ];
  const legacy = team("legacy", "Архивная", 1, "Длинный");
  legacy.streams.push({ name: "Недавний" });

  expect(orderTrackerTeams([legacy], inactive, today).cards[0])
    .toMatchObject({ _streamActive: false, _primaryStream: { id: "recent" } });
});
