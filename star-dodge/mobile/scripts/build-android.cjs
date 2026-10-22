// Reuse the machine's SDK and proxy without logging credentials or disabling TLS.
const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  env = { ...process.env };
if (
  !env.ANDROID_HOME &&
  !env.ANDROID_SDK_ROOT &&
  fs.existsSync("/workspace/toolchains/android-sdk")
)
  env.ANDROID_HOME = "/workspace/toolchains/android-sdk";
if (
  fs.existsSync("/workspace/toolchains/android-user") &&
  !env.ANDROID_USER_HOME
)
  env.ANDROID_USER_HOME = "/workspace/toolchains/android-user";
if (fs.existsSync("/workspace/toolchains/gradle") && !env.GRADLE_USER_HOME)
  env.GRADLE_USER_HOME = "/workspace/toolchains/gradle";
if (
  (!env.JAVA_HOME || !fs.existsSync(path.join(env.JAVA_HOME, "bin/javac"))) &&
  fs.existsSync("/workspace/toolchains/jdk-21/bin/javac")
)
  env.JAVA_HOME = "/workspace/toolchains/jdk-21";
if (fs.existsSync("/workspace/toolchains/android-user"))
  env.GRADLE_OPTS =
    (env.GRADLE_OPTS || "") + " -Duser.home=/workspace/toolchains/android-user";
if (fs.existsSync("/etc/ssl/certs/java/cacerts"))
  env.GRADLE_OPTS =
    (env.GRADLE_OPTS || "") +
    " -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts";
const proxyURL = env.HTTPS_PROXY || env.https_proxy;
if (proxyURL) {
  const proxy = new URL(proxyURL);
  if (
    proxy.username ||
    proxy.password ||
    !/^https?:$/.test(proxy.protocol) ||
    !/^[A-Za-z0-9.-]+$/.test(proxy.hostname)
  )
    throw Error(
      "The Java build requires an HTTP proxy without embedded credentials.",
    );
  const opts = ["http", "https"]
    .map(
      (s) =>
        `-D${s}.proxyHost=${proxy.hostname} -D${s}.proxyPort=${proxy.port || 80}`,
    )
    .join(" ");
  env.GRADLE_OPTS = (env.GRADLE_OPTS || "") + " " + opts;
}
const targets = process.argv.slice(2);
if (
  !targets.length ||
  targets.some((t) => !["assembleDebug", "bundleRelease"].includes(t))
)
  throw Error("Choose assembleDebug or bundleRelease.");
const wrapper = path.join(
  root,
  "android",
  process.platform === "win32" ? "gradlew.bat" : "gradlew",
);
const result = spawnSync(
  wrapper,
  [
    "-p",
    path.join(root, "android"),
    "--no-daemon",
    "--max-workers=4",
    ...targets,
  ],
  { env, stdio: "inherit", shell: process.platform === "win32" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
