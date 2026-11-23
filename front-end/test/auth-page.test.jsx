import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AuthPage from "../src/pages/AuthPage.jsx";
const mocks = vi.hoisted(() => ({ me: vi.fn() }));
vi.mock("../src/api/auth.api.js", () => ({ AuthAPI: { me: mocks.me } }));
vi.mock("../src/components/auth/AuthCard", () => ({ default: () => <div>Login form</div> }));
afterEach(cleanup);
const mount = () => render(<MemoryRouter initialEntries={["/auth"]}><Routes>
  <Route path="/auth" element={<AuthPage />} /><Route path="/home" element={<div>Chat home</div>} />
</Routes></MemoryRouter>);
it("restores a valid session from the auth page without showing the login form", async () => {
  mocks.me.mockResolvedValue({ data: { user: { id: "user" } } });
  mount();
  expect(screen.queryByText("Login form")).toBeNull();
  expect(await screen.findByText("Chat home")).toBeTruthy();
});
it("shows login for an expired session", async () => {
  mocks.me.mockRejectedValue({ response: { status: 401 } });
  mount();
  expect(await screen.findByText("Login form")).toBeTruthy();
});
it("offers retry instead of login for an offline/server error", async () => {
  mocks.me.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: { user: { id: "user" } } });
  mount();
  fireEvent.click(await screen.findByText("Thử lại"));
  expect(await screen.findByText("Chat home")).toBeTruthy();
});
