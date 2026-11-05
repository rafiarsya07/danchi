// PM2 config for the mini PC:  pm2 startOrReload ecosystem.config.cjs --update-env && pm2 save
// Every value in .env is handed to both apps on each (re)load, so a key added
// later (Gemini, email...) is always picked up. The port comes from .env (PORT).
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const file = path.join(__dirname, ".env");
const fromFile = fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
const PORT = fromFile.PORT || process.env.PORT || "3110";

module.exports = {
  apps: [
    {
      name: "danchi",
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${PORT}`,
      cwd: __dirname,
      env: { ...fromFile, NODE_ENV: "production", PORT },
      max_memory_restart: "500M",
    },
    {
      // Sends reminders, the morning summary and the evening nudge (push + email).
      name: "danchi-worker",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "scripts/worker.ts",
      cwd: __dirname,
      env: { ...fromFile, NODE_ENV: "production" },
      max_memory_restart: "250M",
    },
  ],
};
