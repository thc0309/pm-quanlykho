import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import OfflineStatus from "./OfflineStatus";

afterEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

it("blocks stock-changing work visibly while offline", () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  render(<OfflineStatus />);

  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  fireEvent(window, new Event("offline"));

  expect(screen.getByRole("alert")).toHaveTextContent("thao tác thay đổi tồn kho đã bị chặn");
});
