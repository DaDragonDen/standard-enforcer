import express from "express";

// Set up the ping server
const webServer = express();
webServer.get("*", (req, res) => res.sendStatus(200));
webServer.listen(3000, () => console.log("[Web Server] Online!"));
