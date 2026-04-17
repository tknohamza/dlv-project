import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import https from "https";
import path from "path";
import { spawn } from "child_process";

const BIN_NAME = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp_linux";
const BIN_PATH = path.resolve(process.cwd(), "yt-dlp-nightly" + (process.platform === "win32" ? ".exe" : "_linux"));
// Use nightly builds. YouTube frequently breaks stable yt-dlp versions.
const DOWNLOAD_URL = `https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/${BIN_NAME}`;

// Helper to safely follow redirects and download the binary
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const code = res.statusCode || 0;
      if ([301, 302, 307, 308].includes(code) && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (code !== 200) {
        return reject(new Error(`Failed to download: HTTP ${code}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
      file.on("error", (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on("error", reject);
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000; // Required port

  // Download yt-dlp if it doesn't exist
  if (!fs.existsSync(BIN_PATH)) {
    console.log(`Downloading yt-dlp binary from ${DOWNLOAD_URL}...`);
    try {
      await downloadFile(DOWNLOAD_URL, BIN_PATH);
      fs.chmodSync(BIN_PATH, 0o755); // Ensure it's executable
      console.log("yt-dlp downloaded successfully.");
    } catch (err) {
      console.error("Error downloading yt-dlp:", err);
    }
  } else {
    console.log("yt-dlp wrapper is already installed.");
  }

  const COOKIES_PATH = path.resolve(process.cwd(), "cookies.txt");

  app.use(express.json({ limit: "1mb" }));

  // API Route: Save Cookies
  app.post("/api/cookies", (req, res) => {
    const { cookies } = req.body;
    if (typeof cookies === "string" && cookies.trim().length > 0) {
      fs.writeFileSync(COOKIES_PATH, cookies.trim());
      res.json({ success: true, message: "Cookies saved successfully." });
    } else {
      if (fs.existsSync(COOKIES_PATH)) {
        fs.unlinkSync(COOKIES_PATH);
      }
      res.json({ success: true, message: "Cookies cleared." });
    }
  });

  // API Route: Get Cookies status
  app.get("/api/cookies/status", (req, res) => {
    const hasCookies = fs.existsSync(COOKIES_PATH);
    res.json({ active: hasCookies });
  });

  // API Route: Fetch Video Info
  app.get("/api/info", (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "URL is required" });

    // Using --dump-json, --quiet, and --no-warnings to strictly get JSON and avoid stdout pollution.
    // Also use --no-playlist and bypass geolocation.
    const args = ["--dump-json", "--quiet", "--no-warnings", "--no-playlist", "--geo-bypass"];
    if (fs.existsSync(COOKIES_PATH)) {
      args.push("--cookies", COOKIES_PATH);
    }
    args.push(url);

    const child = spawn(BIN_PATH, args);
    let data = "";
    let errData = "";

    child.stdout.on("data", (chunk) => {
      data += chunk;
    });

    child.stderr.on("data", (chunk) => {
      errData += chunk;
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error("yt-dlp info fetch error:", errData);
        // Sometimes yt-dlp returns an error message like "Sign in to confirm you're not a bot"
        const friendlyError = errData.split('\n').find(l => l.includes('ERROR:')) || errData || "Failed to fetch media info";
        return res.status(500).json({ error: friendlyError.replace('ERROR:', '').trim() });
      }
      try {
        const parsed = JSON.parse(data);
        res.json({
          title: parsed.title,
          thumbnail: parsed.thumbnail,
          duration: parsed.duration_string || parsed.duration,
          uploader: parsed.uploader,
          webpage_url: parsed.webpage_url || url,
        });
      } catch (e) {
        console.error("yt-dlp JSON parse error:", e, "Data snippet:", data.substring(0, 200));
        res.status(500).json({ error: "Failed to parse info from yt-dlp" });
      }
    });
  });

  // API Route: Download 
  app.get("/api/download", (req, res) => {
    const url = req.query.url as string;
    const format = (req.query.format as string) || "b";
    let title = (req.query.title as string) || "download";
    title = title.replace(/[^a-z0-9 ]/gi, '').trim(); // Sanitize basic
    if (!title) title = "download";

    const isAudio = format.includes("audio");
    const ext = isAudio ? "m4a" : "mp4"; 

    if (!url) return res.status(400).send("URL is required");

    res.setHeader("Content-Disposition", `attachment; filename="${title}.${ext}"`);
    res.setHeader("Content-Type", isAudio ? "audio/mp4" : "video/mp4");

    const args = ["-f", format, "-o", "-", "--no-playlist", "--geo-bypass", "--no-warnings", "--quiet"];
    if (fs.existsSync(COOKIES_PATH)) {
      args.push("--cookies", COOKIES_PATH);
    }
    args.push(url);

    const child = spawn(BIN_PATH, args);

    child.stdout.pipe(res);

    child.stderr.on("data", (chunk) => {
      // yt-dlp prints progress to stderr when piped
      console.log(`yt-dlp stderr: ${chunk}`);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`yt-dlp exited with code ${code}`);
      }
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    
    // Attempt graceful shutdown of process if client aborts the download
    req.on("close", () => {
      if (!child.killed) {
        child.kill();
      }
    });
  });

  // Vite integration as middleware for SPA/local dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Provide express v5 compatibility for catchall
    // Actually using express v4 as seen in package.json '^4.21.2'
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
