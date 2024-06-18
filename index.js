const express = require("express");

const api = express();

api.use(express.json());

const HOST = "localhost";
const PORT = process.env.PORT || 8888;

api.get("/api", (req, res) => {
  res.send("API get request");
});

const IdentifyRouter = require("./routes/identify");
api.use("/api/identify", IdentifyRouter);

api.listen(PORT, () => {
  console.log(`API is running HOST:${HOST}, PORT:${PORT}`);
});
