import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import WeeklyTeamReports from "./WeeklyTeamReports";

const lowGrade = "Скачать список с низким рейтингом";
const missedMeetings = "Скачать список с пропущенными встречами";
const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

test("requests the current week by default and handles an empty list", async () => {
  global.fetch.mockResolvedValue({ status: 204 });
  render(<WeeklyTeamReports />);

  fireEvent.click(screen.getByRole("button", { name: lowGrade }));
  expect(screen.getByText("Формируем отчёт…")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: missedMeetings })).toBeDisabled();
  expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/low-grade\?period=CURRENT$/),
    expect.objectContaining({ credentials: "include" }));
  expect(await screen.findByText("За выбранную неделю список пуст.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: missedMeetings })).toBeEnabled();
});

test.each([
  [404, "Отчёт за прошлую неделю ещё не сохранён."],
  [502, "Не удалось скачать отчёт. Попробуйте ещё раз."],
])("reports backend status %s when requesting the previous week", async (status, message) => {
  global.fetch.mockResolvedValue({ status, ok: false });
  render(<WeeklyTeamReports />);

  fireEvent.change(screen.getByRole("combobox", { name: "Период" }), { target: { value: "PREVIOUS" } });
  fireEvent.click(screen.getByRole("button", { name: missedMeetings }));

  expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/missed-meetings\?period=PREVIOUS$/),
    expect.any(Object));
  expect(await screen.findByText(message)).toBeInTheDocument();
});
