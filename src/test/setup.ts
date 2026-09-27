import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom does not implement modal dialogs.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}
afterEach(cleanup);
