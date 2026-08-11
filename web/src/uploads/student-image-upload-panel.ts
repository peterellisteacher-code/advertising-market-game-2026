import {
  prepareStudentImageUpload,
  type PreparedStudentImageUpload
} from "./student-image-upload";
import { STUDENT_COPY } from "../game/student-copy";

let studentImageUploadInstance = 0;

export type StudentImagePlaceHandler = (
  image: PreparedStudentImageUpload
) => void | Promise<void>;

export type StudentImagePrepareHandler = (
  file: File
) => Promise<PreparedStudentImageUpload>;

export class StudentImageUploadPanel {
  readonly #input: HTMLInputElement;
  readonly #status: HTMLElement;
  readonly #alert: HTMLElement;
  #operation = 0;

  constructor(
    host: HTMLElement,
    private readonly onPlace: StudentImagePlaceHandler,
    private readonly prepare: StudentImagePrepareHandler = prepareStudentImageUpload
  ) {
    const copy = STUDENT_COPY.assignmentSandbox.upload;
    const idPrefix = `student-image-upload-${++studentImageUploadInstance}`;
    const section = document.createElement("section");
    section.className = "student-image-upload";
    section.setAttribute("aria-labelledby", `${idPrefix}-heading`);
    const heading = document.createElement("h3");
    heading.id = `${idPrefix}-heading`;
    heading.textContent = copy.heading;
    const note = document.createElement("p");
    note.textContent = copy.note;
    const label = document.createElement("label");
    label.htmlFor = `${idPrefix}-input`;
    label.append(document.createTextNode(copy.chooseImage));
    this.#input = document.createElement("input");
    this.#input.id = `${idPrefix}-input`;
    this.#input.type = "file";
    this.#input.accept = "image/png,image/jpeg,image/webp";
    label.append(this.#input);
    this.#status = document.createElement("p");
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    this.#alert = document.createElement("p");
    this.#alert.setAttribute("role", "alert");
    this.#alert.setAttribute("aria-live", "assertive");
    this.#alert.hidden = true;
    section.append(heading, note, label, this.#status, this.#alert);
    host.replaceChildren(section);
    this.#input.addEventListener("change", () => { void this.#handleSelection(); });
  }

  async #handleSelection(): Promise<void> {
    const file = this.#input.files?.[0] ?? this.#input.files?.item?.(0);
    if (!file) return;
    const operation = ++this.#operation;
    this.#input.disabled = true;
    this.#alert.hidden = true;
    this.#alert.textContent = "";
    this.#status.textContent = STUDENT_COPY.assignmentSandbox.upload.preparing;
    try {
      const prepared = await this.prepare(file);
      if (operation !== this.#operation) return;
      await this.onPlace(prepared);
      if (operation !== this.#operation) return;
      this.#status.textContent =
        `${prepared.title}${STUDENT_COPY.assignmentSandbox.upload.addedSuffix}`;
    } catch (error) {
      if (operation !== this.#operation) return;
      this.#status.textContent = "";
      this.#alert.textContent = error instanceof Error
        ? error.message
        : STUDENT_COPY.assignmentSandbox.upload.errors.unknown;
      this.#alert.hidden = false;
    } finally {
      if (operation === this.#operation) {
        this.#input.disabled = false;
        this.#input.value = "";
      }
    }
  }
}
