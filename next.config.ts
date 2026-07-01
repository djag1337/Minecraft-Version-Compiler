import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dockerode (and its ssh2/docker-modem deps) is only ever require()'d lazily
  // from DockerBuildService/DockerDecompileService when BUILD_SERVICE=docker;
  // keep it out of the server bundle rather than have the bundler try to
  // statically include ssh2's native/non-ESM assets.
  serverExternalPackages: ["dockerode"],
};

export default nextConfig;
