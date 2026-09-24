import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import TrackerMeetingReportPage from "./TrackerMeetingReportPage";
import {
  fetchMyTrackerMeetingReport,
  fetchMyTrackerMeetingReportExcel,
} from "../../services/requests";

jest.mock("../../services/requests", () => ({
  fetchMyTrackerMeetingReport: jest.fn(),
  fetchMyTrackerMeetingReportExcel: jest.fn(),
}));

jest.mock("../../services/util", () => ({
  useGetUserInfo: () => ({ roles: ["TRACKER"] }),
}));

jest.mock("../header/header", () => () => <header>Header</header>);

describe("TrackerMeetingReportPage", () => {
  const report = {
    teamId: "team-1",
    teamName: "Команда А",
    startDate: "2026-09-17T10:00:00Z",
    tasksCurrentMeeting: "Выполненная задача",
    tasksNextMeeting: "Задача на следующую встречу",
    teamStatus: "OK",
    status: "COMPLETED",
  };

  const successfulResponse = (content) => ({
    ok: true,
    json: () => Promise.resolve({ content }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMyTrackerMeetingReport.mockResolvedValue(successfulResponse([report]));
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <TrackerMeetingReportPage />
      </MemoryRouter>
    );
  }

  test("uses the tracker-scoped endpoint and renders no tracker filter or column", async () => {
    renderPage();

    expect(await screen.findByText("Команда А")).toBeInTheDocument();
    expect(fetchMyTrackerMeetingReport).toHaveBeenCalledWith(expect.objectContaining({
      page: 0,
      size: 10000,
      filters: [],
    }));
    expect(screen.queryByText("Трекер")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Поиск по имени или логину...")).not.toBeInTheDocument();
  });

  test("matches task values with their columns", async () => {
    const { container } = renderPage();

    await screen.findByText("Выполненная задача");
    const cells = container.querySelectorAll("tbody tr td");

    expect(screen.getByText("Выполнение задач / инфо по команде")).toBeInTheDocument();
    expect(screen.getByText("Задачи к следующей встрече")).toBeInTheDocument();
    expect(cells[3]).toHaveTextContent("Выполненная задача");
    expect(cells[4]).toHaveTextContent("Задача на следующую встречу");
  });

  test("creates filters for a selected team and completed team status", async () => {
    renderPage();
    await screen.findByText("Команда А");

    fireEvent.click(screen.getByRole("button", { name: "Команда" }));
    fireEvent.click(screen.getByRole("button", { name: "Команда А" }));

    await waitFor(() => expect(fetchMyTrackerMeetingReport).toHaveBeenLastCalledWith(expect.objectContaining({
      filters: [{ fieldName: "teamName", type: "EQ", value: "Команда А" }],
    })));

    fireEvent.click(screen.getByRole("button", { name: "Статус" }));
    fireEvent.click(screen.getByRole("button", { name: "Есть проблемы" }));

    await waitFor(() => expect(fetchMyTrackerMeetingReport).toHaveBeenLastCalledWith(expect.objectContaining({
      filters: [
        { fieldName: "teamName", type: "EQ", value: "Команда А" },
        { fieldName: "teamStatus", type: "EQ", value: "WITH_ISSUES" },
        { fieldName: "status", type: "EQ", value: "COMPLETED" },
      ],
    })));
  });

  test("creates a direct status filter for a scheduled meeting", async () => {
    renderPage();
    await screen.findByText("Команда А");

    fireEvent.click(screen.getByRole("button", { name: "Статус" }));
    fireEvent.click(screen.getByRole("button", { name: "Запланирована" }));

    await waitFor(() => expect(fetchMyTrackerMeetingReport).toHaveBeenLastCalledWith(expect.objectContaining({
      filters: [{ fieldName: "status", type: "EQ", value: "SCHEDULED" }],
    })));
  });

  test("updates sort parameters when sortable headers are clicked", async () => {
    renderPage();
    await screen.findByText("Команда А");

    fireEvent.click(screen.getByText("Название команды"));
    await waitFor(() => expect(fetchMyTrackerMeetingReport).toHaveBeenLastCalledWith(expect.objectContaining({
      sort: ["teamName,desc", "startDate,desc"],
    })));

    fireEvent.click(screen.getByText("Статус команды"));
    await waitFor(() => expect(fetchMyTrackerMeetingReport).toHaveBeenLastCalledWith(expect.objectContaining({
      sort: ["teamName,desc", "teamStatus,asc"],
    })));
  });

  test("renders scheduled, cancelled and completed statuses with appropriate task values", async () => {
    fetchMyTrackerMeetingReport.mockResolvedValue(successfulResponse([
      { ...report, teamId: "team-2", teamName: "Команда Б", status: "SCHEDULED", teamStatus: "OK" },
      { ...report, teamId: "team-3", teamName: "Команда В", status: "SCHEDULED", teamStatus: null },
      { ...report, teamId: "team-4", teamName: "Команда Г", status: "COMPLETED_AS_NOT_HAPPENED" },
      { ...report, teamId: "team-5", teamName: "Команда Д", teamStatus: "MANY_ISSUES", tasksCurrentMeeting: "", tasksNextMeeting: "" },
    ]));

    const { container } = renderPage();

    expect(await screen.findByText("Запланирована (Всё ок)")).toBeInTheDocument();
    expect(screen.getByText("Запланирована")).toBeInTheDocument();
    expect(screen.getByText("Не состоялась")).toBeInTheDocument();
    expect(screen.getByText("Есть большие проблемы")).toBeInTheDocument();
    expect(container.querySelector(".mrep-row-not-happened")).toBeInTheDocument();
    expect(container.querySelectorAll("tbody tr")[0]).toHaveTextContent("—");
  });

  test("renders empty state and request error", async () => {
    fetchMyTrackerMeetingReport.mockResolvedValueOnce(successfulResponse([]));
    const { unmount } = renderPage();

    expect(await screen.findByText("Нет данных")).toBeInTheDocument();
    unmount();

    fetchMyTrackerMeetingReport.mockResolvedValueOnce({ ok: false, status: 500 });
    renderPage();

    expect(await screen.findByText("Не удалось загрузить отчёт. Попробуйте обновить страницу.")).toBeInTheDocument();
  });

  test("exports only tracker report data", async () => {
    fetchMyTrackerMeetingReportExcel.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["report"])),
    });
    URL.createObjectURL = jest.fn(() => "blob:report");
    URL.revokeObjectURL = jest.fn();

    renderPage();
    await screen.findByText("Команда А");
    fireEvent.click(screen.getByText("Выгрузить отчёт"));

    await waitFor(() => expect(fetchMyTrackerMeetingReportExcel).toHaveBeenCalledWith(expect.objectContaining({ filters: [] })));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:report");
  });

  test("shows an error when Excel export fails", async () => {
    fetchMyTrackerMeetingReportExcel.mockResolvedValue({ ok: false, status: 500 });
    renderPage();
    await screen.findByText("Команда А");

    fireEvent.click(screen.getByText("Выгрузить отчёт"));

    expect(await screen.findByText("Не удалось выгрузить отчёт. Попробуйте ещё раз.")).toBeInTheDocument();
  });
});
