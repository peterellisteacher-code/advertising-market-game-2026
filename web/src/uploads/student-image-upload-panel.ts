import {
  prepareStudentImageUpload,
  type PreparedStudentImageUpload
} from "./student-image-upload";
import { STUDENT_COPY } from "../game/student-copy";
import type { ImageLabPairIdentity } from "../ai-image/image-lab-runtime";

let studentImageUploadInstance = 0;

export type StudentImagePlaceHandler = (
  image: PreparedStudentImageUpload,
  pair: ImageLabPairIdentity
) => void | Promise<void>;

export type StudentImagePrepareHandler = (
  file: File
) => Promise<PreparedStudentImageUpload>;

export type StudentImagePairCapture = () => ImageLabPairIdentity;

export class StudentImageUploadPanel {
  readonly #input: HTMLInputElement;
  readonly #status: HTMLElement;
  readonly #alert: HTMLElement;
  #operation = 0;

  constructor(
    host: HTMLElement,
    private readonly onPlace: StudentImagePlaceHandler,
    private readonly prepare: StudentImagePrepareHandler = prepareStudentImageUpload,
    private readonly capturePair: StudentImagePairCapture = () => {
      throw new Error(STUDENT_COPY.assignmentSandbox.upload.errors.unknown);
    }
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

  cancel(): void {
    this.#operation += 1;
    this.#input.disabled = false;
    this.#input.value = "";
    this.#status.textContent = "";
    this.#alert.textContent = "";
    this.#alert.hidden = true;
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
      const pair = this.capturePair();
      const prepared = await this.prepare(file);
      if (operation !== this.#operation) return;
      await this.onPlace(prepared, pair);
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
