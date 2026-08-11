import { fireEvent, getByLabelText, getByRole } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import type { PreparedStudentImageUpload } from "./student-image-upload";
import { StudentImageUploadPanel } from "./student-image-upload-panel";
import { STUDENT_COPY } from "../game/student-copy";

const prepared: PreparedStudentImageUpload = {
  title: "Shoe sketch",
  width: 1_200,
  height: 800,
  blob: new Blob([Uint8Array.of(1)], { type: "image/png" })
};

function select(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  fireEvent.change(input);
}

describe("StudentImageUploadPanel", () => {
  it("prepares and places exactly one accepted image", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const onPlace = vi.fn().mockResolvedValue(undefined);
    const prepare = vi.fn().mockResolvedValue(prepared);
    new StudentImageUploadPanel(host, onPlace, prepare);
    const input = getByLabelText<HTMLInputElement>(
      host,
      STUDENT_COPY.assignmentSandbox.upload.chooseImage
    );

    expect(input.accept).toBe("image/png,image/jpeg,image/webp");
    select(input, new File([Uint8Array.of(1)], "shoe-sketch.jpg", { type: "image/jpeg" }));

    await vi.waitFor(() => expect(onPlace).toHaveBeenCalledOnce());
    expect(onPlace).toHaveBeenCalledWith(prepared);
    expect(input.value).toBe("");
    expect(getByRole(host, "status").textContent)
      .toBe(`Shoe sketch${STUDENT_COPY.assignmentSandbox.upload.addedSuffix}`);
  });

  it("keeps placement untouched and exposes an alert when preparation fails", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const onPlace = vi.fn();
    const prepare = vi.fn().mockRejectedValue(new Error("That file is not a supported image."));
    new StudentImageUploadPanel(host, onPlace, prepare);
    const input = getByLabelText<HTMLInputElement>(
      host,
      STUDENT_COPY.assignmentSandbox.upload.chooseImage
    );

    select(input, new File([Uint8Array.of(1)], "notes.txt", { type: "text/plain" }));

    await vi.waitFor(() => expect(getByRole(host, "alert").textContent)
      .toBe("That file is not a supported image."));
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("uses unique labelled controls and separate polite and assertive live regions", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    new StudentImageUploadPanel(first, vi.fn());
    new StudentImageUploadPanel(second, vi.fn());

    const firstInput = getByLabelText<HTMLInputElement>(
      first,
      STUDENT_COPY.assignmentSandbox.upload.chooseImage
    );
    const secondInput = getByLabelText<HTMLInputElement>(
      second,
      STUDENT_COPY.assignmentSandbox.upload.chooseImage
    );
    expect(firstInput.id).not.toBe(secondInput.id);
    expect(first.querySelector("section")?.getAttribute("aria-labelledby"))
      .toBe(first.querySelector("h3")?.id);
    expect(first.querySelector("h3")?.id).not.toBe(second.querySelector("h3")?.id);
    expect(getByRole(first, "status").getAttribute("aria-live")).toBe("polite");
    expect(getByRole(first, "alert", { hidden: true }).getAttribute("aria-live"))
      .toBe("assertive");
  });
});
