import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import WeeklyTeamReports from "./WeeklyTeamReports";

const lowGrade = "Скачать список с низким рейтингом";
const missedMeetings = "Скачать список с пропущенными встречами";
const originalFetch = global.fetch;
const createObjectURL = URL.createObjectURL;
const revokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  global.fetch = jest.fn();
  URL.createObjectURL = jest.fn(() => "blob:weekly-report");
  URL.revokeObjectURL = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  jest.restoreAllMocks();
  jest.useRealTimers();
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
  expect(URL.createObjectURL).not.toHaveBeenCalled();
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

test("downloads the CSV for the selected week and releases its URL", async () => {
  jest.useFakeTimers();
  const file = new Blob(["Команда;Поток"], { type: "text/csv" });
  global.fetch.mockResolvedValue({
    status: 200,
    ok: true,
    headers: new Headers({ "Content-Type": "text/csv; charset=UTF-8" }),
    blob: async () => file,
  });
  const onDownload = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
    onDownload(this.download, this.getAttribute("href"));
  });
  render(<WeeklyTeamReports />);

  fireEvent.change(screen.getByRole("combobox", { name: "Период" }), { target: { value: "PREVIOUS" } });
  fireEvent.click(screen.getByRole("button", { name: missedMeetings }));

  await waitFor(() => expect(onDownload).toHaveBeenCalledWith("missed-meetings-previous.csv", "blob:weekly-report"));
  expect(URL.createObjectURL).toHaveBeenCalledWith(file);
  expect(document.querySelector('a[download]')).toBeNull();
  jest.advanceTimersByTime(1000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:weekly-report");
});

test("does not download a CSV with no bytes", async () => {
  global.fetch.mockResolvedValue({
    status: 200,
    ok: true,
    headers: new Headers({ "Content-Type": "text/csv" }),
    blob: async () => new Blob(),
  });
  render(<WeeklyTeamReports />);
  fireEvent.click(screen.getByRole("button", { name: lowGrade }));

  expect(await screen.findByText("За выбранную неделю список пуст.")).toBeInTheDocument();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test("shows an error on a failed request and lets the user retry", async () => {
  global.fetch.mockRejectedValue(new Error("offline"));
  render(<WeeklyTeamReports />);
  fireEvent.click(screen.getByRole("button", { name: lowGrade }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось скачать отчёт");
  expect(screen.getByRole("button", { name: lowGrade })).toBeEnabled();
});

test("does not download an HTML response from the login page", async () => {
  global.fetch.mockResolvedValue({
    status: 200,
    ok: true,
    headers: new Headers({ "Content-Type": "text/html" }),
  });
  render(<WeeklyTeamReports />);
  fireEvent.click(screen.getByRole("button", { name: lowGrade }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось скачать отчёт");
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
