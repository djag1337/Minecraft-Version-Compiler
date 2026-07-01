import { MINECRAFT_VERSION_OPTIONS } from "@/lib/minecraftVersions";

export async function GET() {
  return Response.json({ versions: MINECRAFT_VERSION_OPTIONS });
}
