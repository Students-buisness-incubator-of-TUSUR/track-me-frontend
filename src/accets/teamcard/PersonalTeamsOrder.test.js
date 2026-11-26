import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useSelector } from "react-redux";
import TrackerPage from "./TrackerPage";

jest.mock("react-redux", () => ({ useSelector: jest.fn() }));
jest.mock("../header/header", () => () => <div>Header</div>);
jest.mock("../../utils/csrf-utils", () => ({ getCsrfConfigForFetch: () => ({}) }));

const year = new Date().getFullYear();
const streams = [
  { id: "late", name: "Поздний поток", startDate: `${year - 2}-01-01`, endDate: `${year + 2}-12-31` },
  { id: "early", name: "Ранний поток", startDate: `${year - 1}-01-01`, endDate: `${year + 1}-06-30` },
  { id: "old", name: "Архивный поток", startDate: `${year - 4}-01-01`, endDate: `${year - 3}-12-31` },
];
const roles = ["TRACKER", "ADMIN", "SUPER_ADMIN"];
const team = (id, name, averageGrade, stream = streams[0], passive = false) => ({
  id, name, averageGrade, passive, streams: [stream],
  enabled: true, description: "", username: "owner",
});
const response = body => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  window.scrollTo = jest.fn();
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  URL.createObjectURL = jest.fn(() => "blob:stream");
  URL.revokeObjectURL = jest.fn();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

const renderPersonalList = (role, getPage, totalPages = 1) => {
  useSelector.mockReturnValue({ user: { username: "owner", roles: [role] } });
  global.fetch = jest.fn((url, options) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/team-cards")) {
      const filters = JSON.parse(options.body).filters;
      expect(filters).toContainEqual({ fieldName: "username", type: "EQ", value: "owner" });
      expect(filters.some(filter => filter.fieldName === "streams.name")).toBe(false);
      return response({
        content: getPage(Number(parsed.searchParams.get("page"))), page: { totalPages },
      });
    }
    if (parsed.pathname.endsWith("/streams")) return response({ content: streams });
    if (parsed.pathname.endsWith("/image")) {
      return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) });
    }
    return response([]);
  });
  const route = role === "TRACKER" ? "/team-cards" : "/all-team-cards?username=owner";
  return render(<MemoryRouter initialEntries={[route]}>
    <TrackerPage showAllCards={role !== "TRACKER"} />
  </MemoryRouter>);
};

const renderedIds = container => Array.from(container.querySelectorAll("[data-card-id]"))
  .map(card => card.getAttribute("data-card-id"));

test.each(roles)("%s puts expelled teams after every eligible active-stream team", async role => {
  const cards = [
    team("expelled-early", "Отчисленный лидер", 1, streams[1], true),
    team("beta", "Beta", 0.9, streams[0], true),
    team("early", "Обычная ранняя", 0.99, streams[1]),
    team("fir", "Ёлка", 0.9, streams[0], true),
    team("late", "Обычная поздняя", 0.1),
    team("alpha", "Alpha", 0.9, streams[0], true),
    team("birch", "Берёза", 0.9, streams[0], true),
    team("low", "Альфа", 0.5, streams[0], true),
    team("archive", "Архивная", 1, streams[2]),
  ];
  const expected = ["late", "early", "birch", "fir", "alpha", "beta", "low", "expelled-early"];
  const { container } = renderPersonalList(role, () => cards);

  await screen.findByText("Обычная ранняя");
  expect(renderedIds(container)).toEqual(expected);
  expect(screen.queryByText("Архивная")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("switch", { name: "Показать команды неактивных потоков" }));
  expect(renderedIds(container)).toEqual([...expected, "archive"]);
});

test.each(roles)("%s reorders teams after expulsion, restoration and rating refresh", async role => {
  let cards = [team("first", "Первая", 0.9), team("second", "Вторая", 0.4),
    team("early", "Ранний лидер", 1, streams[1])];
  const { container } = renderPersonalList(role, () => cards);
  await screen.findByText("Ранний лидер");
  expect(renderedIds(container)).toEqual(["first", "second", "early"]);

  cards = cards.map(card => card.id === "first" ? { ...card, passive: true } : card);
  fireEvent(document, new Event("visibilitychange"));
  await waitFor(() => expect(renderedIds(container)).toEqual(["second", "early", "first"]));

  cards = cards.map(card => card.id === "first" ? { ...card, passive: false, averageGrade: 0.1 } : card);
  fireEvent(document, new Event("visibilitychange"));
  await waitFor(() => expect(renderedIds(container)).toEqual(["second", "first", "early"]));
});

test.each(roles)("%s sorts all backend pages before paginating the personal list", async role => {
  const eligible = Array.from({ length: 99 }, (_, index) =>
    team(`eligible-${index}`, `Команда ${index}`, 0.8 - index / 1000));
  const expelled = team("expelled", "Отчисленная", 1, streams[0], true);
  const lastBackendTeam = team("last-backend", "Последняя серверная", 0.9);
  const pages = [[expelled, ...eligible], [lastBackendTeam]];
  const expected = [lastBackendTeam.id, ...eligible.map(card => card.id), expelled.id];
  const { container } = renderPersonalList(role, page => pages[page], 2);

  for (let page = 0; page < 6; page++) {
    if (page > 0) fireEvent.click(container.querySelector(".Stream-footer-button-4"));
    await waitFor(() => expect(renderedIds(container)).toEqual(expected.slice(page * 18, (page + 1) * 18)));
  }
  const requests = global.fetch.mock.calls.filter(([url]) => new URL(url).pathname.endsWith("/team-cards"));
  expect(requests.some(([url]) => new URL(url).searchParams.get("page") === "1")).toBe(true);
  expect(requests.every(([url]) => new URL(url).searchParams.get("size") === "100")).toBe(true);
});

test("a legacy personal card displays the active stream used for its ordering", async () => {
  const legacy = { ...team("legacy", "Старая карточка", 0.9), streams: [streams[2], streams[0]] };
  renderPersonalList("TRACKER", () => [legacy]);

  await screen.findByText("Старая карточка");
  expect(screen.getByText(new RegExp(`Поток: Поздний поток: ${streams[0].startDate}`))).toBeInTheDocument();
});
