import React from "react";
import { render, waitFor } from "@testing-library/react";
import { useNavigate } from "react-router-dom";
import AfterLogin from "./AfterLogin";
import loginService from "../../services/login-service";
import axios from "axios";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ 
      data: { 
        token: "test-csrf-token", 
        headerName: "X-CSRF-TOKEN" 
      } 
    })),
    create: jest.fn().mockReturnValue({ get: jest.fn() }),
  },
}));

jest.mock("react-router-dom", () => ({
  useNavigate: jest.fn(),
}));

jest.mock("../../services/login-service");

describe("AfterLogin", () => {
  let mockNavigate;
  let mockGetUserInfo;

  beforeEach(() => {
    axios.get.mockResolvedValue({ data: { token: "test-csrf-token", headerName: "X-CSRF-TOKEN" } });
    mockNavigate = jest.fn();
    useNavigate.mockReturnValue(mockNavigate);

    mockGetUserInfo = jest.fn();
    loginService.mockReturnValue({ getUserInfo: mockGetUserInfo });

    // Очищаем localStorage перед каждым тестом
    localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const scenarios = [
    { roles: ["ADMIN"], expectedPath: "/streams" },
    { roles: ["TRACKER"], expectedPath: "/team-cards" },
    { roles: ["SUPER_ADMIN"], expectedPath: "/streams" },
    { roles: ["USER"], expectedPath: "/home" },
  ];

  

  it.each(scenarios)("routes $roles after validating CSRF", async ({ roles, expectedPath }) => {
    mockGetUserInfo.mockResolvedValue({ roles });
    render(<AfterLogin />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(expectedPath));
    expect(localStorage.getItem('csrfToken')).toBe('test-csrf-token');
    expect(localStorage.getItem('csrfHeaderName')).toBe('X-CSRF-TOKEN');
  });

  it.each([
    { token: 'valid-token', headerName: 'Authorization' },
    { token: 'bad\r\nInjected: value', headerName: 'X-CSRF-TOKEN' },
    { token: {}, headerName: 'X-CSRF-TOKEN' },
    { token: 'x'.repeat(4097), headerName: 'X-CSRF-TOKEN' },
  ])('rejects invalid CSRF data without storing it', async data => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    axios.get.mockResolvedValueOnce({ data });
    render(<AfterLogin />);
    await waitFor(() => expect(logged).toHaveBeenCalled());
    expect(mockGetUserInfo).not.toHaveBeenCalled();
    expect(localStorage.getItem('csrfToken')).toBeNull();
    expect(localStorage.getItem('csrfHeaderName')).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it("logs an error if CSRF token fetch fails", async () => {
    const error = new Error("CSRF fetch failed");
    axios.get.mockRejectedValueOnce(error);
    console.error = jest.fn();

    render(<AfterLogin />);
    
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Error fetching CSRF token:", error);
    });
  });
});