import Workspace from "@/components/Workspace";

export default async function ProjectPage({
  params,
}: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  return <Workspace projectId={projectId} />;
}
