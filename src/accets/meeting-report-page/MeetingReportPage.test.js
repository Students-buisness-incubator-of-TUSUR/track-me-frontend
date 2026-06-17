import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import MeetingReportPage from "./MeetingReportPage";
import * as requests from "../../services/requests";
import * as util from "../../services/util";

jest.mock("../../services/requests", () => ({
  fetchMeetingReport: jest.fn(),
  fetchMeetingReportExcel: jest.fn(),
}));

jest.mock("../../services/util", () => ({
  useGetUserInfo: jest.fn(),
}));

jest.mock("../header/header", () => () => <div data-testid="mock-header">Header</div>);

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useParams: () => ({ streamId: "123" }),
  useNavigate: () => mockNavigate,
}));

describe("MeetingReportPage Component", () => {
  const mockData = {
    content: [
      {
        teamId: "team-111",
        teamName: "Team Alpha",
        startDate: "2023-10-01T10:00:00Z",
        trackerName: "tracker1",
        trackerFullName: "Иван Иванов",
        status: "COMPLETED",
        teamStatus: "OK",
        tasksNextMeeting: "Сделать А",
        tasksCurrentMeeting: "Сделали Б",
      },
      {
        teamId: "team-222",
        teamName: "Team Beta",
        startDate: "2023-10-02T10:00:00Z",
        trackerName: "tracker2",
        trackerFullName: "Петр Петров",
        status: "SCHEDULED",
        teamStatus: null,
      },
      {
        teamId: "team-333",
        teamName: "Team Gamma",
        startDate: "2023-10-03T10:00:00Z",
        trackerName: "tracker1",
        trackerFullName: "Иван Иванов",
        status: "COMPLETED_AS_NOT_HAPPENED",
        teamStatus: null,
      },
    ],
  };

  beforeAll(() => {
    HTMLAnchorElement.prototype.click = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    util.useGetUserInfo.mockReturnValue({ roles: ["ADMIN"] });
    requests.fetchMeetingReport.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    global.URL.createObjectURL = jest.fn();
    global.URL.revokeObjectURL = jest.fn();
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <MeetingReportPage />
      </MemoryRouter>
    );

  test("рендерит начальное состояние и делает запрос", async () => {
    renderComponent();

    expect(screen.getByText("Загрузка...")).toBeInTheDocument();
    await waitFor(() => {
      expect(requests.fetchMeetingReport).toHaveBeenCalledWith(
        expect.objectContaining({
          streamId: "123",
          filters: [],
          page: 0,
          size: 10000,
          sort: ["teamName,asc", "startDate,desc"],
        })
      );
    });

    await waitFor(() => {
      expect(screen.queryByText("Загрузка...")).not.toBeInTheDocument();
    });
  });

  test("отображает данные в таблице и корректно форматирует статусы", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    expect(screen.getByText("Всё ок")).toBeInTheDocument();
    expect(screen.getByText("Запланирована")).toBeInTheDocument();
    expect(screen.getByText("Не состоялась")).toBeInTheDocument();
    expect(screen.getAllByText("Иван Иванов")).toHaveLength(2);
  });

  test("кнопка 'Назад' вызывает navigate(-1)", async () => {
    renderComponent();

    const backButton = screen.getByText("← Назад");
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  test("клик по названию команды вызывает navigate с teamId", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const teamLink = screen.getByText("Team Alpha");
    fireEvent.click(teamLink);

    expect(mockNavigate).toHaveBeenCalledWith("/teamcard/team-111");
  });

  test("клик по названию второй команды вызывает navigate с правильным teamId", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Beta")).toBeInTheDocument();
    });

    const teamLink = screen.getByText("Team Beta");
    fireEvent.click(teamLink);

    expect(mockNavigate).toHaveBeenCalledWith("/teamcard/team-222");
  });

  test("работает фильтр по трекеру", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const trackerFilterBtn = screen.getByText("Трекеры");
    fireEvent.click(trackerFilterBtn);

    const trackerOption = screen.getByRole("button", { name: "Иван Иванов (@tracker1)" });
    fireEvent.click(trackerOption);

    await waitFor(() => {
      expect(requests.fetchMeetingReport).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ fieldName: "trackerFullName", type: "EQ", value: "Иван Иванов" }],
        })
      );
    });
  });

  test("работает фильтр по команде", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const teamFilterBtn = screen.getByText("Команда");
    fireEvent.click(teamFilterBtn);

    const teamOption = screen.getByRole("button", { name: "Team Beta" });
    fireEvent.click(teamOption);

    await waitFor(() => {
      expect(requests.fetchMeetingReport).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ fieldName: "teamName", type: "EQ", value: "Team Beta" }],
        })
      );
    });
  });

  test("работает фильтр по статусу", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const statusFilterBtn = screen.getByText("Статус");
    fireEvent.click(statusFilterBtn);

    const okStatusOption = screen.getByRole("button", { name: "Всё ок" });
    fireEvent.click(okStatusOption);

    await waitFor(() => {
      expect(requests.fetchMeetingReport).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            { fieldName: "teamStatus", type: "EQ", value: "OK" },
            { fieldName: "status", type: "EQ", value: "COMPLETED" },
          ],
        })
      );
    });
  });

  test("работает сортировка при клике на заголовок таблицы", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const teamNameHeader = screen.getByText(/Название команды/i);
    fireEvent.click(teamNameHeader);

    await waitFor(() => {
      expect(requests.fetchMeetingReport).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: ["teamName,desc", "startDate,desc"],
        })
      );
    });
  });

  test("функция экспорта вызывает fetchMeetingReportExcel", async () => {
    requests.fetchMeetingReportExcel.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["test"], { type: "application/vnd.ms-excel" }),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const exportBtn = screen.getByText("Выгрузить отчет");
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(requests.fetchMeetingReportExcel).toHaveBeenCalledWith(
        expect.objectContaining({
          streamId: "123",
          filters: [],
        })
      );
    });
  });

  test("отображает 'Нет данных', если API возвращает пустой массив", async () => {
    requests.fetchMeetingReport.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [] }),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Нет данных")).toBeInTheDocument();
    });
  });

  test("открывает и закрывает дропдаун трекеров", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const trackerBtn = screen.getByText("Трекеры");
    fireEvent.click(trackerBtn);

    expect(screen.getByPlaceholderText("Поиск по имени или логину...")).toBeInTheDocument();

    fireEvent.click(trackerBtn);
    expect(screen.queryByPlaceholderText("Поиск по имени или логину...")).not.toBeInTheDocument();
  });

  test("поиск в трекерах фильтрует список", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const trackerBtn = screen.getByText("Трекеры");
    fireEvent.click(trackerBtn);

    const searchInput = screen.getByPlaceholderText("Поиск по имени или логину...");
    fireEvent.change(searchInput, { target: { value: "Петр" } });

    expect(screen.getByText("Петр Петров (@tracker2)")).toBeInTheDocument();
    expect(screen.queryByText("Иван Иванов (@tracker1)")).not.toBeInTheDocument();
  });

  test("поиск по логину трекера фильтрует список", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const trackerBtn = screen.getByText("Трекеры");
    fireEvent.click(trackerBtn);

    const searchInput = screen.getByPlaceholderText("Поиск по имени или логину...");
    fireEvent.change(searchInput, { target: { value: "tracker2" } });

    expect(screen.getByText("Петр Петров (@tracker2)")).toBeInTheDocument();
    expect(screen.queryByText("Иван Иванов (@tracker1)")).not.toBeInTheDocument();
  });

  test("пустой поиск в трекерах не показывает вариантов", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const trackerBtn = screen.getByText("Трекеры");
    fireEvent.click(trackerBtn);

    const searchInput = screen.getByPlaceholderText("Поиск по имени или логину...");
    fireEvent.change(searchInput, { target: { value: "zzz" } });

    expect(screen.queryByText("Иван Иванов (@tracker1)")).not.toBeInTheDocument();
    expect(screen.queryByText("Петр Петров (@tracker2)")).not.toBeInTheDocument();
  });

  test("выбор трекера сбрасывает поисковый запрос", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const trackerBtn = screen.getByText("Трекеры");
    fireEvent.click(trackerBtn);

    const searchInput = screen.getByPlaceholderText("Поиск по имени или логину...");
    fireEvent.change(searchInput, { target: { value: "Петр" } });

    const trackerOption = screen.getByRole("button", { name: "Петр Петров (@tracker2)" });
    fireEvent.click(trackerOption);

    expect(screen.queryByPlaceholderText("Поиск по имени или логину...")).not.toBeInTheDocument();
  });

  test("выбор '— Все —' сбрасывает фильтр трекера", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const trackerBtn = screen.getByText("Трекеры");
    fireEvent.click(trackerBtn);

    const allOption = screen.getByRole("button", { name: "— Все —" });
    fireEvent.click(allOption);

    await waitFor(() => {
      expect(requests.fetchMeetingReport).toHaveBeenCalledWith(
        expect.objectContaining({ filters: [] })
      );
    });
  });

  test("экспорт с выбранным фильтром трекера", async () => {
    requests.fetchMeetingReportExcel.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["test"], { type: "application/vnd.ms-excel" }),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const trackerBtn = screen.getByText("Трекеры");
    fireEvent.click(trackerBtn);

    const trackerOption = screen.getByRole("button", { name: "Иван Иванов (@tracker1)" });
    fireEvent.click(trackerOption);

    await waitFor(() => {
      expect(requests.fetchMeetingReport).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ fieldName: "trackerFullName", type: "EQ", value: "Иван Иванов" }],
        })
      );
    });

    const exportBtn = screen.getByText("Выгрузить отчет");
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(requests.fetchMeetingReportExcel).toHaveBeenCalledWith(
        expect.objectContaining({
          streamId: "123",
          filters: [{ fieldName: "trackerFullName", type: "EQ", value: "Иван Иванов" }],
        })
      );
    });
  });

  test("сортировка по дате встречи", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const dateHeader = screen.getByText("Дата встречи");
    fireEvent.click(dateHeader);

    await waitFor(() => {
      expect(requests.fetchMeetingReport).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: ["teamName,asc", "startDate,asc"],
        })
      );
    });

    fireEvent.click(dateHeader);
    await waitFor(() => {
      expect(requests.fetchMeetingReport).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: ["teamName,asc", "startDate,desc"],
        })
      );
    });
  });

  test("сортировка по статусу команды", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const statusHeader = screen.getByText("Статус команды");
    fireEvent.click(statusHeader);

    await waitFor(() => {
      expect(requests.fetchMeetingReport).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: ["teamName,asc", "teamStatusValue,asc"],
        })
      );
    });
  });

  test("индикаторы сортировки отображаются корректно", async () => {
    const { container } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    });

    const thElements = container.querySelectorAll("th.mrep-th-sortable");
    expect(thElements[0].textContent).toMatch(/Название команды/);
    expect(thElements[0].textContent).toMatch(/А→Я/);
    expect(thElements[1].textContent).toMatch(/Дата встречи/);
    expect(thElements[1].textContent).toMatch(/↓/);

    fireEvent.click(thElements[0]);

    await waitFor(() => {
      const updatedThs = container.querySelectorAll("th.mrep-th-sortable");
      expect(updatedThs[0].textContent).toMatch(/Я→А/);
    });
  });

  test("загрузка с ошибкой HTTP", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    requests.fetchMeetingReport.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    renderComponent();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});