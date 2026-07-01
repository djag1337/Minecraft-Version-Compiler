# Builder image for DockerBuildService / DockerDecompileService.
#
# Not buildable/testable in the dev sandbox this project was authored in (no
# Docker daemon, and maven.fabricmc.net is blocked by network policy there).
# Verify by building this image and running `docker run <image> build` /
# `... genSources` against the fabric-template/ project in an environment with
# Docker + unrestricted Maven access.
FROM eclipse-temurin:21-jdk

ARG GRADLE_VERSION=8.10

RUN apt-get update \
    && apt-get install -y --no-install-recursive curl unzip \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/gradle.zip "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" \
    && unzip -q /tmp/gradle.zip -d /opt \
    && rm /tmp/gradle.zip
ENV PATH="/opt/gradle-${GRADLE_VERSION}/bin:${PATH}"

WORKDIR /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["build"]
