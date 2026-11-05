import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useSelector } from "react-redux";
import TrackerPage from "./TrackerPage";

jest.mock("react-redux", () => ({ useSelector: jest.fn() }));
jest.mock("../header/header", () => () => <div>Header</div>);
jest.mock("../../utils/csrf-utils", () => ({ getCsrfConfigForFetch: () => ({}) }));

const streams = [
    { id: "recent", name: "Поток 3", startDate: "2025-01-01", endDate: "2026-12-30" },
    { id: "earlier", name: "Поток 2", startDate: "2026-01-01", endDate: "2026-06-30" },
];
const team = (id, name, averageGrade, stream = streams[0]) => ({
    id, name, averageGrade, enabled: true, description: "", streams: [stream],
});
const example = [
    { ...team("birch", "Берёза", 0.9), passive: true },
    team("vega", "Вега", 0.9),
    team("alpha", "Alpha", 0.9),
    team("zenit", "Зенит", 0.75),
    team("omega", "Омега", 0.95, streams[1]),
];

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

const response = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

const renderList = (role, getPage, totalPages) => {
    const user = { username: "admin", roles: [role] };
    useSelector.mockReturnValue({ user });
    global.fetch = jest.fn((url) => {
        const parsed = new URL(url);
        if (parsed.pathname.endsWith("/admin/team-cards")) {
            return response({
                content: getPage(Number(parsed.searchParams.get("page"))),
                page: { totalPages },
            });
        }
        if (parsed.pathname.endsWith("/admin/streams")) return response({ content: streams });
        if (parsed.pathname.endsWith("/image")) {
            return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) });
        }
        return response({ content: [] });
    });
    return render(<MemoryRouter initialEntries={["/all-team-cards"]}>
        <TrackerPage showAllCards />
    </MemoryRouter>);
};

const renderedIds = (container) => Array.from(container.querySelectorAll("[data-card-id]"))
    .map((card) => card.getAttribute("data-card-id"));

const teamRequests = () => global.fetch.mock.calls.filter(([url]) =>
    new URL(url).pathname.endsWith("/admin/team-cards"));

test.each(["ADMIN", "SUPER_ADMIN"])("%s preserves global stream order across backend pages", async (role) => {
    const { container } = renderList(role,
        (page) => page === 0 ? example.slice(0, 3) : example.slice(3), 2);

    await screen.findByText("Берёза");
    expect(renderedIds(container)).toEqual(["birch", "vega", "alpha"]);
    expect(teamRequests().every(([url]) => new URL(url).searchParams.get("page") === "0")).toBe(true);
    for (const [url] of teamRequests()) {
        expect(new URL(url).searchParams.getAll("sort")).toEqual(["streamEndDate,desc"]);
        expect(new URL(url).searchParams.get("size")).toBe("18");
    }

    fireEvent.click(container.querySelector(".Stream-footer-button-4"));

    await screen.findByText("Зенит");
    expect(renderedIds(container)).toEqual(["zenit", "omega"]);
    expect(teamRequests().some(([url]) => new URL(url).searchParams.get("page") === "1")).toBe(true);
    expect(screen.queryByText("Берёза")).not.toBeInTheDocument();

    fireEvent.click(container.querySelector(".Stream-footer-button-2"));
    await screen.findByText("Берёза");
    expect(renderedIds(container)).toEqual(["birch", "vega", "alpha"]);
});

test.each(["ADMIN", "SUPER_ADMIN"])("%s keeps refreshed rating order from the server", async (role) => {
    let cards = example;
    const { container } = renderList(role, () => cards, 1);
    await screen.findByText("Берёза");
    expect(renderedIds(container)).toEqual(["birch", "vega", "alpha", "zenit", "omega"]);

    cards = [{ ...example[3], averageGrade: 0.99 }, ...example.slice(0, 3), example[4]];
    fireEvent(document, new Event("visibilitychange"));

    await waitFor(() => expect(renderedIds(container))
        .toEqual(["zenit", "birch", "vega", "alpha", "omega"]));
    expect(teamRequests().every(([url]) =>
        new URL(url).searchParams.getAll("sort").join() === "streamEndDate,desc")).toBe(true);
});

test("a legacy team displays the same primary stream used for grouping", async () => {
    const legacy = { ...team("legacy", "Старая карточка", 0.9), streams: [streams[1], streams[0]] };
    renderList("ADMIN", () => [legacy], 1);

    await screen.findByText("Старая карточка");

    expect(screen.getByText(/Поток: Поток 3: 2025-01-01 - 2026-12-30/)).toBeInTheDocument();
});
