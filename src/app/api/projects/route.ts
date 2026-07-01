import { createProject, listProjects } from "@/lib/db";
import { scaffoldFabricProject } from "@/lib/projectFiles";
import { findVersionOption } from "@/lib/minecraftVersions";

export async function GET() {
  return Response.json({ projects: listProjects() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const minecraftVersion = typeof body.minecraftVersion === "string" ? body.minecraftVersion : "";

  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  const versionOption = findVersionOption(minecraftVersion);
  if (!versionOption) {
    return Response.json({ error: "unsupported minecraftVersion" }, { status: 400 });
  }

  const project = createProject({
    name,
    minecraftVersion: versionOption.minecraftVersion,
    yarnMappingsVersion: versionOption.yarnMappingsVersion,
    fabricLoaderVersion: versionOption.fabricLoaderVersion,
  });
  scaffoldFabricProject(project);

  return Response.json({ project }, { status: 201 });
}
