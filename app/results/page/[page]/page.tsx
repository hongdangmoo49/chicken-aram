import { notFound } from "next/navigation";
import { ResultsContent } from "../../page";

export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

export default async function PaginatedResultsPage({ params }: { params: Promise<{ page: string }> }) {
  const page = Number((await params).page);
  if (!Number.isInteger(page) || page < 2) notFound();
  return <ResultsContent page={page} />;
}
