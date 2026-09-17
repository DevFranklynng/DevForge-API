// Vercel serverless entry point.
// Vercel invokes this file as a Function instead of src/index.js, which
// calls app.listen() for the long-running Node process.
import { createApp } from "../src/app.js";

const app = createApp();

export default app;