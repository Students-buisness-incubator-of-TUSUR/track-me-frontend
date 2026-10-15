import React from "react";
import axios from "axios";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Registration from "./Registration";

jest.mock("axios", () => ({ post: jest.fn() }));

afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
});

test("registration requires both personal data checkboxes", async () => {
    axios.post.mockResolvedValue({ data: {} });
    jest.spyOn(window, "alert").mockImplementation(() => {});
    const { container } = render(<Registration />);
    const form = container.querySelector("form");
    const [policy, personalData] = screen.getAllByRole("checkbox");

    expect(policy).toHaveAccessibleName("Я ознакомился с политикой в отношении обработки данных.");
    expect(personalData).toHaveAccessibleName("Я даю согласие на обработку персональных данных.");
    expect(policy).toBeRequired();
    expect(personalData).toBeRequired();

    fireEvent.submit(form);
    expect(axios.post).not.toHaveBeenCalled();

    fireEvent.click(policy);
    fireEvent.submit(form);
    expect(axios.post).not.toHaveBeenCalled();

    fireEvent.click(personalData);
    fireEvent.submit(form);
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
});
