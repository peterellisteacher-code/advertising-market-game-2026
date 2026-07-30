import { describe, expect, it, vi } from "vitest";
import {
  resolveAdvertisingGameRoute,
  runAdvertisingGameRoute
} from "./app-route";

describe("resolveAdvertisingGameRoute", () => {
  it.each([
    ["/", { kind: "redirect", location: "/student" }],
    ["/student", { kind: "student" }],
    ["/student/", { kind: "student" }],
    ["/teacher", { kind: "teacher-dashboard" }],
    ["/teacher/", { kind: "teacher-dashboard" }],
    ["/teacher/playtest", { kind: "teacher-playtest" }],
    ["/teacher/playtest/", { kind: "teacher-playtest" }],
    ["/teacherish", { kind: "not-found" }],
    ["/student-work", { kind: "not-found" }],
    ["/teacher/playtest/more", { kind: "not-found" }]
  ] as const)("resolves %s without accepting prefix matches", (pathname, expected) => {
    expect(resolveAdvertisingGameRoute(pathname)).toEqual(expected);
  });

  it("redirects the root before any application surface boots", () => {
    const actions = {
      replace: vi.fn(),
      bootStudent: vi.fn(),
      bootTeacherDashboard: vi.fn(),
      bootTeacherPlaytest: vi.fn(),
      renderNotFound: vi.fn()
    };

    expect(runAdvertisingGameRoute("/", actions)).toEqual({
      kind: "redirect",
      location: "/student"
    });
    expect(actions.replace).toHaveBeenCalledWith("/student");
    expect(actions.bootStudent).not.toHaveBeenCalled();
    expect(actions.bootTeacherDashboard).not.toHaveBeenCalled();
    expect(actions.bootTeacherPlaytest).not.toHaveBeenCalled();
    expect(actions.renderNotFound).not.toHaveBeenCalled();
  });

  it("boots only the selected application surface", () => {
    const actions = {
      replace: vi.fn(),
      bootStudent: vi.fn(),
      bootTeacherDashboard: vi.fn(),
      bootTeacherPlaytest: vi.fn(),
      renderNotFound: vi.fn()
    };

    runAdvertisingGameRoute("/teacher/playtest", actions);

    expect(actions.bootTeacherPlaytest).toHaveBeenCalledOnce();
    expect(actions.replace).not.toHaveBeenCalled();
    expect(actions.bootStudent).not.toHaveBeenCalled();
    expect(actions.bootTeacherDashboard).not.toHaveBeenCalled();
    expect(actions.renderNotFound).not.toHaveBeenCalled();
  });
});
