import { fireEvent, getByLabelText, getByRole } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import type { PreparedStudentImageUpload } from "./student-image-upload";
import { StudentImageUploadPanel } from "./student-image-upload-panel";

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
    const input = getByLabelText<HTMLInputElement>(host, "Choose an image");

    expect(input.accept).toBe("image/png,image/jpeg,image/webp");
    select(input, new File([Uint8Array.of(1)], "shoe-sketch.jpg", { type: "image/jpeg" }));

    await vi.waitFor(() => expect(onPlace).toHaveBeenCalledOnce());
    expect(onPlace).toHaveBeenCalledWith(prepared);
    expect(input.value).toBe("");
    expect(getByRole(host, "status").textContent).toContain("Shoe sketch added");
  });

  it("keeps placement untouched and exposes an alert when preparation fails", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const onPlace = vi.fn();
    const prepare = vi.fn().mockRejectedValue(new Error("That file is not a supported image."));
    new StudentImageUploadPanel(host, onPlace, prepare);
    const input = getByLabelText<HTMLInputElement>(host, "Choose an image");

    select(input, new File([Uint8Array.of(1)], "notes.txt", { type: "text/plain" }));

    await vi.waitFor(() => expect(getByRole(host, "alert").textContent)
      .toBe("That file is not a supported image."));
    expect(onPlace).not.toHaveBeenCalled();
  });
});
