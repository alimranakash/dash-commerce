import { ReturnsPage } from "../../../../modules/returns/components/returns-page";

type ReturnsRoutePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ReturnsRoutePage({ searchParams }: ReturnsRoutePageProps) {
  return <ReturnsPage searchParams={searchParams} type="RETURN" />;
}
