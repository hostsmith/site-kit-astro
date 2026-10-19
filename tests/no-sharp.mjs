// Registered with --import, makes every import of sharp throw, so a build that
// loads it fails (site-kit-licenses design D66).
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "sharp" || specifier.startsWith("sharp/")) throw new Error("The build loaded sharp");
    return nextResolve(specifier, context);
  },
});
