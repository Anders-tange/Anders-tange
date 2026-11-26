// The Claude artifact build.
import { start } from "./app.js";
import { createClaudePlatform } from "./platform/claude.js";

start(window.claude?.use ? createClaudePlatform() : null);
