const { spawn } = require("child_process");

const isWin = process.platform === "win32";
const shell = isWin ? true : false;

function run(cmd) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${cmd}`);
    const child = spawn(cmd, {
      stdio: "inherit",
      shell,
    });

    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`exit ${code}`))
    );
  });
}

(async () => {
  try {
    await run("npm config set registry https://registry.npmmirror.com");
    await run("npm i -g qianyivue3");
    await run("qianyivue3 -c D:\\testconfig.js");
  } catch (e) {
    console.error(e.message);
  }
})();



/**
 * 
// run.js
const { execSync } = require("child_process");

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, {
    stdio: "inherit",
    windowsHide: false,
  });
}

try {
  console.log("[1/3] Setting npm registry...");
  run("npm config set registry https://registry.npmmirror.com");

  console.log("[2/3] Installing qianyivue3 globally...");
  run("npm i -g qianyivue3");

  console.log("[3/3] Running qianyivue3...");
  run("qianyivue3 -c D:\\testconfig.js");

  console.log("\nAll steps completed successfully!");
} catch (err) {
  console.error("\nERROR: Command failed");
  process.exit(1);
}
 

* 
 */