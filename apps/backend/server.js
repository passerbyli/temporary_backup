const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// health check
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`HTTP server running: http://localhost:${PORT}`);
  console.log(`LLM stream:  http://localhost:${PORT}/llm/stream?mode=normal`);
  console.log(`LLM messy:   http://localhost:${PORT}/llm/stream?mode=messy`);
  console.log(`LLM once:    http://localhost:${PORT}/llm/stream?mode=once`);
  console.log(`Compliance:  http://localhost:${PORT}/compliance/risk`);
});
