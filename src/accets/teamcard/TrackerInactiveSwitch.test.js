import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TrackerInactiveSwitch from "./TrackerInactiveSwitch";

const touch = { clientX: 20, clientY: 20 };
const startTouch = (button) => fireEvent.touchStart(button, { touches: [touch] });
const endTouch = (button) => fireEvent.touchEnd(button, { changedTouches: [touch] });

afterEach(() => jest.useRealTimers());

test("desktop click toggles immediately", () => {
  const onToggle = jest.fn();
  render(<TrackerInactiveSwitch checked={false} onToggle={onToggle} />);
  const button = screen.getByRole("switch", { name: "Показать команды неактивных потоков" });

  fireEvent.click(button);
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("on touch, first tap reveals help and second tap toggles", () => {
  const onToggle = jest.fn();
  render(<TrackerInactiveSwitch checked={false} onToggle={onToggle} />);
  const button = screen.getByRole("switch");
  const tooltip = screen.getByRole("tooltip");

  startTouch(button);
  endTouch(button);
  expect(tooltip).toHaveClass("is-open");
  expect(onToggle).not.toHaveBeenCalled();

  startTouch(button);
  endTouch(button);
  expect(onToggle).toHaveBeenCalledTimes(1);
  expect(tooltip).not.toHaveClass("is-open");
  fireEvent.click(button);
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("long touch toggles once without revealing help", () => {
  jest.useFakeTimers();
  const onToggle = jest.fn();
  render(<TrackerInactiveSwitch checked={false} onToggle={onToggle} />);
  const button = screen.getByRole("switch");
  const tooltip = screen.getByRole("tooltip");

  startTouch(button);
  act(() => jest.advanceTimersByTime(550));
  expect(onToggle).toHaveBeenCalledTimes(1);
  expect(tooltip).not.toHaveClass("is-open");
  endTouch(button);
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("scroll gesture does not toggle or open help", () => {
  jest.useFakeTimers();
  const onToggle = jest.fn();
  render(<TrackerInactiveSwitch checked={false} onToggle={onToggle} />);
  const button = screen.getByRole("switch");

  startTouch(button);
  fireEvent.touchMove(button, { touches: [{ clientX: 20, clientY: 50 }] });
  act(() => jest.advanceTimersByTime(600));
  endTouch(button);
  expect(onToggle).not.toHaveBeenCalled();
  expect(screen.getByRole("tooltip")).not.toHaveClass("is-open");
});

test("tapping elsewhere closes the mobile help without toggling", () => {
  const onToggle = jest.fn();
  render(<TrackerInactiveSwitch checked={false} onToggle={onToggle} />);
  const button = screen.getByRole("switch");
  startTouch(button);
  endTouch(button);

  fireEvent.pointerDown(document.body);
  expect(screen.getByRole("tooltip")).not.toHaveClass("is-open");
  expect(onToggle).not.toHaveBeenCalled();
});
