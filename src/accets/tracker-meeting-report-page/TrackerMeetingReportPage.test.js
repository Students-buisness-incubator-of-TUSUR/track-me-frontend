import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMyTrackerMeetingReport.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [report] }),
    });
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

    expect(fetchMyTrackerMeetingReportExcel).toHaveBeenCalledWith(expect.objectContaining({ filters: [] }));
  });
});
