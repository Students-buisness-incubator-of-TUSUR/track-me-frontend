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

test("most recent of simultaneous active streams comes first", () => {
  const overlapping = [
    ...streams,
    { id: 4, name: "Новый", startDate: "2026-10-01", endDate: "2026-12-31" },
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
