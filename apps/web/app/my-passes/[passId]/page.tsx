import { PassDetail } from "./pass-detail";

export default async function MyPassDetailPage({
  params,
}: {
  params: Promise<{ passId: string }>;
}) {
  const { passId } = await params;
  return <PassDetail passId={passId} />;
}
