import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile, access } from "node:fs/promises";

// Server deps to inline-bundle. Anything *not* in this list is left as a
// runtime require, which keeps express-session / memorystore working — they
// rely on internals that minification can break.
const allowlist = [
  "@supabase/supabase-js",
  "date-fns",
  "dotenv",
  "express",
  "nanoid",
  "ws",
  "zod",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Copy the parsed manual JSON next to the bundle so manualSeed.ts can
  // resolve it at runtime in production deployments.
  try {
    await access("script/manualData.json");
    await copyFile("script/manualData.json", "dist/manualData.json");
    console.log("copied script/manualData.json -> dist/manualData.json");
  } catch {
    console.warn("script/manualData.json not found; production bundle will use fallback chapters.");
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
