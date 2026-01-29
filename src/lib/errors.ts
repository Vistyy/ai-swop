export class InvalidLabelError extends Error {
  constructor(message = "Invalid label") {
    super(message);
    this.name = "InvalidLabelError";
  }
}

export class SandboxAlreadyExistsError extends Error {
  constructor(message = "Sandbox already exists") {
    super(message);
    this.name = "SandboxAlreadyExistsError";
  }
}

export class SandboxNotFoundError extends Error {
  constructor(message = "Sandbox not found") {
    super(message);
    this.name = "SandboxNotFoundError";
  }
}

export class UnsafePathError extends Error {
  constructor(message = "Unsafe path") {
    super(message);
    this.name = "UnsafePathError";
  }
}
