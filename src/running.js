// Detects which profiles have a Claude Desktop instance running.
// Every instance we start carries --user-data-dir=.../ClaudeProfiles/<name>/desktop,
// so the profile name can be read from the process command line.
const { execFile } = require('child_process');

const PROFILE_RE = /ClaudeProfiles[\\/]([A-Za-z0-9_-]+)[\\/]desktop/;

// lines: [{ pid, cmd }] -> Map(name -> pid of the main process)
function parse(procs) {
  const found = new Map(); // name -> { pid, main }
  for (const { pid, cmd } of procs) {
    if (!cmd || !cmd.includes('--user-data-dir')) continue;
    const m = PROFILE_RE.exec(cmd);
    if (!m) continue;
    const main = !/\s--type=/.test(cmd); // child processes carry --type=renderer, gpu-process, ...
    const prev = found.get(m[1]);
    if (!prev || (main && !prev.main)) found.set(m[1], { pid, main });
  }
  const out = new Map();
  for (const [name, v] of found) out.set(name, v.pid);
  return out;
}

function listProcesses(platform = process.platform) {
  return new Promise((resolve) => {
    if (platform === 'win32') {
      const ps =
        "Get-CimInstance Win32_Process -Filter \"Name LIKE 'claude%'\" | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }";
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, timeout: 8000 }, (err, out) =>
        resolve(err ? [] : toProcs(out, '\t'))
      );
    } else {
      execFile('ps', ['-axww', '-o', 'pid=,command='], { timeout: 8000, maxBuffer: 16 * 1024 * 1024 }, (err, out) =>
        resolve(err ? [] : toProcs(out, null))
      );
    }
  });
}

function toProcs(out, sep) {
  return String(out)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = sep ? l.indexOf(sep) : l.search(/\s/);
      return { pid: Number(l.slice(0, i)), cmd: l.slice(i + 1) };
    })
    .filter((p) => Number.isFinite(p.pid));
}

async function running(platform = process.platform) {
  return parse(await listProcesses(platform));
}

// All process IDs of one profile, main process first.
function pidsFor(procs, name) {
  return procs
    .filter((p) => p.cmd && p.cmd.includes('--user-data-dir'))
    .filter((p) => { const m = PROFILE_RE.exec(p.cmd); return m && m[1] === name; })
    .sort((a, b) => Number(/\s--type=/.test(a.cmd)) - Number(/\s--type=/.test(b.cmd)))
    .map((p) => p.pid);
}

async function stopProfile(name, platform = process.platform) {
  const pids = pidsFor(await listProcesses(platform), name);
  for (const pid of pids) await stop(pid, platform);
  return pids.length;
}

function stop(pid, platform = process.platform) {
  return new Promise((resolve) => {
    if (platform === 'win32') {
      execFile('taskkill', ['/PID', String(pid), '/T'], { windowsHide: true }, () => resolve());
    } else {
      try { process.kill(pid, 'SIGTERM'); } catch {}
      resolve();
    }
  });
}

module.exports = { parse, toProcs, pidsFor, running, stop, stopProfile, PROFILE_RE };
